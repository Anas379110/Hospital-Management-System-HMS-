## Bounded whole-demo local outcome, 28 November 2026

Independent R2 plan and R3 source/local-outcome reviews accepted the bounded extension. Actual local PostgreSQL17r7 and18r1 both complete EN1280 and AR390 with eight fictional roles, captured entity states, one actual committed DELETE lost-reply/hold/reload/review without resend per language, stopped-source same-host independent-cluster restore, 18-table/security checks and same-origin existing sessions. Manager coverage is sequential end-state only; optional409 scenarios were not newly run. New runner helper is hashed in each report. Failed setup/observer/selector attempts are preserved, not counted as passes. No application, schema, role, retention or policy change. Exact remote CI for this changed runner is pending, not inferred from local success; deployed application remains qualificationd13de91 and no test/docs-only redeploy is required. See `docs/testing/evidence/whole-demo-local-20261128.json` (repository-root path). Whole HMS incomplete; no humanUAT, hosted-recovery, independent-media, physical power-loss, offline-installer or legal-compliance acceptance implied.

> Current28November evidence: exactCI46169159959 PG17/18 includes this production local journey/recovery runner. Reports complete EN/AR and18table independent-cluster restore. This supersedes candidate/pending status only, not original evidence limits. Latest national-ID warning is released; DOB/gender/zero-invoice decisions remain open. See docs/requirements/TRACEABILITY.md. No new execution is claimed by this documentation update.

# HMS local fictional demo and recovery

A local runnable version of the same fictional HMS demo. No Supabase, Render, account or paid service is needed at runtime. This is not a hospital installation or an offline dependency installer. Linux/macOS, Node 22, a compatible PostgreSQL 17 or 18 server/client binary directory and the repository's installed, built dependencies are required. Do not use real patient, staff, password or payment data.

## Build once while dependencies are available

From repository root:

```sh
(cd backend && npm ci --ignore-scripts && node node_modules/prisma/build/index.js generate && npm run build)
(cd frontend && npm ci --ignore-scripts && VITE_PUBLIC_DEMO=true npm run build)
```

Use an unprivileged OS user, not root. PostgreSQL binary directory must contain initdb, postgres, pg_ctl, psql, createdb, pg_dump and pg_restore of the same major. No new database/architecture choice is made here.

## Check this machine before initialization

```sh
node local-demo/check-ready.mjs --pg-bin /absolute/postgresql/bin --dir /absolute/private/hms-demo
```

This standalone Node22checker runs even without installed app dependencies. It reports each missing tool/build/dependency, matching PostgreSQLmajor, native dependency loading, futuretarget and loopbackport availability. It does not install/build, initialize/connect to a database or create the target. Port checks briefly bind127.0.0.1andclose, no guarantee against another process taking the port later. Installed PostgreSQLtools and Prisma/bcrypt code execute in bounded subprocesses, not a sandbox; use trusted installations. Timeouts kill only the directchild, not a processgroup or descendants. Checker-controlled actions do not write the inspected project or target; this is not a universal no-side-effects guarantee for third-party code. Buildprovenance and actualDB/nativeenginecompatibility remain unverified. The pinnedbcrypt6package includes prebuiltaddons, loaded at runtime via node-gyp-build; the testedLinuxx64buildrecipe works with npm ci --ignore-scripts. OtherOS/architectures may require a trusted native rebuild, and the checker will report loadfailure. Prisma generate may download a matchingengine and npm ci needs registry/cache access, so preparation is not offline. Use the build commands above to prepare dependencies, then run the checker again. A ready result is prerequisite diagnostics, not proof of offline installation or hospital suitability. Linux/macOS paths only, macOSnativeexecution not qualified by currentLinuxruns. Tests: `node --test local-demo/check-ready.test.mjs`.

## Record an optional unsigned build snapshot

After deliberately building both apps with the exact recipe above, run:

```sh
node local-demo/build-manifest.mjs create
node local-demo/build-manifest.mjs verify
```

The fixed ignored file is `local-demo/build-manifest.json`. Creation never overwrites, creates parent directories, installs, builds, starts processes or connects to a database. To regenerate after an intended rebuild, explicitly remove that fixed file yourself, then run create again. Missing snapshot is a readiness warning; a present malformed, unsafe or changed snapshot fails readiness. Matching means only that selected current bytes match the recorded unsigned local snapshot. Build provenance and causality remain unverified even when the snapshot matches. Explicit CLI verify exits nonzero for an absent snapshot; the readiness checker retains its warning-only behavior. It does not prove those outputs were built from those inputs, reproducibility, authenticity or supply-chain trust. A snapshot made after a stale build can bind wrong outputs to current inputs. Anyone with write access can regenerate it. Do not export environment/secrets or treat it as a hospital guarantee.

Inputs are the two package/lockfiles, actual tsconfig/build configs, backend src/test/seed/schema/migrations, frontend src/index.html and optional public directory. Backend compiler currently consumes its test files and seed; frontend src includes co-located tests. Migration hashes identify schema-preparation state, not compiler execution. Both complete dist roots are recorded, including backend incremental buildinfo. Frontend tsconfig.tsbuildinfo outside dist is excluded. A rebuild can stale the snapshot even when application behavior is unchanged. Test-real-postgres, test-real-browser, docs and local-demo are not build inputs here. Unlisted files are ignored; an environment-prefixed name inside a selected root fails before content is read. New files in selected roots or appearance/disappearance of frontend/public are detected.

