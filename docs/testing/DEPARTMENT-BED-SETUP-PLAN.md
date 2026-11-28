# Approved department and bed setup plan

Baseline b584561. FR5.1/5.4 and November27 22:09 behavior approval with 22:10 Admin clarification.

Use existing Nest/Prisma/React schema, no framework/database/architecture choice and no new migration for this slice. Admin creates/renames departments, creates/renames unused or existing beds, changes available/maintenance only, deletes unused empty departments or beds without admission history. Doctor/nurse retain admission/discharge. Manager remains read-only here. No patient identities added to Admin bed responses.

Serialize bed setup/count writes on department row, then bed row; match competing admission with status CAS and database FK protection. Reject occupied maintenance/deletion and history-linked deletion. All writes and redacted audit in one transaction, no automatic write retry. Derive totalBeds from actual rows and update cached count atomically on setup add/delete. No bulk replacement or total-only count edit.

DTOs reject null/extra/invalid inputs, UUID path validation. Test unauthorized roles, current actor recheck, cross-workspace404, duplicate bed labels, linked history, audit rollback, concurrent setup/admission and bed-count consistency on actual disposable PostgreSQL17/18. Bilingual mobile/desktop forms with explicit delete confirmation and conflict refresh. Independent review and exact CI precede publication/deployment. No live migration, grants or provider changes. Waitlist schema is a separate future slice and live gate.

Review clarification: occupied bed relabeling remains allowed; only maintenance/delete have occupancy restrictions. Duplicate labels are application-lock protected, not a new database unique constraint. Bounded races are evidence, not exhaustive interleaving proof.
