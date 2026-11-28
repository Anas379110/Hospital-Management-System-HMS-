# HMS local fictional demo and recovery

A local runnable version of the same fictional HMS demo. No Supabase, Render, account or paid service is needed at runtime. This is not a hospital installation or an offline dependency installer. Linux/macOS, Node 22, a compatible PostgreSQL 17 or 18 server/client binary directory and the repository's installed, built dependencies are required. Do not use real patient, staff, password or payment data.

## Build once while dependencies are available

From repository root:

```sh
(cd backend && npm ci --ignore-scripts && node node_modules/prisma/build/index.js generate && npm run build)
(cd frontend && npm ci --ignore-scripts && VITE_PUBLIC_DEMO=true npm run build)
```

Use an unprivileged OS user, not root. PostgreSQL binary directory must contain initdb, postgres, pg_ctl, psql, createdb, pg_dump and pg_restore of the same major. No new database/architecture choice is made here.

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
