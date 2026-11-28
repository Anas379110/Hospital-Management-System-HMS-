#!/usr/bin/env node
// Unsigned accidental-drift snapshot, not build causality or authenticity.
import * as fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MANIFEST = "local-demo/build-manifest.json";
export const LIMITS = Object.freeze({
  file: 25 * 1024 * 1024,
  total: 256 * 1024 * 1024,
  entries: 4096,
  manifest: 1024 * 1024,
  path: 1024,
  depth: 32,
});
export const RECIPE = Object.freeze([
  "(cd backend && npm ci --ignore-scripts && node node_modules/prisma/build/index.js generate && npm run build)",
  "(cd frontend && npm ci --ignore-scripts && VITE_PUBLIC_DEMO=true npm run build)",
]);
export const INPUT_FILES = Object.freeze([
  "backend/package.json",
  "backend/package-lock.json",
  "backend/tsconfig.json",
  "backend/nest-cli.json",
  "backend/prisma/schema.prisma",
  "backend/prisma/seed.ts",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/tsconfig.json",
  "frontend/vite.config.ts",
  "frontend/index.html",
]);
export const INPUT_ROOTS = Object.freeze([
  "backend/src",
  "backend/test",
  "backend/prisma/migrations",
  "frontend/src",
]);
export const OUTPUT_ROOTS = Object.freeze(["backend/dist", "frontend/dist"]);
const PUBLIC = "frontend/public";
const action =
  "After a deliberate rebuild, explicitly remove local-demo/build-manifest.json and run node local-demo/build-manifest.mjs create. Nothing is rebuilt or overwritten automatically.";
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (code) => {
  const e = Error(code);
  e.snapshotCode = code;
  throw e;
};
function safePath(p) {
  if (
    typeof p !== "string" ||
    !p ||
    p !== p.normalize("NFC") ||
    Buffer.byteLength(p) > LIMITS.path ||
    p.split("/").length > LIMITS.depth ||
    p.includes("\\") ||
    p.includes("\0") ||
    p
      .split("/")
      .some((x) => !x || x === "." || x === ".." || x.startsWith(".env")) ||
    p.startsWith("/") ||
    /^[A-Za-z]:/.test(p)
  )
    fail("unsafe-path");
  return p;
}
function rooted(root, p) {
  safePath(p);
  const v = resolve(root, p);
  if (!v.startsWith(root + "/")) fail("unsafe-path");
  return v;
}
function state(s) {
  return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String);
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function rootOf(root) {
  const r = resolve(root);
  if (fs.lstatSync(r).isSymbolicLink()) fail("symlink");
  return fs.realpathSync(r);
}
function checked(root, p, type) {
  const bits = safePath(p).split("/");
  let s;
  for (let i = 1; i <= bits.length; i++) {
    s = fs.lstatSync(rooted(root, bits.slice(0, i).join("/")), {
      bigint: true,
    });
    if (s.isSymbolicLink()) fail("symlink");
    if (i < bits.length && !s.isDirectory()) fail("non-directory");
  }
  if (
    (type === "file" && !s.isFile()) ||
    (type === "directory" && !s.isDirectory())
  )
    fail("non-regular");
  return s;
}
function absent(root, p) {
  // Parent components must be safe even when the final component is absent.
  const parent = p.split("/").slice(0, -1).join("/");
  if (parent) checked(root, parent, "directory");
  try {
    fs.lstatSync(rooted(root, p));
    return false;
  } catch (e) {
    if (e.code === "ENOENT") return true;
    throw e;
  }
}
function fileHash(root, p, cap = LIMITS.file) {
  const before = checked(root, p, "file");
  if (before.size > BigInt(cap)) fail("file-size-limit");
  let fd;
  try {
    fd = fs.openSync(
      rooted(root, p),
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || !same(state(before), state(opened)))
      fail("changed-during-read");
    const h = createHash("sha256"),
      buf = Buffer.alloc(65536);
    let n,
      count = 0;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) !== 0) {
      count += n;
      if (count > cap) fail("file-size-limit");
      h.update(buf.subarray(0, n));
    }
    if (
      count !== Number(before.size) ||
      !same(state(before), state(fs.fstatSync(fd, { bigint: true }))) ||
      !same(state(before), state(checked(root, p, "file")))
    )
      fail("changed-during-read");
    return {
      path: p,
      bytes: count,
      sha256: h.digest("hex"),
      identity: state(before),
    };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function capture(root) {
  const paths = { inputs: [...INPUT_FILES], outputs: [] },
    dirs = [];
  function walk(p, list) {
    const s = checked(root, p, "directory");
    dirs.push([p, state(s)]);
    const names = fs.readdirSync(rooted(root, p)).sort();
    for (const name of names) {
      const rel = safePath(p + "/" + name),
        st = checked(root, rel);
      if (st.isDirectory()) walk(rel, list);
      else {
        if (!st.isFile()) fail("non-regular");
        list.push(rel);
      }
      if (
        paths.inputs.length + paths.outputs.length + dirs.length >
        LIMITS.entries
      )
        fail("entry-limit");
    }
    if (!same(state(s), state(checked(root, p, "directory"))))
      fail("changed-during-read");
  }
  for (const p of INPUT_ROOTS) walk(p, paths.inputs);
  const publicPresent = !absent(root, PUBLIC);
  if (publicPresent) walk(PUBLIC, paths.inputs);
  for (const p of OUTPUT_ROOTS) walk(p, paths.outputs);
  let total = 0;
  for (const key of ["inputs", "outputs"]) {
    paths[key].sort();
    paths[key] = paths[key].map((p) => {
      const f = fileHash(root, p);
      total += f.bytes;
      if (total > LIMITS.total) fail("total-size-limit");
      return f;
    });
  }
  return { ...paths, publicPresent, dirs };
}
function stableCapture(root) {
  const a = capture(root),
    b = capture(root);
  if (!same(a, b)) fail("changed-during-capture");
  return a;
}
const strip = (files) =>
  files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
