// Fictional disposable local-only PostgreSQL qualification. Never use a live DB.
// npm ci --ignore-scripts; prisma generate; npm run build, then set HMS_RELATED_PG_BIN to matching server/client tools.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  writeFileSync,
  realpathSync,
  readFileSync,
  mkdtempSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  backend = fileURLToPath(new URL("../", import.meta.url));
const { PrismaClient } = require("@prisma/client");
// Own fresh private cluster, never accept an arbitrary connection URL.
assert.equal(
  process.env.HMS_PERFORMANCE_DATABASE_URL,
  undefined,
  "This runner owns its fresh cluster; no supplied database URL",
);
const pgBin = process.env.HMS_RELATED_PG_BIN;
assert.ok(pgBin, "HMS_RELATED_PG_BIN is required");
const cluster = mkdtempSync("/tmp/hms_test_perf_related_");
const pgPort = Number(process.env.HMS_RELATED_PG_PORT ?? 55621);
assert.ok(Number.isInteger(pgPort) && pgPort >= 1024 && pgPort <= 65535);
const pg = (name, args) => {
  const r = spawnSync(pgBin + "/" + name, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PGPASSWORD: typeof ownerPassword === "string" ? ownerPassword : "",
    },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const ownerPassword = randomBytes(24).toString("hex");
writeFileSync(cluster + "-bootstrap-password", ownerPassword, { mode: 0o600 });
pg("initdb", [
  "-D",
  cluster,
  "--auth-host=scram-sha-256",
  "--auth-local=trust",
  "--pwfile=" + cluster + "-bootstrap-password",
  "--no-locale",
  "--encoding=UTF8",
]);
unlinkSync(cluster + "-bootstrap-password");
pg("pg_ctl", [
  "-D",
  cluster,
  "-l",
  cluster + "/postgres.log",
  "-o",
  `-h 127.0.0.1 -p ${pgPort} -k ${cluster}`,
  "-w",
  "start",
]);
const database = "hms_test_perf_related";
pg("createdb", ["-h", "127.0.0.1", "-p", String(pgPort), database]);
const url = `postgresql://${os.userInfo().username}:${ownerPassword}@127.0.0.1:${pgPort}/${database}?connection_limit=8&options=${encodeURIComponent("-c lock_timeout=3s -c statement_timeout=60s")}`;
const parsed = new URL(url);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
  !/^\/hms_test_perf_[a-z0-9_]+$/.test(parsed.pathname)
)
  throw Error("Only loopback hms_test_perf_* disposable databases are allowed");
const expectedData = cluster;
if (!parsed.port)
  throw Error("Explicit disposable PostgreSQL port is required");
if (
  !expectedData ||
  !/^\/tmp\/hms_test_perf_[a-zA-Z0-9_]+$/.test(realpathSync(expectedData))
)
  throw Error(
    "HMS_TEST_PG_DATA must identify an actual disposable /tmp/hms_test_perf_* cluster",
  );
const output =
  process.env.HMS_PERFORMANCE_REPORT ?? backend + "performance-report.json";
