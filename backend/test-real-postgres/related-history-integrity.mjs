// Run against the retained disposable rich-history cluster, via its private socket.
// No external URL accepted. Actual HTTP performance is a separate qualification.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require("@prisma/client");
const { LabService } = require("../dist/src/modules/lab/lab.service");
const {
  PharmacyService,
} = require("../dist/src/modules/pharmacy/pharmacy.service");
const reportPath = process.env.HMS_RELATED_REPORT,
  output = process.env.HMS_RELATED_INTEGRITY_OUTPUT;
assert.ok(reportPath && output && process.env.HMS_RELATED_PG_BIN);
const prior = JSON.parse(readFileSync(reportPath)),
  dir = realpathSync(prior.retainedPrivateCluster);
assert.match(dir, /^\/tmp\/hms_test_perf_related_[a-zA-Z0-9]+$/);
const bin = process.env.HMS_RELATED_PG_BIN,
  port = 55625;
function pg(n, a) {
  const r = spawnSync(bin + "/" + n, a, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
pg("pg_ctl", [
  "-D",
  dir,
  "-l",
  dir + "/postgres.log",
  "-o",
  `-h 127.0.0.1 -p ${port} -k ${dir}`,
  "-w",
  "start",
]);
const url = `postgresql://${process.env.USER}@localhost:${port}/hms_test_perf_related?host=${encodeURIComponent(dir)}`;
const owner = new PrismaClient({ datasources: { db: { url } } }),
  writer = new PrismaClient({ datasources: { db: { url } } });
const report = { checks: [], complete: false };
try {
  assert.equal(
    realpathSync(
      (await owner.$queryRawUnsafe("SHOW data_directory"))[0].data_directory,
    ),
    dir,
  );
  const ws = await owner.$queryRawUnsafe(
    "SELECT workspace_id,count(*)::int AS n FROM patients GROUP BY workspace_id ORDER BY n DESC",
  );
  const workspace = ws[0].workspace_id,
    shadow = ws[1].workspace_id;
  const queryEvents = [];
  const scoped = (scope, hook) => ({
    $transaction: (callback, opts) =>
      owner.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE hms_runtime");
        await tx.$queryRawUnsafe(
          "SELECT set_config('hms.workspace_id',$1,true)",
          scope,
        );
        let target = tx;
        if (hook)
          target = new Proxy(tx, {
            get(o, k) {
              if (k === "$queryRaw")
                return async (...args) => {
                  const rows = await o.$queryRaw(...args);
                  await hook(rows);
                  return rows;
                };
              const v = o[k];
              return typeof v === "function" ? v.bind(o) : v;
            },
          });
        return callback(target);
      }, opts),
  });
  const canonical = (rows) =>
    JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)));
  for (const type of ["lab", "pharmacy"]) {
    const lab = type === "lab",
      delegate = lab ? "testOrder" : "prescription",
      field = lab ? "orderedAt" : "createdAt";
    const include = lab
      ? {
          patient: { select: { fullName: true, mrn: true } },
          orderedByUser: { select: { fullName: true } },
        }
      : {
          encounter: {
            select: {
              patient: { select: { fullName: true, mrn: true } },
              doctor: { select: { fullName: true } },
            },
          },
        };
    const Service = lab ? LabService : PharmacyService,
      method = lab ? "pendingOrders" : "pendingPrescriptions";
    const service = new Service(scoped(workspace));
    const old = await scoped(workspace).$transaction((tx) =>
      tx[delegate].findMany({
        where: { status: "pending" },
        include,
        orderBy: { [field]: "asc" },
      }),
    );
    const current = await service[method]();
    assert.equal(
      canonical(current),
      canonical(old),
      "all fields and every queue row equal",
    );
    assert.ok(
      current.every((r, i) => i === 0 || current[i - 1][field] <= r[field]),
      "same ascending time order; tied times have no contract order",
    );
    assert.deepEqual(
      await new Service(scoped(shadow))[method](),
      [],
      "shadow empty queue",
    );
    report.checks.push(
      type +
        ": exact full response equality, ascending order and empty shadow queue",
    );
    const id = old[0].id;
    let concurrent = false;
    const hooked = new Service(
      scoped(workspace, async (rows) => {
        assert.ok(rows.some((r) => r.id === id));
        await writer[delegate].update({
          where: { id },
          data: { status: lab ? "cancelled" : "unavailable" },
        });
        concurrent = true;
      }),
    );
    const snapshot = await hooked[method]();
    assert.ok(concurrent);
    assert.equal(
      snapshot.find((r) => r.id === id).status,
      "pending",
      "selection and hydration see same repeatable snapshot",
    );
    const next = await service[method]();
    assert.ok(
      !next.some((r) => r.id === id),
      "next transaction sees committed transition",
    );
    await writer[delegate].update({
      where: { id },
      data: { status: "pending" },
    });
    report.checks.push(
      type +
        ": concurrent transition snapshot consistency and next-request visibility",
    );
  }
  const expiry = (
    await owner.$queryRawUnsafe(
      "SELECT expires_at FROM demo_workspaces WHERE id=$1",
      workspace,
    )
  )[0].expires_at;
  try {
    await writer.$executeRawUnsafe(
      "UPDATE demo_workspaces SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      workspace,
    );
    assert.deepEqual(
      await new LabService(scoped(workspace)).pendingOrders(),
      [],
    );
    assert.deepEqual(
      await new PharmacyService(scoped(workspace)).pendingPrescriptions(),
      [],
    );
    report.checks.push(
      "both queues deny expired workspace through unchanged RLS",
    );
  } finally {
    await writer.$executeRawUnsafe(
      "UPDATE demo_workspaces SET expires_at=$2 WHERE id=$1",
      workspace,
      expiry,
    );
  }
  assert.deepEqual(await new LabService(scoped("")).pendingOrders(), []);
  assert.deepEqual(
    await new PharmacyService(scoped("")).pendingPrescriptions(),
    [],
  );
  report.checks.push("both queues deny absent workspace scope");
  report.complete = true;
} catch (e) {
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await owner.$disconnect();
  await writer.$disconnect();
  pg("pg_ctl", ["-D", dir, "-m", "fast", "-w", "stop"]);
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(report);
}