function documentFor(c) {
  return {
    version: 1,
    snapshotKind: "unsigned-local-integrity",
    recordedRecipe: {
      meaning: "recorded, not proven executed",
      commands: [...RECIPE],
    },
    runtime: {
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    optionalInputs: { frontendPublic: c.publicPresent },
    inputs: strip(c.inputs),
    outputs: strip(c.outputs),
  };
}
const serialize = (o) => JSON.stringify(o, null, 2) + "\n";
function keys(o, names) {
  if (
    !o ||
    typeof o !== "object" ||
    Array.isArray(o) ||
    !same(Object.keys(o).sort(), [...names].sort())
  )
    fail("invalid-schema");
}
function validate(j, text) {
  keys(j, [
    "version",
    "snapshotKind",
    "recordedRecipe",
    "runtime",
    "optionalInputs",
    "inputs",
    "outputs",
  ]);
  if (j.version !== 1 || j.snapshotKind !== "unsigned-local-integrity")
    fail("invalid-version");
  keys(j.recordedRecipe, ["meaning", "commands"]);
  if (
    j.recordedRecipe.meaning !== "recorded, not proven executed" ||
    !same(j.recordedRecipe.commands, RECIPE)
  )
    fail("invalid-recipe");
  keys(j.runtime, ["node", "platform", "arch"]);
  if (
    typeof j.runtime.node !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(j.runtime.node) ||
    !["linux", "darwin"].includes(j.runtime.platform) ||
    typeof j.runtime.arch !== "string" ||
    !/^[a-z0-9_]{1,32}$/.test(j.runtime.arch)
  )
    fail("invalid-runtime");
  keys(j.optionalInputs, ["frontendPublic"]);
  if (typeof j.optionalInputs.frontendPublic !== "boolean")
    fail("invalid-schema");
  let count = 0,
    total = 0;
  for (const cat of ["inputs", "outputs"]) {
    const arr = j[cat];
    if (!Array.isArray(arr) || !arr.length) fail("invalid-entries");
    let prev = "";
    for (const e of arr) {
      keys(e, ["path", "bytes", "sha256"]);
      safePath(e.path);
      const roots =
        cat === "inputs"
          ? [
              ...INPUT_ROOTS,
              ...(j.optionalInputs.frontendPublic ? [PUBLIC] : []),
            ]
          : OUTPUT_ROOTS;
      if (
        !roots.some((p) => e.path.startsWith(p + "/")) &&
        !(cat === "inputs" && INPUT_FILES.includes(e.path))
      )
        fail("unlisted-path");
      if (prev && prev >= e.path) fail("duplicate-or-unsorted-path");
      prev = e.path;
      if (
        !Number.isSafeInteger(e.bytes) ||
        e.bytes < 0 ||
        e.bytes > LIMITS.file ||
        typeof e.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(e.sha256)
      )
        fail("invalid-entry");
      if (++count > LIMITS.entries) fail("entry-limit");
      total += e.bytes;
      if (total > LIMITS.total) fail("total-size-limit");
    }
  }
  // Reconstruct fixed key order as well as whitespace. Duplicate JSON object keys
  // are lost by JSON.parse and cannot equal this one canonical serialization.
  const canonical = {
    version: j.version,
    snapshotKind: j.snapshotKind,
    recordedRecipe: {
      meaning: j.recordedRecipe.meaning,
      commands: j.recordedRecipe.commands,
    },
    runtime: {
      node: j.runtime.node,
      platform: j.runtime.platform,
      arch: j.runtime.arch,
    },
    optionalInputs: { frontendPublic: j.optionalInputs.frontendPublic },
    inputs: strip(j.inputs),
    outputs: strip(j.outputs),
  };
  if (serialize(canonical) !== text) fail("noncanonical-json");
  return canonical;
}
function manifestRead(root) {
  const s = checked(root, MANIFEST, "file");
  if (s.size > BigInt(LIMITS.manifest)) fail("manifest-size-limit");
  let fd;
  try {
    fd = fs.openSync(
      rooted(root, MANIFEST),
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    if (!same(state(s), state(fs.fstatSync(fd, { bigint: true }))))
      fail("changed-during-read");
    const bytes = Buffer.alloc(Number(s.size) + 1);
    let used = 0,
      n;
    while ((n = fs.readSync(fd, bytes, used, bytes.length - used, null)) > 0) {
      used += n;
      if (used > Number(s.size)) fail("changed-during-read");
    }
    if (
      used !== Number(s.size) ||
      !same(state(s), state(fs.fstatSync(fd, { bigint: true }))) ||
      !same(state(s), state(checked(root, MANIFEST, "file")))
    )
      fail("changed-during-read");
    const text = bytes.subarray(0, used).toString("utf8");
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      fail("malformed-json");
    }
    return { manifest: validate(j, text), identity: state(s) };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function errorCode(e) {
  return (
    e.snapshotCode ??
    ([
      "ENOENT",
      "EACCES",
      "EPERM",
      "ELOOP",
      "ENOTDIR",
      "EEXIST",
      "ENOSPC",
      "ENOTSUP",
      "EOPNOTSUPP",
      "EXDEV",
    ].includes(e.code)
      ? e.code
      : "filesystem-or-snapshot-error")
  );
}
export function verifyManifest(root, expectedHashes = {}) {
  try {
    root = rootOf(root);
    // Older callers/fixtures need not have local-demo at all: no manifest is a warning.
    if (!fs.existsSync(join(root, "local-demo"))) {
      try {
        fs.lstatSync(join(root, "local-demo"));
        fail("symlink");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      return {
        status: "warn",
        code: "absent",
        detail:
          "No build manifest present; build provenance unverified. Run node local-demo/build-manifest.mjs create after a deliberate build.",
      };
    }
    checked(root, "local-demo", "directory");
    if (absent(root, MANIFEST))
      return {
        status: "warn",
        code: "absent",
        detail:
          "No build manifest present; build provenance unverified. Run node local-demo/build-manifest.mjs create after a deliberate build.",
      };
    const loaded = manifestRead(root),
      j = loaded.manifest,
      c = stableCapture(root);
    const differences = [];
    for (const cat of ["inputs", "outputs"]) {
      const old = new Map(j[cat].map((e) => [e.path, e])),
        now = new Map(c[cat].map((e) => [e.path, e]));
      for (const [p, e] of old)
        if (!now.has(p))
          differences.push({ category: "missing-" + cat, path: p });
        else if (!same(e, strip([now.get(p)])[0]))
          differences.push({ category: "changed-" + cat, path: p });
      for (const p of now.keys())
        if (!old.has(p)) differences.push({ category: "new-" + cat, path: p });
    }
    if (c.publicPresent !== j.optionalInputs.frontendPublic)
      differences.push({ category: "optional-root-changed", path: PUBLIC });
    for (const [p, h] of Object.entries(expectedHashes))
      if (j.inputs.find((e) => e.path === p)?.sha256 !== h)
        differences.push({
          category: "checker-input-read-changed",
          path: safePath(p),
        });
    if (!same(loaded.identity, state(checked(root, MANIFEST, "file"))))
      fail("changed-during-read");
    if (differences.length) {
      const counts = {};
      for (const d of differences)
        counts[d.category] = (counts[d.category] ?? 0) + 1;
      return {
        status: "fail",
        code: "stale-snapshot",
        detail: "Local build snapshot mismatch. " + action,
        counts,
        paths: differences.slice(0, 20).map((d) => d.path),
      };
    }
    return {
      status: "pass",
      code: "matching-unsigned-snapshot",
      detail:
        "Matches recorded unsigned local input/output snapshot; build causality and authenticity remain unverified.",
      inputCount: j.inputs.length,
      outputCount: j.outputs.length,
    };
  } catch (e) {
    return {
      status: "fail",
      code: errorCode(e),
      detail:
        "Build snapshot invalid or changed (" + errorCode(e) + "). " + action,
    };
  }
}
export function createManifest(root) {
  let temp,
    fd,
    published = false,
    result;
  try {
    root = rootOf(root);
    if (!["linux", "darwin"].includes(process.platform))
      fail("unsupported-platform");
    checked(root, "local-demo", "directory");
    if (!absent(root, MANIFEST)) fail("manifest-exists");
    const c = stableCapture(root),
      text = serialize(documentFor(c));
    if (Buffer.byteLength(text) > LIMITS.manifest) fail("manifest-size-limit");
    validate(JSON.parse(text), text);
    temp = join(
      root,
      "local-demo",
      ".build-manifest-" +
        process.pid +
        "-" +
        randomBytes(12).toString("hex") +
        ".tmp",
    );
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    checked(root, "local-demo", "directory");
    fs.linkSync(temp, join(root, MANIFEST));
    published = true;
    let directoryDurability = "synced";
    let dfd;
    try {
      dfd = fs.openSync(join(root, "local-demo"), fs.constants.O_RDONLY);
      fs.fsyncSync(dfd);
    } catch {
      directoryDurability = "unverified";
    } finally {
      if (dfd !== undefined) fs.closeSync(dfd);
    }
    result = {
      published: true,
      path: MANIFEST,
      directoryDurability,
      detail:
        "Recorded unsigned local integrity snapshot, not proof of build causality, reproducibility or authenticity. Installed dependency contents are unverified.",
    };
    return result;
  } catch (e) {
    result = {
      published,
      code: errorCode(e),
      detail: published
        ? "Snapshot published; subsequent operation failed. Directory durability unverified."
        : "Snapshot not published (" + errorCode(e) + "). " + action,
    };
    return result;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (temp)
      try {
        fs.unlinkSync(temp);
      } catch (e) {
        if (e.code !== "ENOENT" && result) {
          result.tempCleanup = "failed";
          result.detail +=
            " Temporary snapshot cleanup failed; inspect local-demo for a .build-manifest- temporary file. Final manifest was not removed.";
        }
      }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  let r;
  if (args.length !== 1 || !["create", "verify"].includes(args[0]))
    r = {
      status: "fail",
      published: false,
      detail:
        "Usage: node local-demo/build-manifest.mjs create|verify. Fixed manifest path; no overwrite option.",
    };
  else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    r = args[0] === "create" ? createManifest(root) : verifyManifest(root);
  }
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = (args[0] === "create" ? r.published : r.status === "pass")
    ? 0
    : 1;
}
