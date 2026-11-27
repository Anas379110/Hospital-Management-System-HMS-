# Local process-crash recovery evidence

27 November2026, compiled source2ad6bb2and the current local-only test runners. This is an actual disposable PostgreSQL18process restart, not a mock, physical power cut or hosted provider disruption.

## What ran

1. Fresh loopback-only cluster and database, all current migrations and restricted runtime grants.
2. Actual public-mode HTTP benchmark seeded10,000fictional patients and committed40additional audited registrations through the actual app. The API was then stopped normally after the benchmark.
3. Assert fsync, synchronous_commit and full_page_writes areon. Count10,040patients,10,040uniqueMRNsand40audits.
4. Start an actual open SQLtransaction and insert an uncommitted fictional sentinel patient. Wait until the insert returns inside that transaction.
5. Issue `pg_ctl -m immediate stop` only to the exact disposable cluster whose `SHOW data_directory` matches the guarded `/tmp/hms_test_perf_*`path. Restart that same local cluster.
6. Query after PostgreSQLWALrecovery:10,040patientsanduniqueMRNs,40audits, zero uncommitted sentinel. Open transaction rejected, not falsely reported committed.

Actual immediate-stop-to-restarted-query interval:266msinthisone local run. This is not an availability/RTO/SLAcommitment. The app was not running during the crash drill, so no API auto-reconnect/auto-restart claim.

[Raw result](evidence/crash-recovery-pg18-20261127.json) and [guarded runner](../../backend/test-real-postgres/crash-recovery.mjs).

## Reproduction

First run the local performance runner in a disposable loopback-only `hms_test_perf_*`database. Keep the local cluster running. Set these only for that cluster:

- HMS_PERFORMANCE_DATABASE_URL, the same disposable DBowner URL, never a remote/live URL.
- HMS_TEST_PG_CTL, an executable matching the PostgreSQLmajor used by that cluster.
- HMS_TEST_PG_DATA, actual cluster directory under `/tmp/hms_test_perf_*`.
- HMS_CRASH_REPORT, a safe output JSONpath.

Then from backend run `node test-real-postgres/crash-recovery.mjs`. It refuses unknown/remote DBnames and non-test directories, checks actual data_directory matches, and requires the expected fictional benchmark counts. The drill deliberately interrupts that test cluster only. Preserve the data for inspection. It does not grant permission to stop another cluster or deploy/change any live service.

## Still open

Physical power loss, storage/controller/cache corruption, lost disks, multi-host network partition, application retry/reconciliation across restart, daily backup and validated restore, RPO/RTOtargets and offline/intranet delivery remain unproven. SQLtransactions plus this crash drill do not establish the SRSabsolute no-data-loss wording. The production/demo hidden-resume heartbeat limitation is unchanged, and was not tested or bypassed here.

Installed client `pg_dump`/`pg_restore` is PostgreSQL14while current tested servers are17/18. Do not silently substitute an older backup client or claim backup/restore passed. A matching pinned free client/runtime and explicit backup policy are needed before a real restore drill. Comparing logical daily dumps with physical/WALarchives remains in [design choices](../quality/REMAINING-DESIGN-CHOICES.md).
