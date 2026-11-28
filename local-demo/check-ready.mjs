#!/usr/bin/env node
// Diagnostic only. No DB connection, install, build or target creation.
import {
  accessSync,
  constants,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function inspect({
  root = defaultRoot,
  pgBin,
  target,
  pgPort = 55432,
  httpPort = 4380,
  native = true,
  probeTimeoutMs = 5000,
  moduleTimeoutMs = 10000,
} = {}) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const check = (id, fn) => {
    try {
      add(id, "pass", fn());
    } catch (e) {
      add(
        id,
        "fail",
        e.code
          ? "Filesystem or process check failed (" +
              e.code +
              "); inspect the named prerequisite."
          : e.message,
      );
    }
  };
  if (
    !Number.isInteger(probeTimeoutMs) ||
    probeTimeoutMs < 20 ||
    probeTimeoutMs > 5000 ||
    !Number.isInteger(moduleTimeoutMs) ||
    moduleTimeoutMs < 20 ||
    moduleTimeoutMs > 10000
  )
    throw Error("Probe timeout outside bounded range.");
  const present = (p) => {
    try {
      lstatSync(p);
      return true;
    } catch (e) {
      if (e.code === "ENOENT") return false;
      throw e;
    }
  };
  root = realpathSync(root);
  check("node", () => {
    if (Number(process.versions.node.split(".")[0]) !== 22)
      throw Error("Use Node22, the tested runtime.");
    return process.version;
  });
  check("platform", () => {
    if (!["linux", "darwin"].includes(process.platform))
      throw Error(
        "Only Linux/macOS local kit paths are supported; Windows not qualified.",
      );
    return process.platform + "/" + process.arch;
  });
  check("unprivileged", () => {
    if (process.getuid?.() === 0)
      throw Error("PostgreSQL initdb requires an unprivileged user.");
    return "Current OS user is unprivileged.";
  });
  check("target", () => {
    if (!target)
      throw Error("Supply --dir for the future private demo target.");
    target = resolve(target);
    if (target === root || target.startsWith(root + "/") || target === "/")
      throw Error("Choose target outside repository.");
    if (present(target))
      throw Error("Target already exists; init never overwrites.");
    let parent = dirname(target);
    while (!present(parent)) {
      const next = dirname(parent);
      if (next === parent) throw Error("No existing parent.");
      parent = next;
    }
    if (!lstatSync(parent).isDirectory() && !lstatSync(parent).isSymbolicLink())
      throw Error("Nearest existing parent is not a directory.");
    const actual = realpathSync(parent);
    if (!lstatSync(actual).isDirectory())
      throw Error("Resolved parent is not a directory.");
    if (actual === root || actual.startsWith(root + "/"))
      throw Error("Target resolves inside repository through a symlink.");
    accessSync(parent, constants.W_OK | constants.X_OK);
    return "Target absent; nearest existing parent is writable. No target created.";
  });
  const versions = [];
  for (const name of [
    "postgres",
    "initdb",
    "pg_ctl",
    "psql",
    "createdb",
    "pg_dump",
    "pg_restore",
  ])
    check("postgres-" + name, () => {
      if (!pgBin)
        throw Error(
          "Supply --pg-bin with matching PostgreSQL17/18 server and clients.",
        );
      const path = join(resolve(pgBin), name);
      accessSync(path, constants.X_OK);
      const r = spawnSync(path, ["--version"], {
        encoding: "utf8",
        timeout: probeTimeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 65536,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
        },
      });
      if (r.error?.code === "ETIMEDOUT")
        throw Error(
          "Direct child probe timed out; descendants are not managed.",
        );
      if (r.error || r.status !== 0)
        throw Error(
          "Tool could not run; check native libraries and executable compatibility.",
        );
      const major = r.stdout.match(/PostgreSQL\)?\s+(\d+)/)?.[1];
      if (!["17", "18"].includes(major))
        throw Error("PostgreSQL17/18 required.");
      versions.push(major);
      return "PostgreSQL" + major;
    });
  check("postgres-matching", () => {
    if (versions.length !== 7 || new Set(versions).size !== 1)
      throw Error("All seven tools must run and share one supported major.");
    return versions[0];
  });
  for (const f of [
    "backend/dist/src/main.js",
    "frontend/dist/index.html",
    "backend/node_modules/@prisma/client/package.json",
    "backend/node_modules/prisma/build/index.js",
    "backend/node_modules/.prisma/client/index.js",
    "backend/node_modules/bcrypt/package.json",
  ])
    check("file-" + f, () => {
      const p = join(root, f);
      if (!lstatSync(p).isFile())
        throw Error(
          "Required regular file missing. Follow build commands, not checker auto-install.",
        );
      accessSync(p, constants.R_OK);
      return "Present/readable.";
    });
  check("prisma-engine-file", () => {
    const dir = join(root, "backend/node_modules/.prisma/client");
    const names = readdirSync(dir).filter((n) =>
      /query_engine.*\.(node|so|dylib|exe)$/.test(n),
    );
    if (!names.length)
      throw Error(
        "Generated native Prisma engine missing; run Prisma generate for this platform.",
      );
    return (
      names.join(", ") + "; presence only, DB/engine execution not tested."
    );
  });
  if (native)
    check("dependency-load", () => {
      // Installed dependency JS/native code executes in this child. This is not a sandbox.
      const code =
        "const{createRequire}=require('node:module');const r=createRequire(process.cwd()+'/backend/package.json');const p=r('@prisma/client');if(typeof p.PrismaClient!=='function')throw Error('Prisma generation missing');const b=r('bcrypt');if(typeof b.hashSync!=='function')throw Error('bcrypt addon unavailable');";
      const r = spawnSync(process.execPath, ["-e", code], {
        cwd: root,
        encoding: "utf8",
        timeout: moduleTimeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 65536,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
        },
      });
      if (r.error?.code === "ETIMEDOUT")
        throw Error(
          "Direct child probe timed out; descendants are not managed.",
        );
      if (r.error || r.status !== 0)
        throw Error(
          "Prisma/bcrypt load failed; rebuild trusted dependencies on this OS. No DB attempted by checker.",
        );
      return "Trusted installed Prisma and bcrypt load in bounded child; third-party code executes, not sandboxed.";
    });
  else
    add(
      "dependency-load",
      "warn",
      "Skipped native module loading; runtime readiness unverified.",
    );
  const hashes = {};
  for (const f of [
    "backend/package-lock.json",
    "frontend/package-lock.json",
    "backend/prisma/schema.prisma",
  ])
    check("hash-" + f, () => {
      const h = createHash("sha256")
        .update(readFileSync(join(root, f)))
        .digest("hex");
      hashes[f] = h;
      return h;
    });
  add(
    "build-provenance",
    "warn",
    "No signed/source-linked build manifest in released kit. Current hashes identify inputs only, not proof built assets match them.",
  );
  if (pgPort === httpPort)
    add("ports-distinct", "fail", "PostgreSQL and HTTP ports must differ.");
  for (const [id, port] of [
    ["postgres-port", pgPort],
    ["http-port", httpPort],
  ]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      add(id, "fail", "Choose an unprivileged port1024..65535.");
      continue;
    }
    const s = createServer();
    try {
      await new Promise((ok, fail) => {
        s.once("error", fail);
        s.listen(port, "127.0.0.1", () => s.close(ok));
      });
      add(
        id,
        "pass",
        "Loopback bind-and-close succeeded; availability can race before start.",
      );
    } catch {
      add(
        id,
        "fail",
        "Loopback port unavailable. No existing process stopped.",
      );
    }
  }
  return {
    ready: checks.every((c) => c.status !== "fail"),
    checks,
    inputHashes: hashes,
    commands: [
      "(cd backend && npm ci --ignore-scripts && node node_modules/prisma/build/index.js generate && npm run build)",
      "(cd frontend && npm ci --ignore-scripts && VITE_PUBLIC_DEMO=true npm run build)",
    ],
    limits: [
      "No database connection/init, target creation, install/build or outbound request by checker-controlled code.",
      "--version tools and module load execute installed code, not a sandbox or universal no-side-effects guarantee. Use trusted installations.",
      "No offline installer, OS-wide air-gap, free-disk guarantee, actual engine/DB compatibility or hospital commissioning qualification.",
    ],
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const options = {};
  try {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      if (
        !["--pg-bin", "--dir", "--pg-port", "--http-port"].includes(args[i]) ||
        !args[i + 1]
      )
        throw Error(
          "Usage: node local-demo/check-ready.mjs --pg-bin PATH --dir ABSENT_PRIVATE_DIR [--pg-port N --http-port N]",
        );
      options[args[i]] = args[i + 1];
    }
    const r = await inspect({
      pgBin: options["--pg-bin"],
      target: options["--dir"],
      pgPort: Number(options["--pg-port"] ?? 55432),
      httpPort: Number(options["--http-port"] ?? 4380),
    });
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = r.ready ? 0 : 1;
  } catch (e) {
    console.error(JSON.stringify({ ready: false, error: e.message }));
    process.exitCode = 1;
  }
}
