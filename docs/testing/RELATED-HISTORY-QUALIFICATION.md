# Related-history candidate, not released

28 November2026. Base141347b, uncommitted candidate. No hosted database change or deployment. Requirement remains basic API<300ms on an undefined medium server under normal load. These are local explicit synthetic scenarios, not a representative clinical load model, capacity SLA or hospital qualification.

## Measured scenario

Actual compiled app, forced workspace RLS restricted runtime, guards/throttles/capacity/cleanup enabled, PostgreSQL17/18 separate fresh loopback clusters on the same shared machine. Owner bulk fixture creation is excluded from HTTP timing.10,000patients,50,245encounters/prescriptions/test-orders,10,000appointments/invoices/payments,20,000invoiceitems,50,245provenance audits. Each patient5encounters except one250encounters. Each encounter has1024bytes synthetic notes; completed test result576bytes.100pendingorders and100pendingprescriptions, other prescriptions unavailable, not fabricated dispensing histories. Invoices two100minor-unititems,20%coverage,80paid,80remaining. No zero-responsibility policy inference.

12read scenarios each4warmups+20samples at concurrency1and4,480timed reads per version.8three-request write chains,24actual timedHTTPwrites, exact8encounter/order/invoice/item and24auditdeltas. Heavy record response about505KB. No request retry or disabled throttle. Every measured read asserts expected IDs/counts/content or order; blank/missing workspace, shadow and expiry checks separately validate RLS. Neither queue is truncated/paginated.

## Results before and after

Concurrency4p95milliseconds, baseline then local candidate:

| Read | PG17 baseline | PG17 candidate | PG18 baseline | PG18 candidate |
|---|---:|---:|---:|---:|
| Pending lab100 |643|81|601|93|
| Pending prescriptions100 |557|107|563|103|
| Latest100audit |589|53|675|48|

All20samples per baseline bottleneck at concurrency4exceeded300ms. All individual candidate read/write samples below300ms in these two runs. This is achieved local evidence only. The combined three-request chain sometimes exceeded300ms in baseline, its sum is not a single basic API. No percentile normal-load acceptance is invented.

Baseline proof initially misstated notes as960bytes, actual repeat length1024; byte metadata corrected in candidate. First retained run stopped at a harness-only incorrect pharmacyURL404. Later complete baselines use correctURL. Never treat the failed run as application failure or complete acceptance.

## Diagnosis and minimal candidate

Full queue scans evaluate workspace-expiry RLS about50ktimes. Full composite status indexes did not improve the plan. Partial pending indexes plus typed-literal SQL EXPLAIN looked fast, but actual Prisma text-to-enum cast still scanned50krows. ActualHTTPdisproved that partial-index-only fix on both versions. Ordered full indexes also did not solve it. Preserve these failed experiments as evidence.

Candidate adds three indexes, without data/grant/policy/function changes: partial workspace+ordered_at pending test-orders; partial workspace+created_at pending prescriptions; workspace+created_at DESC audits. Each pending service selects IDs using fixed tagged Prisma.sql and typed pending literal, then existing Prisma include/selection in the same RepeatableRead transaction. Full responses preserved. Unit tests prove no dynamic SQL, limit or unsafe empty-ID hydration. ActualDBdifferentialtests compare every returned field/ID and ascending time order, tied timestamps never had a stable order contract. A concurrent status update after IDselection preserves the original snapshot; next request sees transition. Shadow/empty/absent/expired scope queues return[]through unchangedRLS. Backend234unit tests pass after new4tests; final exact-source bothPG reruns are recorded separately.

## Migration risk and rollback, approval still required

Candidate ordinary CREATE INDEX blocks writes while building. Current hosted safe-read snapshot28Nov10:49Istanbul: prescriptions estimated4rows/64KiBtotal; test_orders6/96KiB; audit190/384KiB. EntireDB14,448,307bytes;0waitinglocks and no other open transaction observed. These are point-in-time statistics, not a lock/duration guarantee. SupabaseFree/Nano dashboard10:47:CPU3%,disk16%,RAM59%,11/60connections. Usage dashboard10:54:HMS28.5MB of0.5GB/project, can lag1hour and differ from direct currentDBsize; no quota exceeded. No paid upgrade needed or permitted. No actual host index build measured.