const report = {
  scope:
    "Synthetic related-history engineering scenario, actual loopback HTTP/public-demo/nonowner RLS; not representative clinical workload or hosted capacity/SLA",
  source: spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: backend,
    encoding: "utf8",
  }).stdout.trim(),
  environment: {
    node: process.version,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    ramBytes: os.totalmem(),
    loadBefore: os.loadavg(),
  },
  criteria: {
    latencyMs: 300,
    interpretation:
      "Report every sample plus p50/p95/p99/max; <300ms for every measured operation is the strict local comparison, not a definition of unspecified normal load or medium server.",
    concurrency: [1, 4],
    samplesPerReadPerConcurrency: 20,
    warmup: 4,
  },
  checks: [],
  workloads: [],
};
report.startedAt = new Date().toISOString();
report.inputs = Object.fromEntries(
  [
    "test-real-postgres/related-history-performance.mjs",
    "dist/src/main.js",
    "dist/src/modules/lab/lab.service.js",
    "dist/src/modules/pharmacy/pharmacy.service.js",
    "src/modules/lab/lab.service.ts",
    "src/modules/pharmacy/pharmacy.service.ts",
    "prisma/migrations/20261128110000_pending_lab_index/migration.sql",
    "prisma/migrations/20261128110100_pending_prescription_index/migration.sql",
    "prisma/migrations/20261128110200_audit_workspace_time_index/migration.sql",
    "prisma/schema.prisma",
  ].map((f) => [
    f,
    createHash("sha256")
      .update(readFileSync(backend + f))
      .digest("hex"),
  ]),
);
let owner, app, heartbeat;
try {
  owner = new PrismaClient({ datasources: { db: { url } } });
  const actualData = (await owner.$queryRawUnsafe("SHOW data_directory"))[0]
    .data_directory;
  assert.equal(
    realpathSync(actualData),
    realpathSync(expectedData),
    "Refuse shared/tunneled or different PostgreSQL cluster before any migration/role/grant effect",
  );
  report.environment.disposableCluster = {
    actualDataDirectory: realpathSync(actualData),
    explicitPort: Number(parsed.port),
    identityMatchedBeforeWrites: true,
  };
  const timeouts = await owner.$queryRawUnsafe(
    "SELECT current_setting('lock_timeout') AS lock_timeout,current_setting('statement_timeout') AS statement_timeout",
  );
  assert.equal(timeouts[0].lock_timeout, "3s");
  assert.equal(timeouts[0].statement_timeout, "1min");
  report.migrationTimeouts = timeouts[0];
  const existing = await owner.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(existing.length, 0, "Require an empty fresh database");
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      cwd: backend,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    },
  );
  assert.equal(migration.status, 0, migration.stderr);
  report.checks.push("All migrations applied to empty disposable DB");
  const password = randomBytes(24).toString("hex");
  await owner.$executeRawUnsafe(
    `CREATE ROLE hms_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`,
  );
  await owner.$executeRawUnsafe(
    "CREATE ROLE hms_cleanup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT",
  );
  // SQL is repository-controlled, fixed local-only grants. No external input is interpolated.
  // Prisma raw accepts only one statement. Use the PostgreSQL client's fixed SQL-file support.
  const psql = spawnSync(
    pgBin + "/psql",
    ["-v", "ON_ERROR_STOP=1", "-f", backend + "prisma/demo/grants.sql"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port,
        PGDATABASE: parsed.pathname.slice(1),
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
      },
    },
  );
  assert.equal(psql.status, 0, psql.stderr);
  await owner.$queryRawUnsafe("SELECT hms_cleanup_expired_workspaces()");
  heartbeat = setInterval(
    () =>
      owner
        .$queryRawUnsafe("SELECT hms_cleanup_expired_workspaces()")
        .catch((e) => {
          report.heartbeatError = String(e);
        }),
    30000,
  );
  const runtime = new URL(url);
  runtime.username = "hms_runtime";
  runtime.password = password;
  runtime.searchParams.set("connection_limit", "8");
  const port = Number(process.env.HMS_PERFORMANCE_PORT ?? 4389);
  assert.ok(port >= 1024 && port <= 65535);
  let logs = "";
  app = spawn(process.execPath, ["dist/src/main.js"], {
    cwd: backend,
    env: {
      ...process.env,
      DATABASE_URL: runtime.toString(),
      JWT_SECRET: randomBytes(32).toString("hex"),
      HMS_PUBLIC_DEMO: "true",
      HMS_QUALIFICATION_MODE: "false",
      HMS_RATE_LIMIT_IDENTITY: "",
      HMS_LOCAL_DEMO_LOOPBACK: "true",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (x) => {
    logs += x;
  });
  app.stderr.on("data", (x) => {
    logs += x;
  });
  const base = "http://127.0.0.1:" + port + "/api/v1";
  for (let i = 0; i < 150; i++) {
    if (app.exitCode !== null) throw Error("App exited during startup");
    try {
      if ((await fetch(base + "/health")).status === 200) break;
    } catch {}
    if (i === 149) throw Error("App startup timeout");
    await new Promise((r) => setTimeout(r, 200));
  }
  async function call(path, token, method = "GET", body) {
    const start = performance.now();
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw Error("NonJSON response " + r.status);
    }
    return {
      ms: performance.now() - start,
      status: r.status,
      bytes: Buffer.byteLength(text),
      count: Array.isArray(data) ? data.length : null,
      data,
    };
  }
  const boot = await call("/demo/start", null, "POST");
  assert.equal(boot.status, 201);
  const receptionist = boot.data.accessToken;
  const switched = await call("/demo/role", receptionist, "POST", {
    role: "admin",
  });
  assert.equal(switched.status, 201);
  const admin = switched.data.accessToken;
  const workspaces = await owner.$queryRawUnsafe(
    "SELECT id FROM demo_workspaces",
  );
  assert.equal(workspaces.length, 1);
  const workspace = workspaces[0].id;
  const rows = await owner.$queryRawUnsafe(
    "SELECT id FROM users WHERE workspace_id=$1 AND role='receptionist'::\"Role\"",
    workspace,
  );
  const actor = rows[0].id;
  const users = await owner.$queryRawUnsafe(
    "SELECT id,role FROM users WHERE workspace_id=$1",
    workspace,
  );
  const actors = Object.fromEntries(users.map((u) => [u.role, u.id]));
  const dept = (
    await owner.$queryRawUnsafe(
      "SELECT id FROM departments WHERE workspace_id=$1",
      workspace,
    )
  )[0].id;
  const medication = (
    await owner.$queryRawUnsafe(
      "SELECT id FROM medications WHERE workspace_id=$1",
      workspace,
    )
  )[0].id;
  const sql = (q, ...v) => owner.$executeRawUnsafe(q, ...v);
  await sql(
    `INSERT INTO patients(id,mrn,full_name,date_of_birth,gender,phone,created_by,updated_at,workspace_id) SELECT gen_random_uuid()::text,'HMS-'||lpad(i::text,6,'0'),'Fictional Related Patient '||lpad(i::text,6,'0'),'2000-01-01'::timestamp,'male'::"Gender",'000000'||lpad(i::text,4,'0'),$1,clock_timestamp(),$2 FROM generate_series(2,10000) i`,
    actor,
    workspace,
  );
  const patientRows = await owner.$queryRawUnsafe(
    "SELECT id,mrn FROM patients WHERE workspace_id=$1 ORDER BY mrn",
    workspace,
  );
  const heavyPatient = patientRows[0].id,
    typicalPatient = patientRows.at(-1).id;
  await sql(
    `INSERT INTO appointments(id,patient_id,doctor_id,department_id,scheduled_at,status,updated_at,workspace_id) SELECT gen_random_uuid()::text,id,$2,$3,'2026-01-01'::timestamp+(row_number() OVER(ORDER BY mrn))*interval '30 minutes','completed',clock_timestamp(),$1 FROM patients WHERE workspace_id=$1`,
    workspace,
    actors.doctor,
    dept,
  );
  await sql(
    `INSERT INTO encounters(id,patient_id,doctor_id,chief_complaint,diagnosis,notes,encounter_date,workspace_id) SELECT gen_random_uuid()::text,p.id,$2,'Fictional complaint only','Fictional diagnosis only',repeat('Synthetic note. ',64),'2026-01-01'::timestamp+i*interval '1 day',$1 FROM patients p CROSS JOIN generate_series(1,5) i WHERE p.workspace_id=$1`,
    workspace,
    actors.doctor,
  );
  await sql(
    `INSERT INTO encounters(id,patient_id,doctor_id,chief_complaint,diagnosis,notes,encounter_date,workspace_id) SELECT gen_random_uuid()::text,$2,$3,'Fictional heavier history','Fictional diagnosis only',repeat('Synthetic note. ',64),'2026-01-01'::timestamp+i*interval '1 day',$1 FROM generate_series(6,250) i`,
    workspace,
    heavyPatient,
    actors.doctor,
  );
  await sql(
    `INSERT INTO prescriptions(id,encounter_id,medication_name,dosage,duration,notes,status,workspace_id) SELECT gen_random_uuid()::text,id,'Fictional nonclinical item','Synthetic dose text','Synthetic duration',repeat('Synthetic note. ',8),CASE WHEN row_number() OVER(ORDER BY id)<=100 THEN 'pending'::"PrescriptionStatus" ELSE 'unavailable'::"PrescriptionStatus" END,$1 FROM encounters WHERE workspace_id=$1`,
    workspace,
  );
  await sql(
    `INSERT INTO test_orders(id,patient_id,encounter_id,ordered_by,test_type,test_name,status,result,result_notes,completed_by,completed_at,workspace_id) SELECT gen_random_uuid()::text,patient_id,id,$2,CASE WHEN row_number() OVER(ORDER BY id)%2=0 THEN 'lab'::"TestType" ELSE 'radiology'::"TestType" END,'Fictional test only',CASE WHEN row_number() OVER(ORDER BY id)<=100 THEN 'pending'::"TestOrderStatus" ELSE 'completed'::"TestOrderStatus" END,CASE WHEN row_number() OVER(ORDER BY id)<=100 THEN NULL ELSE repeat('Fictional result. ',32) END,NULL,CASE WHEN row_number() OVER(ORDER BY id)<=100 THEN NULL ELSE $3 END,CASE WHEN row_number() OVER(ORDER BY id)<=100 THEN NULL ELSE encounter_date END,$1 FROM encounters WHERE workspace_id=$1`,
    workspace,
    actors.doctor,
    actors.lab_tech,
  );
  await sql(
    `INSERT INTO invoices(id,patient_id,status,insurance_coverage_percent,created_by,updated_at,workspace_id) SELECT gen_random_uuid()::text,id,'partial',20,$2,clock_timestamp(),$1 FROM patients WHERE workspace_id=$1`,
    workspace,
    actors.billing_clerk,
  );
  await sql(
    `INSERT INTO invoice_items(id,invoice_id,description,quantity,unit_price,workspace_id) SELECT gen_random_uuid()::text,id,'Synthetic item',1,100,$1 FROM invoices CROSS JOIN generate_series(1,2) i WHERE workspace_id=$1`,
    workspace,
  );
  await sql(
    `INSERT INTO payments(id,invoice_id,amount,method,recorded_by,workspace_id) SELECT gen_random_uuid()::text,id,80,'cash',$2,$1 FROM invoices WHERE workspace_id=$1`,
    workspace,
    actors.billing_clerk,
  );
  await sql(
    `INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id,new_value,workspace_id) SELECT gen_random_uuid()::text,$2,'SYNTHETIC_FIXTURE','Encounter',id,'{"fixture":true}'::jsonb,$1 FROM encounters WHERE workspace_id=$1`,
    workspace,
    actors.doctor,
  );
  const tables = [
    "patients",
    "appointments",
    "encounters",
    "prescriptions",
    "test_orders",
    "invoices",
    "invoice_items",
    "payments",
    "audit_logs",
  ];
  const expected = [
    10000, 10000, 50245, 50245, 50245, 10000, 20000, 10000, 50245,
  ];
  report.fixtureCounts = {};
  for (let i = 0; i < tables.length; i++) {
    const n = (
      await owner.$queryRawUnsafe(
        "SELECT count(*)::int AS n FROM " +
          tables[i] +
          " WHERE workspace_id=$1",
        workspace,
      )
    )[0].n;
    assert.equal(n, expected[i], tables[i]);
    report.fixtureCounts[tables[i]] = n;
  }
  const mismatches = await owner.$queryRawUnsafe(
    `SELECT (SELECT count(*)::int FROM prescriptions p JOIN encounters e ON e.id=p.encounter_id WHERE p.workspace_id=$1 AND p.workspace_id<>e.workspace_id)+(SELECT count(*)::int FROM test_orders t JOIN encounters e ON e.id=t.encounter_id WHERE t.workspace_id=$1 AND (t.workspace_id<>e.workspace_id OR t.patient_id<>e.patient_id)) AS n`,
    workspace,
  );
  assert.equal(mismatches[0].n, 0);
  const money = await owner.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM invoices i WHERE workspace_id=$1 AND (insurance_coverage_percent<>20 OR status<>'partial' OR (SELECT sum(quantity*unit_price) FROM invoice_items WHERE invoice_id=i.id)<>200 OR (SELECT sum(amount) FROM payments WHERE invoice_id=i.id)<>80)`,
    workspace,
  );
  assert.equal(money[0].n, 0);
  report.fixtureIntegrity = {
    relatedLinkMismatches: 0,
    invoiceArithmeticMismatches: 0,
    exactCounts: true,
    notesBytes: 1024,
    resultBytes: 576,
    pendingLab: 100,
    pendingPrescriptions: 100,
    method:
      "Owner bulk inserts outside timing, synthetic provenance audits; unavailable prescription state avoids inventing dispensing events. No clinical validity claim.",
  };
  // Disposable experiment only, not a product migration. Default baseline is unchanged.
  if (process.env.HMS_RELATED_INDEX_EXPERIMENT === "true") {
    for (const q of [
      "CREATE INDEX experiment_lab_pending_time ON test_orders(workspace_id,ordered_at) WHERE status='pending'",
      "CREATE INDEX experiment_rx_pending_time ON prescriptions(workspace_id,created_at) WHERE status='pending'",
      "CREATE INDEX experiment_audit_workspace_time ON audit_logs(workspace_id,created_at DESC)",
    ])
      await sql(q);
    report.experimentalIndexes = [
      "test_orders(workspace_id,ordered_at) WHERE pending",
      "prescriptions(workspace_id,created_at) WHERE pending",
      "audit_logs(workspace_id,created_at DESC)",
    ];
  }
  await sql("ANALYZE");
  const tokens = { admin, receptionist };
  for (const role of [
    "doctor",
    "lab_tech",
    "pharmacist",
    "billing_clerk",
    "manager",
  ]) {
    const r = await call("/demo/role", receptionist, "POST", { role });
    assert.equal(r.status, 201);
    tokens[role] = r.data.accessToken;
  }
  const shadow = await call("/demo/start", null, "POST");
  assert.equal(shadow.status, 201);
  const shadowDoctor = await call(
    "/demo/role",
    shadow.data.accessToken,
    "POST",
    { role: "doctor" },
  );
  assert.equal(shadowDoctor.status, 201);
  assert.equal(
    (await call("/patients/" + heavyPatient, shadowDoctor.data.accessToken))
      .status,
    404,
  );
  assert.deepEqual(
    (
      await call(
        "/patients/" + heavyPatient + "/test-results",
        shadowDoctor.data.accessToken,
      )
    ).data,
    [],
  );
  assert.equal(
    (
      await call(
        "/patients/" + heavyPatient + "/records",
        shadowDoctor.data.accessToken,
      )
    ).status,
    404,
  );
  const invoice = (
    await owner.$queryRawUnsafe(
      "SELECT id FROM invoices WHERE workspace_id=$1 LIMIT 1",
      workspace,
    )
  )[0].id;
  const shadowBill = await call("/demo/role", shadow.data.accessToken, "POST", {
    role: "billing_clerk",
  });
  assert.equal(shadowBill.status, 201);
  assert.equal(
    (await call("/invoices/" + invoice, shadowBill.data.accessToken)).status,
    404,
  );
  report.isolation = {
    secondWorkspace: true,
    foreignPatient404: true,
    foreignRecords404: true,
    foreignResultsEmpty: true,
    foreignInvoice404: true,
  };
  report.environment.postgres = (
    await owner.$queryRawUnsafe("SELECT version() AS version")
  )[0].version;
  report.environment.databaseSettings = await owner.$queryRawUnsafe(
    "SELECT name,setting,unit FROM pg_settings WHERE name IN ('shared_buffers','max_connections','fsync','synchronous_commit','full_page_writes') ORDER BY name",
  );
  const resultCounts = {};
  for (const id of [typicalPatient, heavyPatient])
    resultCounts[id] = (
      await owner.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM test_orders WHERE patient_id=$1 AND status='completed'`,
        id,
      )
    )[0].n;
  const range = "start=2026-01-02T00:00:00Z&end=2026-01-03T00:00:00Z";
  const definitions = [
    {
      name: "patient-search",
      path: () => "/patients?search=HMS-010000",
      token: admin,
      check: (d) => {
        assert.equal(d.length, 1);
        assert.equal(d[0].id, typicalPatient);
      },
    },
    {
      name: "patient-detail",
      path: () => "/patients/" + typicalPatient,
      token: tokens.doctor,
      check: (d) => assert.equal(d.id, typicalPatient),
    },
    ...[typicalPatient, heavyPatient].flatMap((id, i) => [
      {
        name: (i ? "heavy250" : "typical5") + "-medical-records",
        path: () => "/patients/" + id + "/records",
        token: tokens.doctor,
        check: (d) => {
          assert.equal(d.length, i ? 250 : 5);
          assert.ok(
            d.every((e) => e.patientId === id && e.prescriptions.length === 1),
          );
          assert.ok(
            d.every(
              (e, j) => j === 0 || d[j - 1].encounterDate >= e.encounterDate,
            ),
          );
        },
      },
      {
        name: (i ? "heavy250" : "typical5") + "-completed-results",
        path: () => "/patients/" + id + "/test-results",
        token: tokens.doctor,
        check: (d) => {
          assert.equal(d.length, resultCounts[id]);
          assert.ok(
            d.every((t) => t.patientId === id && t.status === "completed"),
          );
        },
      },
    ]),
    {
      name: "pending-lab100",
      path: () => "/test-orders/pending",
      token: tokens.lab_tech,
      check: (d) => assert.equal(d.length, 100),
    },
    {
      name: "pending-prescriptions100",
      path: () => "/prescriptions/pending",
      token: tokens.pharmacist,
      check: (d) => assert.equal(d.length, 100),
    },
    {
      name: "invoice-details",
      path: () => "/invoices/" + invoice,
      token: tokens.billing_clerk,
      check: (d) => {
        assert.equal(d.subtotal, 200);
        assert.equal(d.remaining, 80);
        assert.equal(d.totalPaid, 80);
      },
    },
    {
      name: "daily-appointments",
      path: () => "/appointments?page=1&" + range,
      token: admin,
      check: (d) => assert.equal(d.length, 48),
    },
    {
      name: "department-overview",
      path: () => "/departments/overview?" + range,
      token: tokens.manager,
      check: (d) => assert.equal(d.appointmentCount, 48),
    },
    {
      name: "audit-latest100",
      path: () => "/demo/audit",
      token: admin,
      check: (d) => assert.equal(d.length, 100),
    },
  ];
  // Two histories share a handler:88timed/warmup calls total, below100/minute.
  const summarize = (times) => {
    const v = [...times].sort((a, b) => a - b),
      q = (p) => v[Math.ceil(p * v.length) - 1];
    return {
      min: v[0],
      p50: q(0.5),
      p95: q(0.95),
      p99: q(0.99),
      max: v.at(-1),
      mean: v.reduce((a, b) => a + b, 0) / v.length,
      over300: v.filter((t) => t >= 300).length,
    };
  };
  for (const d of definitions) {
    for (let i = 0; i < 4; i++) {
      const r = await call(d.path(), d.token);
      assert.equal(r.status, 200, d.name);
      d.check(r.data);
    }
    for (const concurrency of [1, 4]) {
      let index = 0;
      const samples = [],
        statuses = {};
      const start = performance.now();
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          for (;;) {
            const i = index++;
            if (i >= 20) return;
            const r = await call(d.path(), d.token);
            samples.push({
              index: i,
              ms: r.ms,
              status: r.status,
              bytes: r.bytes,
              count: r.count,
            });
            statuses[r.status] = (statuses[r.status] ?? 0) + 1;
            assert.equal(r.status, 200, d.name + " failed");
            d.check(r.data);
          }
        }),
      );
      report.workloads.push({
        name: d.name,
        concurrency,
        count: samples.length,
        statuses,
        durationMs: performance.now() - start,
        latencyMs: summarize(samples.map((r) => r.ms)),
        samples,
      });
    }
  }
  const auditsBefore = (
    await owner.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM audit_logs WHERE workspace_id=$1",
      workspace,
    )
  )[0].n;
  for (const concurrency of [1, 4]) {
    let index = 0;
    const samples = [],
      start = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        for (;;) {
          const i = index++;
          if (i >= 4) return;
          const chainStart = performance.now();
          const e = await call("/encounters", tokens.doctor, "POST", {
            patientId: typicalPatient,
            chiefComplaint: "Fictional measured visit",
            diagnosis: "Fictional diagnosis",
            notes: "Synthetic only",
          });
          assert.equal(e.status, 201);
          const t = await call("/test-orders", tokens.doctor, "POST", {
            patientId: typicalPatient,
            encounterId: e.data.id,
            testType: "lab",
            testName: "Fictional measured test",
          });
          assert.equal(t.status, 201);
          const invoice = await call(
            "/invoices",
            tokens.billing_clerk,
            "POST",
            {
              patientId: typicalPatient,
              items: [
                {
                  description: "Fictional measured item",
                  quantity: 1,
                  unitPrice: 100,
                },
              ],
            },
          );
          assert.equal(invoice.status, 201);
          samples.push({
            index: i,
            ms: performance.now() - chainStart,
            encounterMs: e.ms,
            testOrderMs: t.ms,
            invoiceMs: invoice.ms,
            bytes: e.bytes + t.bytes + invoice.bytes,
            encounterId: e.data.id,
            testOrderId: t.data.id,
            invoiceId: invoice.data.id,
          });
        }
      }),
    );
    report.workloads.push({
      name: "three-audited-write-chain",
      concurrency,
      count: samples.length,
      durationMs: performance.now() - start,
      latencyMs: summarize(samples.map((s) => s.ms)),
      samples,
      comparison:
        "Chain combines three HTTP operations,300ms source comparison applies individually, not to this chain sum",
    });
  }
  const auditsAfter = (
    await owner.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM audit_logs WHERE workspace_id=$1",
      workspace,
    )
  )[0].n;
  assert.equal(auditsAfter - auditsBefore, 24);
  for (const [table, delta] of [
    ["encounters", 8],
    ["test_orders", 8],
    ["invoices", 8],
    ["invoice_items", 8],
    ["prescriptions", 0],
    ["patients", 0],
    ["payments", 0],
  ]) {
    const n = (
      await owner.$queryRawUnsafe(
        "SELECT count(*)::int AS n FROM " + table + " WHERE workspace_id=$1",
        workspace,
      )
    )[0].n;
    assert.equal(
      n,
      report.fixtureCounts[table] + delta,
      table + " write delta",
    );
  }
  report.writeIntegrity = {
    chains: 8,
    encounters: 8,
    testOrders: 8,
    invoices: 8,
    invoiceItems: 8,
    auditDelta: 24,
    exactDeltas: true,
  };
  report.measuredLocalTarget =
    report.workloads
      .filter((x) => x.name !== "three-audited-write-chain")
      .every((x) => x.latencyMs.over300 === 0) &&
    report.workloads
      .filter((x) => x.name === "three-audited-write-chain")
      .every((x) =>
        x.samples.every(
          (s) =>
            s.encounterMs < 300 && s.testOrderMs < 300 && s.invoiceMs < 300,
        ),
      )
      ? "All measured samples <300ms in this local environment"
      : "One or more measured samples >=300ms, local strict comparison not met";
  report.limitations = [
    "No network/TLS/Free provider resource contention/cold-start measurement",
    "Client/app/database share one machine; hardware is measured, not a calibrated medium server",
    "Concurrency1and4 are explicit scenarios, not a user-approved definition of normal load",
    "Fixed synthetic shape:10kpatients,50,245encounters,50,245prescriptions/tests,10kinvoices/appointments/payments; not a clinical workload model",
    "No backup/restore, power-cut, sustained soak, end-user timing or clinical certification",
    "Public demo rate limits/capacity/RLS/readiness remain enabled; shared records/results handlers each88warmup/timed reads plus isolation checks, other handlers below100/minute",
  ];
  report.checks.push(
    "Every timed read status, payload count/content/order and every measured write/delta passed",
  );
  report.complete = true;
} catch (e) {
  report.complete = false;
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  if (heartbeat) clearInterval(heartbeat);
  if (app) {
    app.kill("SIGTERM");
    if (app.exitCode === null) await new Promise((r) => app.once("exit", r));
  }
  await owner?.$disconnect();
  pg("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
  report.retainedPrivateCluster = cluster;
  report.finishedAt = new Date().toISOString();
  report.environment.loadAfter = os.loadavg();
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        output,
        complete: report.complete,
        error: report.error,
        measuredLocalTarget: report.measuredLocalTarget,
        workloads: report.workloads.map(({ samples, ...r }) => r),
        integrity: report.writeIntegrity,
      },
      null,
      2,
    ),
  );
}
