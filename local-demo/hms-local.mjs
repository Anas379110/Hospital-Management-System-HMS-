#!/usr/bin/env node
// Fictional loopback demo only. This command never connects to an existing external database.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  realpathSync,
  chmodSync,
  lstatSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createServer } from "node:net";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  backend = join(root, "backend");
const require = createRequire(import.meta.url),
  { PrismaClient } = require(join(backend, "node_modules/@prisma/client"));
const [command, ...args] = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.match(args[i], /^--[a-z-]+$/);
  assert.ok(args[i + 1] && !args[i + 1].startsWith("--"));
  options[args[i].slice(2)] = args[i + 1];
}
const allowed = {
  init: ["dir", "pg-bin", "port"],
  serve: ["dir", "http-port"],
  backup: ["dir", "out"],
  restore: ["dir", "pg-bin", "port", "backup"],
  verify: ["dir"],
};
assert.ok(
  allowed[command],
  "Commands: init, serve, backup, restore, verify. See local-demo/README.md",
);
for (const key of Object.keys(options))
  assert.ok(allowed[command].includes(key), "Unknown option " + key);
assert.ok(options.dir, "--dir required");
const home = resolve(options.dir);
assert.notEqual(home, root);
assert.notEqual(home, "/");
assert.ok(
  !home.startsWith(root + "/"),
  "Private data must be outside the repository",
);
const privateWrite = (p, value) => {
  writeFileSync(p, value, { mode: 0o600, flag: "wx" });
  chmodSync(p, 0o600);
};
const hash = (x) => createHash("sha256").update(x).digest("hex");
const cleanEnv = () => {
  const e = { ...process.env };
  for (const k of Object.keys(e))
    if (k.startsWith("PG") || k === "DATABASE_URL" || k === "JWT_SECRET")
      delete e[k];
  return e;
};
function run(bin, args, env = {}) {
  const r = spawnSync(bin, args, {
    cwd: backend,
    env: { ...cleanEnv(), ...env },
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      dirname(bin).endsWith("/bin")
        ? bin.split("/").at(-1) + " failed; check private local PostgreSQL log"
        : bin + " failed (no credentials logged)",
    );
  return r.stdout.trim();
}
function number(value, fallback) {
  const n = Number(value ?? fallback);
  assert.ok(
    Number.isInteger(n) && n >= 1024 && n <= 65535,
    "Unprivileged valid port required",
  );
  return n;
}
let cfg,
  client,
  locked = false;
const url = (role = "hms_owner") => {
  const u = new URL("postgresql://127.0.0.1:" + cfg.port + "/hms_local_demo");
  u.username = role;
  u.password = cfg.passwords[role];
  return u.toString();
};
const dbEnv = () => ({
  PGHOST: "127.0.0.1",
  PGPORT: String(cfg.port),
  PGUSER: "hms_owner",
  PGPASSWORD: cfg.passwords.hms_owner,
  PGDATABASE: "hms_local_demo",
  PGPASSFILE: "/nonexistent",
});
const bin = (name) => join(cfg.pgBin, name);
function start() {
  assert.ok(
    !existsSync(join(home, "pgdata", "postmaster.pid")),
    "Database is already running or has a stale PID; inspect it first",
  );
  running = true;
  run(bin("pg_ctl"), [
    "-D",
    join(home, "pgdata"),
    "-l",
    join(home, "postgres.log"),
    "-w",
    "start",
  ]);
}
function stop() {
  run(bin("pg_ctl"), ["-D", join(home, "pgdata"), "-w", "-m", "fast", "stop"]);
}
async function connect() {
  client = new PrismaClient({ datasources: { db: { url: url() } } });
  await client.$connect();
  assert.equal(
    realpathSync(
      (await client.$queryRawUnsafe("SHOW data_directory"))[0].data_directory,
    ),
    realpathSync(join(home, "pgdata")),
  );
}
async function roles() {
  for (const role of ["hms_runtime", "hms_cleanup"])
    await client.$executeRawUnsafe(
      `CREATE ROLE ${role} LOGIN PASSWORD '${cfg.passwords[role]}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`,
    );
}
async function assertPortFree(port) {
  const server = createServer();
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => server.close(ok));
  });
}
function versions(pgBin) {
  const major = run(join(pgBin, "postgres"), ["--version"]).match(/\d+/)[0];
  assert.ok(["17", "18"].includes(major), "PostgreSQL 17 or 18 required");
  for (const name of [
    "initdb",
    "pg_ctl",
    "psql",
    "createdb",
    "pg_dump",
    "pg_restore",
  ])
    assert.equal(
      run(join(pgBin, name), ["--version"]).match(/\d+/)[0],
      major,
      "All server/client tools must use the same PostgreSQL major",
    );
  return major;
}
function assertPrivate(path) {
  assert.ok(!lstatSync(path).isSymbolicLink());
  assert.equal(lstatSync(path).mode & 0o077, 0, "Private permissions required");
}
async function snapshot() {
  const rows = [];
  for (const { tablename } of await client.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )) {
    assert.match(tablename, /^[a-z_]+$/);
    const data = await client.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM public."${tablename}" t ORDER BY row_to_json(t)::text COLLATE "C"`,
    );
    rows.push({
      table: tablename,
      count: data.length,
      sha256: hash(data.map((x) => x.row).join("\n")),
    });
  }
  const catalog = {};
  for (const [k, sql] of Object.entries({
    policies:
      "SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
    security:
      "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname",
    grants:
      "SELECT table_name,grantee,privilege_type,is_grantable FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type",
    functions:
      "SELECT p.proname,pg_get_functiondef(p.oid) AS definition,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)",
    constraints:
      "SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname",
    indexes:
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
    enums:
      "SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
  }))
    catalog[k] = await client.$queryRawUnsafe(sql);
  return { rows, catalog };
}
async function security() {
  const p = new PrismaClient({
    datasources: { db: { url: url("hms_runtime") } },
  });
  try {
    const r = (
      await p.$queryRawUnsafe(
        "SELECT current_user AS role,session_user AS session,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user",
      )
    )[0];
    assert.equal(r.role, "hms_runtime");
    assert.equal(r.session, "hms_runtime");
    for (const k of [
      "rolsuper",
      "rolbypassrls",
      "rolcreatedb",
      "rolcreaterole",
    ])
      assert.equal(r[k], false);
    for (const sql of [
      "UPDATE audit_logs SET action=action",
      "DELETE FROM audit_logs",
      "TRUNCATE audit_logs",
      "SELECT * FROM hms_cleanup_state",
    ])
      await assert.rejects(() => p.$queryRawUnsafe(sql));
    assert.deepEqual(await p.$queryRawUnsafe("SELECT id FROM patients"), []);
    return {
      runtimeRole: r.role,
      nonownerNoBypass: true,
      auditMutationsDenied: 3,
      cleanupTableDenied: true,
      unscopedPatients: 0,
    };
  } finally {
    await p.$disconnect();
  }
}
async function create() {
  assert.ok(!existsSync(home), "Target directory must not exist; no overwrite");
  mkdirSync(home, { mode: 0o700 });
  assertPrivate(home);
  locked = true;
  mkdirSync(join(home, ".operation"), { mode: 0o700 });
  assert.ok(options["pg-bin"], "--pg-bin required");
  const pgBin = realpathSync(options["pg-bin"]);
  for (const name of [
    "initdb",
    "pg_ctl",
    "postgres",
    "psql",
    "createdb",
    "pg_dump",
    "pg_restore",
  ])
    assert.ok(
      existsSync(join(pgBin, name)),
      "Missing PostgreSQL binary " + name,
    );
  versions(pgBin);
  cfg = {
    format: 1,
    pgBin,
    port: number(options.port, 55432),
    passwords: Object.fromEntries(
      ["hms_owner", "hms_runtime", "hms_cleanup"].map((r) => [
        r,
        randomBytes(32).toString("hex"),
      ]),
    ),
    jwt: randomBytes(48).toString("hex"),
  };
  const pw = join(home, "init-password");
  privateWrite(pw, cfg.passwords.hms_owner);
  try {
    run(bin("initdb"), [
      "-D",
      join(home, "pgdata"),
      "-U",
      "hms_owner",
      "--auth-host=scram-sha-256",
      "--auth-local=scram-sha-256",
      "--pwfile=" + pw,
      "--encoding=UTF8",
      "--locale=C",
    ]);
  } finally {
    rmSync(pw, { force: true });
  }
  // No Unix socket or wildcard bind. Local URL is generated, never supplied by a caller.
  writeFileSync(
    join(home, "pgdata", "postgresql.auto.conf"),
    "listen_addresses = '127.0.0.1'\nunix_socket_directories = ''\nport = " +
      cfg.port +
      "\nmax_connections = 40\n",
    { mode: 0o600 },
  );
  privateWrite(join(home, "config.json"), JSON.stringify(cfg, null, 2) + "\n");
  start();
  run(bin("createdb"), ["hms_local_demo"], dbEnv());
  await connect();
  await roles();
}
let running = false;
try {
  if (command === "init" || command === "restore") {
    await create();
    running = true;
    if (command === "init") {
      run(
        process.execPath,
        [
          join(backend, "node_modules/prisma/build/index.js"),
          "migrate",
          "deploy",
        ],
        { DATABASE_URL: url() },
      );
      run(
        bin("psql"),
        [
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          join(backend, "prisma/demo/grants.sql"),
        ],
        dbEnv(),
      );
      await client.$executeRawUnsafe(
        "REVOKE ALL ON _prisma_migrations FROM hms_runtime,hms_cleanup",
      );
    } else {
      const folder = realpathSync(options.backup ?? "");
      assertPrivate(folder);
      for (const name of ["manifest.json", "fictional.dump", "recovery-key"])
        assertPrivate(join(folder, name));
      const m = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
      assert.equal(m.format, 1);
      assert.equal(
        hash(readFileSync(join(folder, "fictional.dump"))),
        m.archiveSha256,
      );
      assert.equal(
        run(bin("postgres"), ["--version"]).match(/\d+/)[0],
        m.postgresMajor,
        "Same PostgreSQL major required",
      );
      assert.equal(
        (
          await client.$queryRawUnsafe(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'",
          )
        ).length,
        0,
      );
      await client.$executeRawUnsafe(
        "CREATE ROLE hms_migration NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT",
      );
      run(
        bin("pg_restore"),
        [
          "--exit-on-error",
          "--single-transaction",
          "--dbname=hms_local_demo",
          join(folder, "fictional.dump"),
        ],
        dbEnv(),
      );
      assert.deepEqual(
        await snapshot(),
        m.snapshot,
        "Independent cluster rows/security catalog mismatch",
      );
      cfg.jwt = readFileSync(join(folder, "recovery-key"), "utf8");
      assert.match(cfg.jwt, /^[0-9a-f]{96}$/);
      writeFileSync(
        join(home, "config.json"),
        JSON.stringify(cfg, null, 2) + "\n",
        { mode: 0o600 },
      );
    }
    const proof = await security();
    console.log(
      JSON.stringify({
        command,
        directory: home,
        postgresMajor: run(bin("postgres"), ["--version"]).match(/\d+/)[0],
        proof,
        recovered: command === "restore",
        next: "node local-demo/hms-local.mjs serve --dir " + home,
      }),
    );
  } else {
    assertPrivate(home);
    assertPrivate(join(home, "config.json"));
    cfg = JSON.parse(readFileSync(join(home, "config.json"), "utf8"));
    assert.equal(cfg.format, 1);
    assert.equal(cfg.port, number(cfg.port));
    assert.equal(cfg.pgBin, realpathSync(cfg.pgBin));
    assert.match(cfg.jwt, /^[0-9a-f]{96}$/);
    for (const role of ["hms_owner", "hms_runtime", "hms_cleanup"])
      assert.match(cfg.passwords[role], /^[0-9a-f]{64}$/);
    versions(cfg.pgBin);
    mkdirSync(join(home, ".operation"), { mode: 0o700 });
    locked = true;
    start();
    running = true;
    await connect();
    if (command === "backup") {
      assert.ok(options.out, "--out required");
      const out = resolve(options.out);
      assert.ok(
        out !== root && !out.startsWith(root + "/"),
        "Private backup must be outside the repository",
      );
      assert.ok(!existsSync(out), "Backup destination must not exist");
      mkdirSync(out, { mode: 0o700 });
      const before = await snapshot();
      const archive = join(out, "fictional.dump");
      run(bin("pg_dump"), ["--format=custom", "--file=" + archive], dbEnv());
      chmodSync(archive, 0o600);
      assert.deepEqual(
        await snapshot(),
        before,
        "Source changed; discard incomplete backup",
      );
      privateWrite(join(out, "recovery-key"), cfg.jwt);
      privateWrite(
        join(out, "manifest.json"),
        JSON.stringify(
          {
            format: 1,
            createdAt: new Date().toISOString(),
            postgresMajor: run(bin("postgres"), ["--version"]).match(/\d+/)[0],
            archiveSha256: hash(readFileSync(archive)),
            snapshot: before,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        JSON.stringify({
          command,
          directory: out,
          containsPrivateRecoveryKey: true,
          tables: before.rows.length,
          archiveSha256: hash(readFileSync(archive)),
          sourceUnchanged: true,
        }),
      );
    } else if (command === "verify")
      console.log(
        JSON.stringify({
          command,
          proof: await security(),
          tables: (await snapshot()).rows.map(({ table, count }) => ({
            table,
            count,
          })),
        }),
      );
    else {
      const httpPort = number(options["http-port"], 4380);
      assert.notEqual(httpPort, cfg.port);
      await assertPortFree(httpPort);
      await client.$disconnect();
      client = null;
      const cleanup = new PrismaClient({
        datasources: { db: { url: url("hms_cleanup") } },
      });
      let timer,
        app,
        finishing,
        signalReceived = false;
      const finish = () =>
        (finishing ??= (async () => {
          clearInterval(timer);
          if (app && app.exitCode === null) {
            app.kill("SIGTERM");
            await new Promise((r) => app.once("exit", r));
          }
          await cleanup.$disconnect();
        })());
      try {
        await cleanup.$queryRawUnsafe(
          "SELECT hms_cleanup_expired_workspaces()",
        );
        timer = setInterval(
          () =>
            cleanup
              .$queryRawUnsafe("SELECT hms_cleanup_expired_workspaces()")
              .catch(() =>
                console.error(
                  "Local cleanup heartbeat failed; requests will fail closed if stale",
                ),
              ),
          60000,
        );
        const env = {
          ...cleanEnv(),
          DATABASE_URL: url("hms_runtime"),
          JWT_SECRET: cfg.jwt,
          HMS_PUBLIC_DEMO: "true",
          HMS_LOCAL_DEMO_LOOPBACK: "true",
          HMS_QUALIFICATION_MODE: "false",
          HMS_RATE_LIMIT_IDENTITY: "",
          HMS_TRUSTED_PROXY_ADDRESSES: "",
          PORT: String(httpPort),
          FRONTEND_URL: "http://127.0.0.1:" + httpPort,
        };
        app = spawn(process.execPath, ["dist/src/main.js"], {
          cwd: backend,
          env,
          stdio: ["ignore", "ignore", "ignore"],
        });
        const signal = () => {
          signalReceived = true;
          void finish();
        };
        process.once("SIGINT", signal);
        process.once("SIGTERM", signal);
        let ready = false;
        for (let i = 0; i < 150; i++) {
          if (app.exitCode !== null)
            throw Error("Local app exited; run build and verify prerequisites");
          try {
            if (
              (await fetch("http://127.0.0.1:" + httpPort + "/api/v1/health"))
                .status === 200
            ) {
              ready = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(ready, "Local app readiness timeout");
        console.log(
          JSON.stringify({
            command,
            url: "http://127.0.0.1:" + httpPort,
            fictionalOnly: true,
            foreground: true,
            stop: "Ctrl+C stops app and database; files retained",
          }),
        );
        await new Promise((r) =>
          app.exitCode !== null ? r() : app.once("exit", r),
        );
        assert.ok(signalReceived, "Local app stopped unexpectedly");
        process.removeListener("SIGINT", signal);
        process.removeListener("SIGTERM", signal);
      } finally {
        await finish();
      }
    }
  }
} catch (error) {
  console.error(
    JSON.stringify({
      command,
      error: error instanceof Error ? error.message : "Local operation failed",
      directory: home,
      retained: true,
    }),
  );
  process.exitCode = 1;
} finally {
  await client?.$disconnect();
  if (running)
    try {
      stop();
    } catch {
      console.error("Database stop failed; inspect private local log");
      process.exitCode = 1;
    }
  if (locked)
    rmSync(join(home, ".operation"), { recursive: true, force: true });
}