Installed node_modules contents, generated Prisma client/engine and bcrypt addon bytes remain unverified. Existing presence/native-load checks do not attest those contents. Recorded Node/platform/architecture, recipe strings and VITE_PUBLIC_DEMO=true describe the snapshot context, not proof of execution or complete environment capture.

Linux/macOS only. Fixed limits:25MiB/file,256MiB combined,4096entries,1MiBmanifest,1024byte/32component relative paths. Canonical JSON required; manual edits/reformatting fail. Selected symlinks and nonregular files are refused. Inputs/outputs are enumerated and hashed twice with identity/stat checks to catch accidental concurrent drift, not malicious local filesystem attacks. Tempwx0600/fsync/hardlink publishes complete bytes without overwriting; unsupported hardlinks fail cleanly, no rename fallback. Directory-fsync failure reports published but durability unverified. No power-loss promise.

Snapshot verification itself is filesystem-read-only with no child/network/DB actions. The broader readiness checker still performs its separately documented bounded installed-code probes and loopback binds. Tests: `node --test local-demo/check-ready.test.mjs local-demo/build-manifest.test.mjs`.

## Start a new private local demo

Choose directories that do not exist and unused unprivileged ports. Examples below are placeholders, not existing user folders.

```sh
node local-demo/hms-local.mjs init --dir /absolute/private/hms-demo --pg-bin /absolute/postgresql/bin --port 55432
node local-demo/hms-local.mjs serve --dir /absolute/private/hms-demo --http-port 4380
```

Open the printed loopback URL. Click Start a private demo workspace and choose one of the eight fictional roles. Arabic/English work from the same production assets. Leave the command running. Ctrl+C stops the app and PostgreSQL and retains files. Another machine cannot connect to the loopback listeners. No fixed demo password is created. Web runtime has a separate restricted role; owner credentials stay in private 0600 config inside a 0700 directory. A separate local cleanup identity checks once/minute while serving. Existing 24 hour idle expiry and fictional-only notice remain in force. This is not durable hospital storage.

Stop serving before backup, restore or verification. A per-directory operation lock refuses concurrent commands. If the process was killed without cleanup, check no app/database process is running before manually clearing the lock. Do not delete an active lock. There is no automated retention or directory deletion.

## Backup and independent-cluster restore

```sh
node local-demo/hms-local.mjs backup --dir /absolute/private/hms-demo --out /absolute/private/hms-snapshot
node local-demo/hms-local.mjs restore --dir /absolute/private/hms-recovered --pg-bin /absolute/postgresql/bin --port 55433 --backup /absolute/private/hms-snapshot
node local-demo/hms-local.mjs verify --dir /absolute/private/hms-recovered
node local-demo/hms-local.mjs serve --dir /absolute/private/hms-recovered --http-port 4380
```

Backup requires the source stopped, makes a custom-format logical archive and confirms measured source rows/security unchanged. Restore creates an independent new cluster, reconstructs restricted runtime/cleanup/migration roles, restores once with exit-on-error/single-transaction, checks exact rows and measured security catalog, and verifies restricted unscoped reads/audit denial. No overwrite, clean/drop or remote database URL is supported. Same PostgreSQL major is required.

The 0700 backup includes a 0600 recovery-key so existing browser sessions can resume after recovery at the same origin. Treat the entire backup/config directory as sensitive. Never upload it to GitHub or a shared folder. The archive is integrity-hashed, not encrypted or signed. Use only a backup you created/trust. Keep it on storage you control. Copying to independent physical storage and any encryption/key custody/retention/RPO/RTO are your explicit operations decisions, not implemented policies. An expired workspace stays expired and ordinary cleanup can remove it on serve. Recovery does not promise permanent demo data retention.

## Workflow added for doctors

After creating an encounter on the patient record, the same tab remembers that doctor/patient encounter target across reloads. The doctor can order a lab or radiology test from the new form. Existing API ownership and input validation apply; no clinical approval, dosing or result amendment rules were added. The pending queue can record the result; the patient record displays completed results. Unknown order outcomes hold the form across the same tab's reload and require checking the queue, record and audit before allowing another order. No automatic retry occurs. This acknowledgment is reconciliation by the operator, not proof that an earlier request did not commit.

## Limits

Preinstalled dependencies are necessary. Browser external-network denial is narrower than an OS-wide air gap. No continued writes when local API/DB is down or offline write queue. No scheduled daily backup, automatic retention, physical disk/power-loss, legal compliance, universal accessibility, representative 10k related-history performance or real-hospital readiness claim. Pending national-ID/DOB/gender/zero-invoice choices are not changed. Qualification results must name their exact source and tested scenarios before this candidate is called released.

## Reproduce qualification

With matching PostgreSQL tools installed, built assets, and Playwright Chromium already installed:

```sh
HMS_LOCAL_PG_BIN=/absolute/postgresql/bin node frontend/test-real-browser/local-demo-recovery.cjs
```

Optional unused ports: HMS_LOCAL_PG_PORT, HMS_LOCAL_RECOVERY_PG_PORT, HMS_KIT_HTTP_PORT. HMS_BROWSER_EXECUTABLE selects an installed Chromium executable. The test creates retained private temporary fictional source/recovery clusters and a sensitive backup outside the repository. Do not upload those directories. Only browser screenshots and a nonsecret proof report go under frontend/browser-artifacts/local-demo-recovery. PostgreSQL server and clients must share a major and have their native libraries installed; a bare copied executable is insufficient. CI uses OS packages, not bundled database binaries.

CI package repository setup follows PostgreSQL's Ubuntu instructions: https://www.postgresql.org/download/linux/ubuntu/ . PostgreSQL tools are installed only on the disposable runner, not added to the app's dependencies or user host automatically.
