import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { inspect } from "./check-ready.mjs";
const files = [
  "backend/dist/src/main.js",
  "frontend/dist/index.html",
  "backend/node_modules/@prisma/client/package.json",
  "backend/node_modules/prisma/build/index.js",
  "backend/node_modules/.prisma/client/index.js",
  "backend/node_modules/bcrypt/package.json",
  "backend/package-lock.json",
  "frontend/package-lock.json",
  "backend/prisma/schema.prisma",
];
const tools = [
  "postgres",
  "initdb",
  "pg_ctl",
  "psql",
  "createdb",
  "pg_dump",
  "pg_restore",
];
function fixture() {
  const dir = mkdtempSync("/tmp/hms-readiness-test-"),
    root = join(dir, "repo"),
    bin = join(dir, "bin");
  mkdirSync(root);
  mkdirSync(bin);
  for (const f of files) {
    mkdirSync(join(root, f, ".."), { recursive: true });
    writeFileSync(join(root, f), "{}");
  }
  writeFileSync(
    join(
      root,
      "backend/node_modules/.prisma/client/libquery_engine-test.so.node",
    ),
    "fixture",
  );
  for (const n of tools)
    writeFileSync(
      join(bin, n),
      '#!/bin/sh\nprintf "tool (PostgreSQL) 17.1\\n"\n',
      { mode: 0o755 },
    );
  return {
    dir,
    root,
    pgBin: bin,
    target: join(dir, "private-demo"),
    native: false,
    pgPort: 55781,
    httpPort: 55782,
  };
}
const failed = (r, id) =>
  r.checks.some((c) => c.id === id && c.status === "fail");
function snapshot(path) {
  const out = {};
  function walk(p) {
    for (const n of readdirSync(p)) {
      const f = join(p, n);
      if (statSync(f).isDirectory()) walk(f);
      else out[f] = readFileSync(f).toString("hex");
    }
  }
  walk(path);
  return out;
}
test("complete fixture diagnoses without creating target or changing fixture bytes", async () => {
  const f = fixture(),
    before = snapshot(f.dir);
  const r = await inspect(f);
  assert.equal(r.ready, true);
  assert.equal(existsSync(f.target), false);
  assert.deepEqual(snapshot(f.dir), before);
  assert.ok(
    r.checks.some((c) => c.id === "build-provenance" && c.status === "warn"),
  );
  rmSync(f.dir, { recursive: true });
});
test("missing dependencies/tools reports all failures rather than crashing on import", async () => {
  const f = fixture();
  rmSync(join(f.root, "backend/node_modules"), { recursive: true });
  rmSync(join(f.pgBin, "pg_dump"));
  const r = await inspect(f);
  assert.ok(failed(r, "postgres-pg_dump"));
  assert.ok(failed(r, "prisma-engine-file"));
  assert.equal(existsSync(f.target), false);
  rmSync(f.dir, { recursive: true });
});
test("mixed major is rejected", async () => {
  const f = fixture();
  writeFileSync(
    join(f.pgBin, "pg_dump"),
    '#!/bin/sh\necho "pg_dump (PostgreSQL) 18.0"\n',
    { mode: 0o755 },
  );
  assert.ok(failed(await inspect(f), "postgres-matching"));
  rmSync(f.dir, { recursive: true });
});
test("existing target and absent build rejected", async () => {
  const f = fixture();
  mkdirSync(f.target);
  rmSync(join(f.root, "frontend/dist/index.html"));
  const r = await inspect(f);
  assert.ok(failed(r, "target"));
  assert.ok(failed(r, "file-frontend/dist/index.html"));
  rmSync(f.dir, { recursive: true });
});
test("native-load failure is actionable and does not expose child stderr", async () => {
  const f = fixture();
  const r = await inspect({ ...f, native: true });
  assert.ok(failed(r, "dependency-load"));
  assert.ok(!JSON.stringify(r).includes("MODULE_NOT_FOUND"));
  rmSync(f.dir, { recursive: true });
});
test("occupied port is reported without stopping listener", async () => {
  const f = fixture(),
    server = createServer();
  await new Promise((r) => server.listen(f.pgPort, "127.0.0.1", r));
  try {
    assert.ok(failed(await inspect(f), "postgres-port"));
    assert.equal(server.listening, true);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(f.dir, { recursive: true });
  }
});

test("parent file, dangling target symlink and repository alias are rejected", async () => {
  const f = fixture();
  writeFileSync(join(f.dir, "file"), "x");
  assert.ok(
    failed(
      await inspect({ ...f, target: join(f.dir, "file", "new") }),
      "target",
    ),
  );
  symlinkSync(join(f.dir, "missing"), f.target);
  assert.ok(failed(await inspect(f), "target"));
  rmSync(f.target);
  symlinkSync(f.root, join(f.dir, "repo-alias"));
  assert.ok(
    failed(
      await inspect({ ...f, target: join(f.dir, "repo-alias", "new") }),
      "target",
    ),
  );
  rmSync(f.dir, { recursive: true });
});
function loadFixtures(f, hang = false) {
  writeFileSync(
    join(f.root, "backend/node_modules/@prisma/client/package.json"),
    JSON.stringify({ main: "index.js" }),
  );
  writeFileSync(
    join(f.root, "backend/node_modules/@prisma/client/index.js"),
    hang ? "for(;;){}" : "exports.PrismaClient=function(){};",
  );
  writeFileSync(
    join(f.root, "backend/node_modules/bcrypt/package.json"),
    JSON.stringify({ main: "index.js" }),
  );
  writeFileSync(
    join(f.root, "backend/node_modules/bcrypt/index.js"),
    "exports.hashSync=function(){};",
  );
}
test("bounded module child succeeds with controlled trusted fixture", async () => {
  const f = fixture();
  loadFixtures(f);
  const before = snapshot(f.dir);
  const r = await inspect({ ...f, native: true });
  assert.equal(r.ready, true);
  assert.deepEqual(snapshot(f.dir), before);
  rmSync(f.dir, { recursive: true });
});
test("tool and module direct-child timeouts are reported", async () => {
  const f = fixture();
  writeFileSync(join(f.pgBin, "postgres"), "#!/bin/sh\nwhile :; do :; done\n", {
    mode: 0o755,
  });
  loadFixtures(f, true);
  const start = Date.now();
  const r = await inspect({
    ...f,
    native: true,
    probeTimeoutMs: 50,
    moduleTimeoutMs: 50,
  });
  assert.ok(failed(r, "postgres-postgres"));
  assert.ok(failed(r, "dependency-load"));
  assert.ok(Date.now() - start < 3000);
  assert.ok(JSON.stringify(r).includes("timed out"));
  rmSync(f.dir, { recursive: true });
});
test("filesystem errors do not expose absolute fixture paths", async () => {
  const f = fixture();
  rmSync(join(f.root, "backend/dist/src/main.js"));
  const r = await inspect(f);
  assert.ok(!JSON.stringify(r).includes(f.dir));
  rmSync(f.dir, { recursive: true });
});
