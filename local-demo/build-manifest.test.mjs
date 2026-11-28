import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  createManifest,
  verifyManifest,
  INPUT_FILES,
  INPUT_ROOTS,
  OUTPUT_ROOTS,
  MANIFEST,
  LIMITS,
} from "./build-manifest.mjs";
function fixture(t) {
  const root = fs.mkdtempSync("/tmp/hms-build-snapshot-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(join(root, "local-demo"));
  for (const p of [
    ...INPUT_FILES,
    ...INPUT_ROOTS.map((p) => p + "/sample.ts"),
    ...OUTPUT_ROOTS.map((p) => p + "/sample.js"),
  ]) {
    fs.mkdirSync(join(root, p, ".."), { recursive: true });
    fs.writeFileSync(join(root, p), "fixture");
  }
  return root;
}
const read = (r) => JSON.parse(fs.readFileSync(join(r, MANIFEST), "utf8"));
const write = (r, j) =>
  fs.writeFileSync(join(r, MANIFEST), JSON.stringify(j, null, 2) + "\n");
function snapshot(root) {
  const out = {};
  function walk(p) {
    for (const n of fs.readdirSync(p)) {
      const f = join(p, n),
        s = fs.lstatSync(f);
      if (s.isDirectory()) walk(f);
      else
        out[f] = s.isSymbolicLink()
          ? "LINK:" + fs.readlinkSync(f)
          : fs.readFileSync(f).toString("hex");
    }
  }
  walk(root);
  return out;
}
test("absent warns, create is0600 canonical and matching verify is read-only", (t) => {
  const r = fixture(t);
  assert.equal(verifyManifest(r).status, "warn");
  assert.equal(createManifest(r).published, true);
  assert.equal(fs.statSync(join(r, MANIFEST)).mode & 0o777, 0o600);
  const before = snapshot(r);
  assert.equal(verifyManifest(r).status, "pass");
  assert.deepEqual(snapshot(r), before);
  assert.equal(createManifest(r).published, false);
  assert.deepEqual(snapshot(r), before);
});
for (const [name, p, op] of [
  ["changed source", "backend/src/sample.ts", "change"],
  ["changed lock", "backend/package-lock.json", "change"],
  ["changed schema", "backend/prisma/schema.prisma", "change"],
  ["changed migration", "backend/prisma/migrations/sample.ts", "change"],
  ["changed output", "frontend/dist/sample.js", "change"],
  ["missing output", "backend/dist/sample.js", "delete"],
  ["extra output", "frontend/dist/extra.js", "new"],
  ["new input", "backend/test/extra.ts", "new"],
  ["optional public appearance", "frontend/public/extra.txt", "new"],
])
  test(name, (t) => {
    const r = fixture(t);
    createManifest(r);
    if (op === "delete") fs.unlinkSync(join(r, p));
    else {
      fs.mkdirSync(join(r, p, ".."), { recursive: true });
      fs.writeFileSync(join(r, p), "altered");
    }
    const v = verifyManifest(r);
    assert.equal(v.status, "fail");
    assert.ok(v.detail.includes("deliberate rebuild"));
    assert.ok(!JSON.stringify(v).includes(r));
  });
for (const [name, mutate] of [
  ["version", (j) => (j.version = 2)],
  ["unknown key", (j) => (j.extra = true)],
  ["digest", (j) => (j.inputs[0].sha256 = "x".repeat(64))],
  ["negative bytes", (j) => (j.inputs[0].bytes = -1)],
  ["duplicate path", (j) => j.inputs.splice(1, 0, j.inputs[0])],
  ["unsorted", (j) => j.inputs.reverse()],
  ["traversal", (j) => (j.inputs[0].path = "../secret")],
  ["absolute", (j) => (j.inputs[0].path = "/secret")],
  ["backslash", (j) => (j.inputs[0].path = "backend\\secret")],
  ["unlisted", (j) => (j.inputs[0].path = "local-demo/build-manifest.json")],
  ["decomposed unicode", (j) => (j.inputs[0].path = "backend/src/e\u0301.ts")],
  ["file size", (j) => (j.inputs[0].bytes = LIMITS.file + 1)],
])
  test("strict schema rejects " + name, (t) => {
    const r = fixture(t);
    createManifest(r);
    const j = read(r);
    mutate(j);
    write(r, j);
    assert.equal(verifyManifest(r).status, "fail");
  });
test("duplicate object key and noncanonical whitespace rejected", (t) => {
  const r = fixture(t);
  createManifest(r);
  const p = join(r, MANIFEST),
    text = fs.readFileSync(p, "utf8");
  fs.writeFileSync(
    p,
    text.replace('"version": 1', '"version": 1, "version": 1'),
  );
  assert.equal(verifyManifest(r).code, "noncanonical-json");
  fs.writeFileSync(p, " " + text);
  assert.equal(verifyManifest(r).code, "noncanonical-json");
  fs.writeFileSync(p, "{");
  assert.equal(verifyManifest(r).code, "malformed-json");
});
test("oversize manifest checked before parse", (t) => {
  const r = fixture(t);
  fs.writeFileSync(join(r, MANIFEST), " ".repeat(LIMITS.manifest + 1));
  assert.equal(verifyManifest(r).code, "manifest-size-limit");
});
for (const p of [
  "backend/src/sample.ts",
  "frontend/dist",
  "local-demo/build-manifest.json",
])
  test("symlink refusal " + p, (t) => {
    const r = fixture(t);
    createManifest(r);
    fs.rmSync(join(r, p), { recursive: true });
    fs.symlinkSync("/nonexistent", join(r, p));
    const v = verifyManifest(r);
    assert.equal(v.status, "fail");
    assert.equal(v.code, "symlink");
  });
test("nonregular selected input rejected without reading FIFO", (t) => {
  const r = fixture(t);
  fs.unlinkSync(join(r, "backend/src/sample.ts"));
  fs.symlinkSync("/dev/zero", join(r, "backend/src/sample.ts"));
  assert.equal(createManifest(r).published, false);
});
test("env basename rejected without reading contents, local-demo and deps excluded", (t) => {
  const r = fixture(t);
  fs.writeFileSync(join(r, "local-demo/private.txt"), "PRIVATE-SENTINEL");
  fs.mkdirSync(join(r, "backend/node_modules"), { recursive: true });
  fs.writeFileSync(join(r, "backend/node_modules/secret"), "PRIVATE-SENTINEL");
  assert.equal(createManifest(r).published, true);
  assert.ok(
    !fs.readFileSync(join(r, MANIFEST), "utf8").includes("PRIVATE-SENTINEL"),
  );
  fs.unlinkSync(join(r, MANIFEST));
  fs.writeFileSync(join(r, "backend/src/.env.secret"), "PRIVATE-SENTINEL");
  const v = createManifest(r);
  assert.equal(v.published, false);
  assert.equal(v.code, "unsafe-path");
  assert.ok(!JSON.stringify(v).includes("PRIVATE-SENTINEL"));
});
test("optional public present then absent fails", (t) => {
  const r = fixture(t);
  fs.mkdirSync(join(r, "frontend/public"));
  fs.writeFileSync(join(r, "frontend/public/icon.svg"), "svg");
  assert.equal(createManifest(r).published, true);
  assert.equal(verifyManifest(r).status, "pass");
  fs.rmSync(join(r, "frontend/public"), { recursive: true });
  assert.equal(verifyManifest(r).status, "fail");
});
test("checker3hash crosscheck mismatch fails", (t) => {
  const r = fixture(t);
  createManifest(r);
  assert.equal(
    verifyManifest(r, { "backend/package-lock.json": "0".repeat(64) }).status,
    "fail",
  );
});
test("perfile sparse cap fails without giant read", (t) => {
  const r = fixture(t);
  const fd = fs.openSync(join(r, "frontend/dist/big.js"), "w");
  fs.ftruncateSync(fd, LIMITS.file + 1);
  fs.closeSync(fd);
  assert.equal(createManifest(r).code, "file-size-limit");
});
test("entry cap enforced before hashing", (t) => {
  const r = fixture(t);
  for (let i = 0; i < LIMITS.entries; i++)
    fs.writeFileSync(join(r, "frontend/dist", i + ".js"), "");
  assert.equal(createManifest(r).code, "entry-limit");
});
test("missing local-demo is warn for legacy verifier but creation never mkdir", (t) => {
  const r = fixture(t);
  fs.rmdirSync(join(r, "local-demo"));
  assert.equal(verifyManifest(r).status, "warn");
  assert.equal(createManifest(r).published, false);
  assert.equal(fs.existsSync(join(r, "local-demo")), false);
});
function child(r) {
  return new Promise((ok, bad) => {
    const code = `import {createManifest} from ${JSON.stringify(pathToFileURL(new URL("./build-manifest.mjs", import.meta.url).pathname).href)};console.log(JSON.stringify(createManifest(process.argv[1])));`;
    const p = spawn(process.execPath, ["--input-type=module", "-e", code, r]);
    let s = "";
    p.stdout.on("data", (x) => (s += x));
    p.on("error", bad);
    p.on("close", () => {
      try {
        ok(JSON.parse(s));
      } catch (e) {
        bad(e);
      }
    });
  });
}
test("concurrent creators exactlyonewinner and no temp leftovers", async (t) => {
  const r = fixture(t);
  const results = await Promise.all([child(r), child(r)]);
  assert.equal(results.filter((x) => x.published).length, 1);
  assert.equal(verifyManifest(r).status, "pass");
  assert.deepEqual(fs.readdirSync(join(r, "local-demo")), [
    "build-manifest.json",
  ]);
});
async function faultChild(r, patch, operation = "createManifest") {
  const moduleUrl = new URL("./build-manifest.mjs", import.meta.url).href;
  const code = `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';${patch};syncBuiltinESMExports();const m=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(m.${operation}(process.argv[1])));`;
  return new Promise((ok, bad) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", code, r]);
    let s = "",
      err = "";
    p.stdout.on("data", (x) => (s += x));
    p.stderr.on("data", (x) => (err += x));
    p.on("error", bad);
    p.on("close", () => {
      try {
        ok(JSON.parse(s));
      } catch {
        bad(Error(err || s));
      }
    });
  });
}
test("hardlink unsupported leaves no final or temp", async (t) => {
  const r = fixture(t);
  const v = await faultChild(
    r,
    "fs.linkSync=()=>{const e=Error();e.code='ENOTSUP';throw e}",
  );
  assert.equal(v.published, false);
  assert.equal(v.code, "ENOTSUP");
  assert.deepEqual(fs.readdirSync(join(r, "local-demo")), []);
});
test("directory fsync failure reports publication with durability unverified", async (t) => {
  const r = fixture(t);
  const v = await faultChild(
    r,
    "const original=fs.fsyncSync;fs.fsyncSync=(fd)=>{if(fs.fstatSync(fd).isDirectory())throw Error('fixture');return original(fd)}",
  );
  assert.equal(v.published, true);
  assert.equal(v.directoryDurability, "unverified");
  assert.equal(verifyManifest(r).status, "pass");
});
test("write failure cleans temporary file and never publishes", async (t) => {
  const r = fixture(t);
  const v = await faultChild(
    r,
    "fs.writeFileSync=()=>{const e=Error();e.code='ENOSPC';throw e}",
  );
  assert.equal(v.published, false);
  assert.deepEqual(fs.readdirSync(join(r, "local-demo")), []);
});
test("capture detects input modification during read without publication", async (t) => {
  const r = fixture(t);
  const v = await faultChild(
    r,
    "const opened=new Map();const open=fs.openSync;fs.openSync=(p,...a)=>{const fd=open(p,...a);opened.set(fd,String(p));return fd};const original=fs.readSync;let changed=false;fs.readSync=(...a)=>{const n=original(...a);if(!changed && a[1]?.length===65536 && opened.get(a[0])?.endsWith('/backend/src/sample.ts')){changed=true;fs.appendFileSync(process.argv[1]+'/backend/src/sample.ts','race')}return n}",
  );
  assert.equal(v.published, false);
  assert.ok(["changed-during-read", "changed-during-capture"].includes(v.code));
  assert.deepEqual(fs.readdirSync(join(r, "local-demo")), []);
});
test("capture detects output addition during read without publication", async (t) => {
  const r = fixture(t);
  const v = await faultChild(
    r,
    "const original=fs.readSync;let changed=false;fs.readSync=(...a)=>{const n=original(...a);if(!changed && a[1]?.length===65536){changed=true;fs.writeFileSync(process.argv[1]+'/frontend/dist/race.js','race')}return n}",
  );
  assert.equal(v.published, false);
  assert.equal(v.code, "changed-during-capture");
  assert.deepEqual(fs.readdirSync(join(r, "local-demo")), []);
});
test("schema total-size bound rejects before hashing", (t) => {
  const r = fixture(t);
  createManifest(r);
  const j = read(r);
  for (const e of j.inputs) e.bytes = LIMITS.file;
  write(r, j);
  assert.equal(verifyManifest(r).code, "total-size-limit");
});
test("manifest plus local-demo source changes are not hashed", (t) => {
  const r = fixture(t);
  createManifest(r);
  fs.writeFileSync(join(r, "local-demo/not-input.mjs"), "changed");
  assert.equal(verifyManifest(r).status, "pass");
  assert.ok(!read(r).inputs.some((x) => x.path.startsWith("local-demo/")));
});

// Exercise the actual fixed-root CLI from a disposable copy, not library status only.
test("explicit CLI verify missing manifest fails while library remains warning", async (t) => {
  const r = fixture(t);
  fs.copyFileSync(
    new URL("./build-manifest.mjs", import.meta.url),
    join(r, "local-demo/build-manifest.mjs"),
  );
  const result = await new Promise((ok, bad) => {
    const p = spawn(process.execPath, [
      join(r, "local-demo/build-manifest.mjs"),
      "verify",
    ]);
    let out = "";
    p.stdout.on("data", (x) => (out += x));
    p.on("error", bad);
    p.on("close", (code) => ok({ code, out }));
  });
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.out).status, "warn");
  assert.equal(verifyManifest(r).status, "warn");
});
