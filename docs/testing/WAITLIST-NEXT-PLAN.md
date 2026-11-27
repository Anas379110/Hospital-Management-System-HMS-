# Persistent waitlist next slice proposal

Existing approved behavior November27 22:09: doctor/nurse manually add or cancel a request, chronological FIFO display, no invented clinical priority or automatic admission. Admission to the same department closes a pending request atomically. Admin setup does not grant clinical waitlist writes. No implementation or live DB change yet.

Within the chosen PostgreSQL/Nest/React architecture, add a dedicated persistent request table, not a fake client-only list. Required fields: stable ID/workspace/patient/department, pending/admitted/cancelled status, original queue timestamp, closed timestamp and actor references. No unnecessary clinical narrative. Partial unique pending workspace+patient+department prevents duplicate pending requests; stable creation timestamp plus ID tie-break makes display deterministic. Composite workspace foreign keys, forced RLS/policy/indexes and minimal runtime grants match current isolation model. Preserve closed history, no hard delete workflow.

API list scoped by department/workspace; doctor/nurse add and cancel explicit state transition. Recheck active actor transactionally, validate patient/current department, row locking consistent with department/bed/admission lock order. Atomic audit with redacted identifiers. Existing admission path closes matching pending request only after successful admission, same transaction and audit, rollback keeps queue pending. No immediate auto-admit when a bed becomes free, FIFO display is not assumed medical triage or a forced admission-selection rule.

UI doctor/nurse queue and add/cancel confirmations, explicit no-available-bed path, last-confirmed/stale read control reused only after freshness slice passes. Existing read-role scope needs source/permission grounding before widening audience. UX includes pending/closed statuses, count and empty/full states, conflict refetch, no blind retry after uncertain writes.

Tests before publication: malformed DTO/UUID,401/403, cross-workspace visibility and FK rejection, duplicate add races, cancel/admit races, same-department close and other-department untouched, audit failure rollback and runtime grant denial, linked department deletion protections, chronological ties, retained history, clean emptyPG17/18 migration/restore proof, browser bilingual desktop/mobile, unknown write outcomes, independent review.

Live gate: prepare additive SQL and current source-of-truth read-only target checks, impact/lock/rollback limitations, owner/runtime roles and grant delta, expected no existing-data rewrite, backup and disposable restore proof. Obtain explicit approval for this exact live schema/grant operation before applying. General continue and behavior approval do not approve it. Independent local work may proceed while that decision is pending.

Local draft started after freshness closeout: additive scalar Prisma model, forced-RLS/compositeFK/partialunique/check constraints SQL candidate and separate minimal SELECT/INSERT/UPDATE runtime grant delta. Schema validate passes with dummy local URL, no database connection/execution. NOT migrated, tested, reviewed, published or deployed. Existing new-install grants.sql grants all-tableDML, so must explicitly REVOKE DELETE on waitlist after broad grant and preserve cleanup cascade before readiness. Restore/rollback must retain history and use application rollback rather than unapproved table drop. Migration owner privileges/FK REFERENCES grants and lock_timeout/source checks remain review work.

Open operational details: clinical-only read endpoint is conservative match to current bed-identity permission and approved clinical writers, but ground original context before final audience selection. Queue lock order must align admission/cancel/add and department deletion. Clock order server timestamp plusID tie-break; do not invent medical priority or forcedFIFO admission selection. Same-department admission should close pending request only, transaction rollback and audit atomicity. No live action is covered by this local draft.

Local followup November28: source candidate now implements clinical-only read/add/cancel,
atomic matching admission closure and history protection. Native docs28schemas55ops.
LocalPG17/18 functional/browser and old-install additiveupgrade/matchingversionlogicalrestore
reports are under evidence/waitlist*. New tests bind executed inputs by SHA256.
All remain local candidate evidence, not live schema approval, deployment or completion.
UI no longer numbers tied timestamps as strict arrival rank. Offset pages can shift on
concurrent edits. Unknown write warning remains through refresh and dialog reopening.
See backend/prisma/demo/WAITLIST-UPGRADE.md for non-executable owner gate and backup/undo limits.
