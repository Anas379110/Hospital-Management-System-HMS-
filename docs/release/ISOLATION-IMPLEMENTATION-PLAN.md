# Public fictional demo isolation implementation plan

Approved scope: 27 November 2026, dedicated free Neon HMS project and Render Free service. No School/Directory changes. Preserve the existing showcase until acceptance. Public source contains no runtime credentials. Each visitor has a separate fictional workspace; audit is visible only to its workspace admin; delete workspace, data and audit after 24 hours without activity.

## Candidate boundary

This separate candidate starts from frozen qualified source plus the narrow frontend development-dependency candidate. Neither candidate is adopted merely by copying it. Frozen PR3 remains unchanged. Run all tests again after implementation, then review exact file and history disclosures before publication.

## Approach and alternatives

Use one database with a workspace key on every domain table, PostgreSQL FORCE ROW LEVEL SECURITY, transaction-local workspace scope and a nonowner/NOBYPASSRLS runtime identity. Composite foreign keys must include workspace identity, including audit actor references. Existing transaction/audit failure behavior must survive. Global unique labels become workspace-local. UUID resource identifiers stay globally unique.

Rejected alternatives: public shared admin/state leaks visitor changes; database branch per visitor exceeds the ten-branch free limit; schema-per-visitor adds DDL authority to the runtime and unbounded schema churn; filtering only in the frontend or controller does not protect forgotten queries.

The server signs workspace-bound demo tokens. No client-supplied workspace identifier is trusted. Bootstrap and expiry require tightly scoped database functions with fixed search_path, not a migration-owner credential in the web process. Demo mode disables ordinary reusable-password login and permits role switching only inside the authenticated visitor's workspace. Bootstrap creates all eight fictional role accounts and minimal fictional fixtures in a bounded transaction.

## Implementation order

1. Add schema migration, RLS, workspace-local uniqueness and composite foreign keys. Test raw SQL isolation with restricted roles first.
2. Add scoped Prisma execution that preserves interactive transaction boundaries and audit atomicity, and rejects unscoped domain queries in demo mode.
3. Add signed workspace bootstrap/role tokens, active-workspace validation, limits and expiry. Never expose a DB role or password.
4. Add bilingual entry/role switching/audit UI and24hour notice. Replace billing UUID-only lookup with a least-fields patient picker.
5. Run all existing unit/HTTP/Postgres/browser suites plus cross-workspace IDOR, poisoned transaction-pool reuse, concurrent visitors, expired token, admin audit denial, fixture isolation, quota limit and expiry-cascade tests. Check actual browser pixels/keyboard/axe in both languages.
6. Create approved free target, apply with migration identity, install restricted runtime role, test actual hosted startup/restore/rollback and all eight roles. CI needs successful execution; support ticket receipt does not waive it.
7. Publish only reviewed source. Keep secrets out of Git history. Cutover only after qualification; do not delete old showcase or unrelated test artifacts.

## Recovery and deletion

Expiry must cascade through all workspace rows including audit, never affect another workspace. Expired tokens fail before reads/writes. Background expiry must not depend only on visitors returning. Render Free has no persistent filesystem or reliable always-on worker. A supported free external scheduler or a database-side scheduler must be qualified before promising wall-clock deletion; access-time expiry alone is insufficient for the approved deletion behavior. Backups must not silently extend retained workspace data beyond the disclosed policy. Establish restoration behavior for expired workspaces before hosted rollout.

## Progress checkpoint27November02:28Istanbul

Approved precision: access expires24hours idle; hourly physical cleanup usually by next hour, provider/quota failures can delay it. Bilingual notice updated. Local cleanup Function source exists, not deployed or scheduler-executed. Dedicated cleanup identity must execute only cleanup function; web runtime must not receive cleanup EXECUTE. Explicitly revoke schema CREATE and migration rights from runtime and cleanup roles. Fixed SECURITY DEFINER functions have public,pg_temp search_path, cannot use caller-provided SQL or IDs for deletion.

Local candidate: both builds and lint pass;129backend unit/25frontend unit pass. Existing50case PostgreSQL regression passes in single fixture workspace baseline mode, not50multi-workspace tests. New actual PostgreSQL/HTTP/browser harness covers24pooled reads/transactions, unscoped rejection, foreign ID404, scoped bootstrap/roles, UUID fixtures, invoice audit, billing lookup3fields, audit billing403/other-visitor empty, composite FK rejection at transaction commit, expiry and cleanup across actual seeded tables+invoice/items/audit. English/Arabic mobile/desktop pixels inspected earlier; policy-expanded notice needs final visual check. All original eight-role workflow/browser suites still need adaptation to workspace bootstrap and full public-demo mode rerun. Cross-workspace FK tests currently one representative edge, not every edge.

Important implementation issues fixed in candidate: Prisma middleware must preserve transaction-local scope across all model/raw operations; request interceptor restores signed scope after authentication. Deferred FK constraints are checked at commit, so negative SQL tests must commit before asserting rejection. PostgreSQL RLS hides partial-unique index metadata from restricted roles; appointment/admission model-specific P2002 null-target maps to existing409domain conflict. No claim of arbitrary unique violations or missing permission as successful business outcomes.

No hosted resources created, no new CI provider installed, no PR3 merge or deployment. GitHub support ticket5064060 watch remains active alongside Ware rights inquiries. Source visibility directive applies only worked projects; existing HMS is already public. Future source push requires manifest and history/private-data review. Narrow dependency and isolation changes remain local candidate. Frozen118source files remain the transfer baseline.

## Hosted provisioning checkpoint02:39
Dedicated Neon project hms-fictional-isolated-demo created in Free plan, Frankfurt, project purple-bread-74748381, branch br-muddy-base-bgbi1vjm, PostgreSQL18. No schema applied. Actual target compatibility not yet qualified. Functions selected, actual deployment/schedule still absent. No Render service yet. Provider history6hours verified in dashboard; UI notice distinguishes live-row cleanup from retained provider recovery history. No external visitor backups. CLI authorization must not widen account permissions silently.

## Local qualification checkpoint27November02:58Istanbul
Six bilingual functional browser suites passed in public-demo mode with restricted app login and signed fixture sessions; anonymous bootstrap and same-workspace UI role-switch separately passed. Production same-origin compiled frontend passed entry keyboard activation,11axe scans and bilingual modal focus trap. All129backend and25frontend units pass, both builds/lint clean. Cleanup Function dependencies are locked,3handler tests/build pass and dependency audit reports0known vulnerabilities. Local cleanup-only login cannot read tables/create schema/bootstrap; web runtime cannot cleanup; repeated cleanup is idempotent. Demo token fixed24h expiry removed to match sliding24h inactivity policy, verified DB deadline advances on activity and expired workspace token fails401. Hosted gates remain open as ISOLATED-DEMO-OPERATIONS.md records. FrozenPR3 rerun is independent of this local candidate.
