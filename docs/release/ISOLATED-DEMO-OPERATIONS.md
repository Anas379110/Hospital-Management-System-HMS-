# Isolated fictional demo operations

Candidate only. This document is a procedure, not evidence of a hosted deployment.

## Boundaries

Dedicated HMS Neon Free project only. Runtime must not connect to School, Directory or the existing read-only HMS showcase. Do not apply the workspace migration to a populated database. It deliberately fails if legacy users/patients exist. No real hospital/patient data. No paid service, trial conversion, card, Render Cron or plan upgrade.

The web process uses a nonowner, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE login. It may use the two fixed bootstrap/touch functions, but cannot execute cleanup or change schema. Audit rows permit INSERT/SELECT only. Revoke schema CREATE from PUBLIC and both service logins. Domain tables FORCE RLS. Migration/function owner is a separate non-login role, not deployed to web or Function environment.

The cleanup login gets schema USAGE and EXECUTE on hms_cleanup_expired_workspaces() only. No table reads/writes, bootstrap or touch permission. Function runtime requires HMS_CLEANUP_DATABASE_URL and fails closed if absent; never accept the default injected owner DATABASE_URL. The Function source uses a fixed query and ignores request body targets/times.

## Startup

Build frontend with VITE_PUBLIC_DEMO=true and backend with its own generated Prisma client. Production working directory is backend. Nest serves ../frontend/dist same-origin and API at /api/v1. Set HMS_PUBLIC_DEMO=true, strong independent JWT_SECRET, restricted DATABASE_URL, PORT and actual FRONTEND_URL. Do not place credentials in Git or build arguments. No reusable password login in this mode. Production signing uses the database sliding24hour idle deadline, not a conflicting fixed JWT expiry. Every authenticated request verifies an active workspace and active role user; idle expiry and deletion revoke access.

## Retention

Access expires after24hours idle. Hourly cleanup deletes live workspace metadata and cascades domain/audit records, normally by the next hour. Provider outages, quota exhaustion and suspended service can delay physical deletion. Verified provider recovery-history setting was6hours at provisioning; deleted records may remain recoverable there until that window passes. No exported visitor backups. Do not promise irreversible erasure at the sweep.

Neon schedule uses UTC cron 0 * * * *. Before enabling, deploy on Neon's own Functions edge. Its X-Neon-Trigger-Invocation-Id header check relies on that edge stripping client headers and is not portable authentication. Qualify an actual platform-triggered invocation and inspect resulting live database state, not only an HTTP200. A synthetic header in a unit test proves handler logic only. The first test cadence must be changed back to hourly promptly; no persistent rapid polling of logged-in provider accounts.

## Restore and rollback

No visitor-data export/import. Provider recovery can resurrect expired workspaces, so quarantine any restored branch from public web/Function access. Run the expiry cleanup with the restricted cleanup identity before binding public traffic. Check that expired test workspace remains inaccessible/deleted and a current fictional control workspace survives. Do not connect production web to a restore point until that check passes. Provider history expires; Free recovery is not a promised business backup.

Rollback application release by restoring the prior reviewed artifact/environment on the new isolated service only. Do not point the isolated application at the old showcase database or deploy frozen PR3 as an isolated demo. Schema rollback by deleting workspace columns would destroy the security boundary and is not supported. If schema recovery is required, restore to a quarantined branch, clean expired records, and requalify. Keep existing showcase unchanged until acceptance. If startup fails, leave new service unavailable rather than fall back to an owner credential or shared data.

## Outstanding hosted evidence

Project exists, database empty. Project-only deployment key is explicitly approved but unavailable because user sees Block access on Neon settings; cause unknown. A valid secure vault request remains, no token minted. PostgreSQL18 target compatibility, role grants, migrations, actual Function deployment/scheduler, cleanup after scale-zero, quarantined restore, production restart and Render deployment are not yet verified. No launch claim until these gates close.

Sources checked27November2026: https://neon.com/docs/compute/functions/triggers/schedule and https://neon.com/docs/compute/functions/triggers/overview . Current provider settings must be rechecked at deployment.

## Review/CI scope

Frozen source commit8270b0b passed GitHub Actions run45908226570 attempt2 on27November2026, independently of this isolation candidate. Candidate source is not adopted by that result. The separate candidate workflow targets PostgreSQL17and18 and six public-mode functional browser suites. Source publication is not merge, deployment or acceptance. Local production bootstrap/expiry/11axe evidence exists separately; candidate remote matrix must run and its exact commit/result be recorded.