Existing installed Prisma5.22.0 was tested directly on both retained disposablePG17/18clusters: a temporary migration containing one CREATE INDEX CONCURRENTLY completed through migrate deploy, valid/ready index and finished migration record verified, then standalone DROP INDEX CONCURRENTLY succeeded. No implicit transaction prevented it. R3candidate now has three separate concurrent single-statement migration files (no explicit BEGIN/COMMIT). Actual freshbothPGmigrate+HTTPqualification uses connection lock_timeout3s/statement_timeout60s, confirmed before migration. Generic currentPrisma8docs about automatic transactions do not describe this repository's5.22tooling.

Recommended host option for approval after final review/CI: three separate concurrent index builds, one per migration, using a dedicated owner connection, unchanged RLS/grants, no writes of application records. Set short lock timeout and bounded statement timeout per session; re-read blockers and exact index definitions/validity immediately before committing. Abort on blockers/timeout/providerchallenge, do not cancel other sessions. Verify each index valid/ready and definition, then deploy the reviewed app and run bounded fictional workflows, never hostedload. Concurrent builds allow normal writes but require extra scans/work, can wait on old snapshots and can leave an invalid index if interrupted. A failed build must be inspected, only its newlycreated invalid index dropped with separate reviewed concurrentDDL, and Prisma failedmigration repaired with documented resolve/retry, never history-tableediting or blindIFNOTEXISTS. Exactthreefileplan and3s/60sbounds are staged in HOSTED-INDEX-PLAN.md, still require approval.

Alternative ordinarybuild on these currentlytiny tables is simpler/faster locally but risks briefwriteblocking; approve only with explicitlyacceptedmaintenancewindow and boundedlock/statementtimeouts. Keeping improvement local requires nohostchange and remains an option. The live project was not mutated. Hosteddefinitions/historysafe-read11:00-11:02confirmed sixfinishedbaselinePrismamigrations allchecksummatch andzeroexactnamecollisions for three proposedindexes; noDDL. Immediateexecutionpreflight stillmandatory.
Rollback product query to previous implementation; additive indexes may safely remain for investigation. Dropping just these new indexes is a separate owner migration, no data restore required. Never edit old migration history or roll back RLS/grants. No liveDBapproval exists. No pagination/APIcontract change, dependencies, architecture, paid service, retention/password/clinical policy changes proposed.

## Reproduction

Build backend first. MatchingPG17or18server/client tools required. All files retained privately, never export cluster or credentials. Example environment variables are placeholders:

```sh
HMS_RELATED_PG_BIN=/absolute/postgresql/bin HMS_PERFORMANCE_REPORT=/absolute/private/report.json node backend/test-real-postgres/related-history-performance.mjs
HMS_RELATED_PG_BIN=/absolute/postgresql/bin HMS_RELATED_REPORT=/absolute/private/report.json HMS_RELATED_INTEGRITY_OUTPUT=/absolute/private/integrity.json node backend/test-real-postgres/related-history-integrity.mjs
```

Runner creates a new0700/tmp/hms_test_perf_related_*cluster, hostSCRAM, loopback, private Unix socket, verifies actual data-directory before migration effects. No arbitraryDBURLaccepted. Child processes stopped and private fixture retained. No end-user browser timing, hostednetwork/TLS, Freeprovider cold-start/contention, sustained soak/power-cut/real-worldclinicalperformance claim.10kallpendingqueue would still create an unbounded payload and has not been qualified. Subject to independent source review and finalexacthashbothPGretest.

## Observed operational sources

- https://supabase.com/dashboard/project/tioslbxwmbfvmlqkvfog , currentFree/Nano/resource snapshot.
- https://supabase.com/dashboard/org/trphmwsgnxxjydxlpxqb/usage , current usage, refresh caveat and perprojectdatabase limit.
- https://www.postgresql.org/docs/17/sql-createindex.html , ordinary versus concurrentbuild/writeblocking/invalidindex/transaction restrictions.
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing , migration repair/resolve guidance; installedPrisma5actualtest owns its compatibility claim.

The SQLeditor's temporary unsavedSELECTsnippet did not persist as a recoverablecontentlink. NoDDLorapplicationdatawrite executed; initial malformedpasteproducedsyntaxerror. Source dashboard is recoverable, result figures were read directly.
