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

HMS_TEST_PG_DATA is required and must realpath-match SHOW data_directory under /tmp/hms_test_perf_* before migrations or cluster-wide role/grant changes; an explicit loopback port is required. The runner refuses a different/shared/tunneled cluster. psql credentials are passed through child environment, not command-line arguments.

The disposable database role must own the empty DB and be able to create restricted test roles. The runner creates hms_runtime/hms_cleanup/hms_migration within that disposable cluster, applies current migrations and exact demo grants, advances local cleanup once and launches the unmodified public-mode compiled application. It generates local random test credentials without recording them in evidence. Use a new isolated cluster per run because role names are fixed. The local cluster/data is retained for inspection; stopping it is not authority to delete unrelated artifacts.

The actual application throttles, RLS, readiness and capacity limits remain enabled. Fixtures are bulk-loaded outside timing to exactly10,000patients. Seven basic reads each have4warmupsand40timedsamplesatconcurrency1then4.40full HTTPaudited patient creates follow,20perconcurrency. Timing includes fetch/HTTP/body-read on localhost, not just DBexecution. No seed/direct SQLis counted as an API write.

## First PostgreSQL18run

Actual database: PostgreSQL 18.7 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0, 64-bit. Nodev22.23.5, 1logicalCPU, 1.95GiBRAM, Intel(R) Xeon(R) 6975P-C. App/client/DBshare this machine. fsync, synchronous_commit and full_page_writes wereon. Runtime pool8connections, DBmax40.

|Operation|Concurrency|Timedcount|p50ms|p95ms|Maxms|Errors|
|---|---|---|---|---|---|---|
|patient-search|1|40|23.99|27.99|28.94|0|
|patient-search|4|40|120.13|148.28|161.96|0|
|patient-detail|1|40|7.03|14.05|18.03|0|
|patient-detail|4|40|30.56|38.32|49.89|0|
|patient-medical-records-empty|1|40|8.53|13.61|40.20|0|
|patient-medical-records-empty|4|40|36.63|50.85|55.93|0|
|appointment-options|1|40|6.59|9.19|11.36|0|
|appointment-options|4|40|28.81|54.12|57.08|0|
|appointments-current-day|1|40|6.01|9.21|13.26|0|
|appointments-current-day|4|40|25.24|35.22|36.13|0|
|departments|1|40|5.44|10.29|11.92|0|
|departments|4|40|25.39|62.88|70.69|0|
|bed-summary|1|40|6.42|9.70|16.53|0|
|bed-summary|4|40|25.17|29.95|31.30|0|
|patient-create-audited|1|20|39.23|47.01|50.41|0|
|patient-create-audited|4|20|164.34|181.79|201.60|0|

All600timedsampleswere<300msinthisrun.40create responses201yielded exactly40newpatientsand40audits,10,040uniqueMRNs. This is observed scope, not a capacity SLA.

[Raw measurements/environment/integrity](evidence/performance-pg18-20261127.json) include every latency sample. Re-run noise and warm/cold differences must remain visible.

## Limits and next evidence

Only patient cardinality is10k; related tables carry the ordinary small demo seed, and medical-record detail read is empty. No rich longitudinal history performance claim. No network/TLS/cold-provider/hosted resource contention, sustained soak, all-role journeys or browser perception measured. The local CPU/RAMis described, not labeled a representative medium hospital server. No physical crash/power-cut, backup/restore, legal or clinical qualification follows.

Before closing original performance target, agree a representative workload/server/concurrency/percentile and execute it in the intended deployment. This runner is a reproducible baseline for that decision, not a benchmark bypass or a reason to pressure the public Free service.

## Second actual PostgreSQL17run

PostgreSQL 17.12 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0, 64-bit. Same runner, fresh separate cluster/database,10,000fictional fixture, same explicit1/4concurrency scenarios and unchanged app limits.

|Operation|Concurrency|Timedcount|p50ms|p95ms|Maxms|Errors|
|---|---|---|---|---|---|---|
|patient-search|1|40|24.22|26.99|28.31|0|
|patient-search|4|40|105.68|147.33|154.70|0|
|patient-detail|1|40|6.17|9.97|12.55|0|
|patient-detail|4|40|24.80|31.95|37.23|0|
|patient-medical-records-empty|1|40|7.13|11.80|12.67|0|
|patient-medical-records-empty|4|40|32.35|46.29|51.28|0|
|appointment-options|1|40|6.66|10.36|39.83|0|
|appointment-options|4|40|26.95|51.62|57.54|0|
|appointments-current-day|1|40|5.98|10.14|12.26|0|
|appointments-current-day|4|40|26.13|33.96|35.45|0|
|departments|1|40|5.92|10.94|12.39|0|
|departments|4|40|25.76|34.00|41.64|0|
|bed-summary|1|40|7.04|10.54|10.99|0|
|bed-summary|4|40|28.61|33.58|36.36|0|
|patient-create-audited|1|20|40.28|51.29|91.50|0|
|patient-create-audited|4|20|153.68|197.52|214.37|0|

All600timedsamples<300msagain;40creates,40audits,10,040uniqueMRNs. [RawPG17evidence](evidence/performance-pg17-20261127.json). This confirms the recorded scenario on a second local PostgreSQL major, not the unmeasured deployment/workload assumptions above.

Small-sample caveat:20write/40read samples per scenario make p95/p99close to the maximum and unstable estimates of tail behavior. These are sample summaries, not reliable population percentiles or a sustained-load claim.

Reviewer remediation rerun:27November17:50UTC, runner source4d1f42d, actual SHOW data_directory/realpathmatchbeforeallmigration/role/granteffectsandexplicitportenforced. BothPG17.12and18.7reran600timedrequestssuccessfullywithallrecordedsamples<300ms. Earlier first-run numeric tables are superseded by the rerun tables/rawsamples above.

Actual negative-gate test used another fresh local cluster: deliberately mismatched expected data_directory was rejected before migration or role changes, with actual zero public tables and zeroHMSrolesafterfailure. Missing explicit port was rejected clearly in both performance and crash runners. See evidence/disposable-runner-negative-gates-20261127.json, explicitly a manual one-off summary from a separate local wrapper, not automatically reproduced by checked-in CI. No remote/tunneled account was contacted for this test.
