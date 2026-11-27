# Local10k performance qualification

27 November2026. This is bounded local engineering evidence, not public Free-host performance or acceptance of every SRS target. Original requirement: basic API<300ms on a medium server under normal load,10,000+registered patients. The SRS does not define medium server, workload mix, percentile or normal concurrency. We report explicit scenarios without silently defining them for the user.

## Reproduction

Use Node22, PostgreSQL17or18, installed psql, and a fresh empty loopback-only database named hms_test_perf_<suffix>. No remote/live database is permitted by the runner.

```
cd backend
npm ci --ignore-scripts
node node_modules/prisma/build/index.js generate
npm run build
#Set HMS_PERFORMANCE_DATABASE_URL securely for the disposable loopback DB.
#Set HMS_PERFORMANCE_REPORT to a safe output path if desired.
node test-real-postgres/performance.mjs
```

The disposable database role must own the empty DB and be able to create restricted test roles. The runner creates hms_runtime/hms_cleanup/hms_migration within that disposable cluster, applies current migrations and exact demo grants, advances local cleanup once and launches the unmodified public-mode compiled application. It generates local random test credentials without recording them in evidence. Use a new isolated cluster per run because role names are fixed. The local cluster/data is retained for inspection; stopping it is not authority to delete unrelated artifacts.

The actual application throttles, RLS, readiness and capacity limits remain enabled. Fixtures are bulk-loaded outside timing to exactly10,000patients. Seven basic reads each have4warmupsand40timedsamplesatconcurrency1then4.40full HTTPaudited patient creates follow,20perconcurrency. Timing includes fetch/HTTP/body-read on localhost, not just DBexecution. No seed/direct SQLis counted as an API write.

## First PostgreSQL18run

Actual database: PostgreSQL 18.7 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0, 64-bit. Nodev22.23.5, 1logicalCPU, 1.95GiBRAM, Intel(R) Xeon(R) 6975P-C. App/client/DBshare this machine. fsync, synchronous_commit and full_page_writes wereon. Runtime pool8connections, DBmax40.

|Operation|Concurrency|Timedcount|p50ms|p95ms|Maxms|Errors|
|---|---|---|---|---|---|---|
|patient-search|1|40|21.58|25.52|26.51|0|
|patient-search|4|40|111.67|155.33|156.93|0|
|patient-detail|1|40|7.14|11.16|13.66|0|
|patient-detail|4|40|29.26|37.49|41.65|0|
|patient-medical-records-empty|1|40|8.32|12.62|15.27|0|
|patient-medical-records-empty|4|40|37.56|58.23|59.64|0|
|appointment-options|1|40|7.62|12.15|13.19|0|
|appointment-options|4|40|32.32|68.62|69.56|0|
|appointments-current-day|1|40|6.66|10.01|13.02|0|
|appointments-current-day|4|40|26.56|34.00|35.14|0|
|departments|1|40|5.88|9.84|12.16|0|
|departments|4|40|25.27|32.56|39.02|0|
|bed-summary|1|40|7.16|10.75|18.84|0|
|bed-summary|4|40|29.63|34.10|34.91|0|
|patient-create-audited|1|20|42.07|51.22|80.34|0|
|patient-create-audited|4|20|161.78|184.15|205.90|0|

All600timedsampleswere<300msinthisrun.40create responses201yielded exactly40newpatientsand40audits,10,040uniqueMRNs. This is observed scope, not a capacity SLA.

[Raw measurements/environment/integrity](evidence/performance-pg18-20261127.json) include every latency sample. Re-run noise and warm/cold differences must remain visible.

## Limits and next evidence

Only patient cardinality is10k; related tables carry the ordinary small demo seed, and medical-record detail read is empty. No rich longitudinal history performance claim. No network/TLS/cold-provider/hosted resource contention, sustained soak, all-role journeys or browser perception measured. The local CPU/RAMis described, not labeled a representative medium hospital server. No physical crash/power-cut, backup/restore, legal or clinical qualification follows.

Before closing original performance target, agree a representative workload/server/concurrency/percentile and execute it in the intended deployment. This runner is a reproducible baseline for that decision, not a benchmark bypass or a reason to pressure the public Free service.

## Second actual PostgreSQL17run

PostgreSQL 17.12 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0, 64-bit. Same runner, fresh separate cluster/database,10,000fictional fixture, same explicit1/4concurrency scenarios and unchanged app limits.

|Operation|Concurrency|Timedcount|p50ms|p95ms|Maxms|Errors|
|---|---|---|---|---|---|---|
|patient-search|1|40|21.85|24.87|27.68|0|
|patient-search|4|40|102.35|141.04|143.12|0|
|patient-detail|1|40|6.36|9.69|11.89|0|
|patient-detail|4|40|24.90|32.33|35.44|0|
|patient-medical-records-empty|1|40|7.23|12.13|44.11|0|
|patient-medical-records-empty|4|40|34.50|49.64|51.04|0|
|appointment-options|1|40|6.61|9.52|11.71|0|
|appointment-options|4|40|26.96|50.18|51.85|0|
|appointments-current-day|1|40|6.01|11.24|12.60|0|
|appointments-current-day|4|40|23.23|29.60|31.58|0|
|departments|1|40|5.36|9.52|10.81|0|
|departments|4|40|23.40|61.22|65.05|0|
|bed-summary|1|40|6.24|9.51|10.61|0|
|bed-summary|4|40|25.70|30.54|32.04|0|
|patient-create-audited|1|20|37.48|46.54|47.80|0|
|patient-create-audited|4|20|159.65|188.56|205.79|0|

All600timedsamples<300msagain;40creates,40audits,10,040uniqueMRNs. [RawPG17evidence](evidence/performance-pg17-20261127.json). This confirms the recorded scenario on a second local PostgreSQL major, not the unmeasured deployment/workload assumptions above.
