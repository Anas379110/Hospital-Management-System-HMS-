# Hosted index execution, bounded approval received

Prepared28November2026. This is a staged plan, not authorization. No live index, migration history, app deployment or account change has occurred. Existing hosted app remains141347b.

## Exact proposed effect

Three additive indexes, unchanged application data, grants, forced RLS, functions, auth and clinical policy. Separate one-statement migration files in this order:

1.20261128110000_pending_lab_index: CREATE INDEX CONCURRENTLY test_orders_workspace_pending_time_idx ON test_orders(workspace_id,ordered_at) WHERE status='pending'
2.20261128110100_pending_prescription_index: CREATE INDEX CONCURRENTLY prescriptions_workspace_pending_time_idx ON prescriptions(workspace_id,created_at) WHERE status='pending'
3.20261128110200_audit_workspace_time_index: CREATE INDEX CONCURRENTLY audit_logs_workspace_created_at_idx ON audit_logs(workspace_id,created_at DESC)

Then release two reviewed query methods selecting pending IDs with fixed typed literals and hydrating existing response shape inside one RepeatableRead snapshot. No queue item limit, pagination or response fields changed. Same query remains correct without indexes, but performance improvement requires both parts.

## Bounds and preflight

Use only the dedicated HMSfictionalproject, direct/session owner connection, never transactionpooling or applicationruntime credentials. Secret remains in vault/private environment, never docs/logs. Connection option for the migration session: lock_timeout=3s, statement_timeout=60s. Verify actual SHOW settings on that connection, including the Prisma migration connection through safe connection configuration. Each index statement bounded60seconds; lock acquisition bounded3seconds. Whole3buildsequence bounded5minutes excluding review/deploy. No automatic retry. Stop on timeout/error/captcha/providerchallenge, unexpected pending migrations/schema/role/target/index or new resource pressure. No other session cancelled, no paid upgrade.

Immediately before each build, safe reads must confirm target project/database identity, migration history and exact pendinglist, expected sourcehashes, ownerauthority, existing index names/definitions/valid+ready flags, database/table/index sizes, providerFreeusage, active/open transactions, blockers/waitinglocks and resource health. Abort if any blockedlock, index name collision/differentdefinition, failedmigration, other unexpected pendingmigration or active transaction predating preflight remains unresolved. Do not silently count an IFNOTEXISTS skip as success.

Current10:49host snapshot: estimated4prescriptions/64KiB,6testorders/96KiB,190audits/384KiB;DB14,448,307bytes,0waitinglocks/nootheropentransaction. Not executionpreflight. FreeNano10:47CPU3%,disk16%,RAM59%,11/60connections. Usage10:54:HMS28.5MB/0.5GB/project, noquotaexceeded, maylag1hour. 11:00-11:02safehostreads confirmed exactsixbaselinePrismamigrations allfinished/notrolledback and SHA256checksums matching repo; nofailed/extrahistory. Existingtargettableindexdefinitionsread; exactcatalognamequeryreturned0for allthreeproposednames. HostPG17.12/databasepostgres. ExistingPrisma5.22routealigns, no standaloneSQL/bootstrap/historyrepairneeded. Recheck beforeexecution. These tinytables support low expected resource impact, not a buildtime/downtime guarantee.

## Execution routes to choose before approval

Recommended: installedPrisma5.22.0 migrate deploy with the three separate concurrentmigrationfiles, no BEGIN/COMMIT wrapper, connectiontimeouts verified. Installedtooling actually applied singleconcurrentmigration and validhistory on bothPG17/18. Fresh candidate runs applied allthree files with3s/60s options on bothPG and fullactualHTTPpassed. Existing hosted history alignment was verified11:01against allsixbasechecksums; recheck immediately before migrate deploy. If host is managed by reviewed standaloneSQL rather than matchingPrismahistory, do not bootstrap/repair history by inference: report the discrepancy and stage the alternative ownerconnection single-statement route for approval. No migration tool change authorized here.

Alternative: ordinaryCREATEINDEX can be faster/simpler but blocks writes. It requires explicitly accepted briefmaintenance/writeblocking and a separately reviewed migration variant, with same bounds. Keep-local is a valid nohostchange choice.

Concurrent builds allow writes but do extra scans and can wait on oldsnapshots. Timeout can leave an invalid index consuming space/work. Only one index build per table at once. No hostduration guarantee; no public10kbenchmark.

## Verification and abort/recovery

After each build, verify name, table, columns, predicate, indisvalid and indisready, plus finishedmigration record. Save nonsecret evidence. Do not proceed to next if verification fails. At the end ensure only these three indexes added, RLS/grants unchanged, no unexpected migration effects. Then exactreviewedappCI/privateexports/RenderFreeAutoDeployOffpreflight, manualapproveddeploy, actualLive and boundedfictionalroleworkflows/queuecontent/order/expired-isolationchecks. No source-round completion claim before actual deployment gates.

If build fails: stop. Inspect ownnew index/migration state and activity. If invalid ownnew index exists, stage narrowly DROP INDEX CONCURRENTLY for that index only; no application data rollback. A cancellation before index registration may leave no index. For Prisma P3018 failedmigration, after verifying no effect remains use documented migrate resolve --rolled-back for only that failedmigration then retry the exact bytes once under freshpreflight, only within approvedrecovery scope. Do not markappliedblindly, edit historytable, alter migration alreadyapplied, drop preexistingindexes, or cancel someone else's session. If scope doesn't cover cleanup/retry, ask first. A blockedlockprobe reproduced55P03/P3018 at~3seconds, no index created, then resolve/retry valid+ready and narrowconcurrentdrop passedbothPG17/18.

Application rollback: redeploy reviewed141347bqueryversion. Additive validindexes can remain while investigating; their removal is separate approved ownerDDL, not required for data safety. No backup restore/data deletion/RLS reversal needed. Any livehost failure outside these knownconditions stops the plan and returns the decision to the user.

## Approval question scope

Approve adding these three concurrent indexes to the isolated fictional HMSdatabase under3secondlock/60secondstatement bounds and5minutesequence cap, including inspect/remove only ownnewinvalidindex and one exactfailedmigrationresolve/retry if necessary, followed by the reviewedapprelease and boundedfunctionalverification, allFree? Or choose ordinarymaintenancebuild / keeplocal. User must see expected transientresourceimpact, timeout/invalidindexrisk and unchangedrecords/security. No realpatientdata, new costs, persistent policy or account change covered.

## Actual owner approval28November11:43Istanbul

Owner approved the recommended3concurrentindexes plus associatedrelease by direct reply to11:02question. Scope is stop on failure without automatic recovery/retry. This overrides the broader proposed approval/recovery paragraph above: no invalidindexdrop, historyresolve or retry authorized. Sourcebase308bb81includes independentlyreviewed readinesschecker; hostedbase141347bunchanged. NationalIDpolicyapproval is separate and not part of this performance release.
