# Persistent waitlist candidate, live execution NOT authorized

CONFIRMED behavior from authenticated November27 22:09 user approval: doctor/nurse
manual request or cancel, chronological display, no invented medical priority or
automatic admission, same-department successful admission closes pending request.
This approval explicitly excludes subsequent live database changes.

## Candidate and audience

Existing PostgreSQL/Nest/React architecture is unchanged. Add one table with seven
foreign keys, two CHECKs, a partial pending-uniqueness index and chronological
read index. No old-row rewrite, trigger, function, role creation or provider setting.
The table uses existing expiring-workspace RLS and deferred composite workspace FKs.
Clinical-only identity reads preserve current bed-board identity audience.
canAdmitPatient is exactly doctor/nurse. Admin/manager get no new queue access.
Read response contains only id/name/MRN for the patient. Audit contains identifiers,
not demographic or clinical text. Add/cancel/admit serialize on department first.

## Exact owner gate, still required

Before asking permission, finish independent review and exact-head fullPG17/18 CI.
Then make current read-only target checks for project identity, current migration
set, table absence, roles/membership/ACL, inherited defaults, PUBLIC and provider
role grants, TLS, function bodies and scheduler/readiness. Do not reuse an old
preflight. Stop if target differs. Record SQL SHA256 and target project in the
approval request, explain locks and rollback, obtain explicit approval for both
migration and exact grants. No continuation/thumbs-up on prior freshness report
supplies this permission.

## Proposed change mechanics, NOT a command to execute

Use the owner's supported TLS route. Verify existing executor can SET existing
hms_migration and has REFERENCES on old parents. Keep application on old release
until atomic DB commit and structural readback succeeds. Use one transaction,
SET LOCAL lock_timeout='3s', statement_timeout='30s', then exact migration SQL and
waitlist-grants.sql and exact Prisma ledger record using shared waitlist-upgrade-transaction.mjs. It verifies old ledger/checksums, advisory transaction lock, newtable absence and pinnedSQLhashes; full structural audit runs before commit. Audit failure rolls back table/grants/ledger together. Abort on timeout/drift/error, no automatic retries or
termination of other sessions. Grant delta transfers only the new table to
hms_migration, revokes PUBLIC/runtime/cleanup/provider-role access to that table,
and gives runtime SELECT INSERT UPDATE only. Do not rerun broad fresh-install
grants.sql on an existing database. No runtime DELETE/TRUNCATE/REFERENCES/TRIGGER.
Full structural audit now expects18tables and specifically denies waitlist DELETE.
No cron/pause/heartbeat/provider/config edits belong to this slice.

Each referenced parent briefly needs FK DDL locking; the new table itself is
empty. This is not zero-downtime certification. Transactions already running on
old application can finish safely, but after DB verification deploy reviewed app
and run fictional hosted add/cancel/admit/error/bilingual smoke. Never deploy the
new app before table and minimal grants exist.

## Backup and undo

A local same-cluster matching-version custom-format dump/restore is tested onPG17
andPG18. It compares every old row before/after additive migration, whole public
row digests and catalog on empty distinct restore, and restored runtime RLS/denied
DELETE. Local cron catalog fixtures and omitted TLS predicate are not provider
scheduler/TLS proof. Local restore shares cluster roles and is not role reconstruction,
PITR, external backup retention, or RPO/RTO guarantee.

Before approved live execution, capture a protected logical backup using supported
current read-only owner access, verify dump and a disposable restore (no overwrite
of source). A separately approved live backup/storage destination is required if
it introduces new disclosure or paid storage. Current local proof alone does not
mean live backup exists. During a precommit failure transaction rollback undoes
new table/grants. After commit use application rollback to7eddacd preserving new
queue history. Do not DROP the table or restore over live data as an automatic
rollback. Any destructive recovery is a separate decision. Old app simply ignores
new table, and approved workspace expiry cascade still removes expired demo data.

## Limits

Offset pages can shift after concurrent insert/cancel/admission. Re-read for current
state, not a historical snapshot across pages. Tied timestamps use UUID as a stable
arbitrary tiebreak, not strict arrival/triage priority. UI removes rank numbers.
Unknown write notices persist through refresh/dialog opening. There is no retry
queue or automatic recovery write. Active-only list and retained DB/audit history,
not a new clinical history screen. Bounded races/tests are not exhaustive proofs.
