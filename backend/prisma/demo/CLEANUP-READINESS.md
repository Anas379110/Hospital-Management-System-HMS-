# Bounded cleanup readiness

This control is for the fictional isolated demo, not real patient data.

The existing hourly cleanup writes a singleton success time at the end of its deletion transaction. A rollback preserves the old success time and the old rows. No web request performs cleanup or writes the success time. Bootstrap counts only unexpired workspaces for its 100-workspace cap. Expired rows wait for the scheduled cleanup.

Authenticated requests check readiness before workspace renewal or user lookup. Bootstrap checks before allocation. Fixed-path database bootstrap/touch functions check again. Missing, null, future, pre-restart, or older-than-90-minute success times deny access with a known pre-work 503. Database errors during the initial read also deny access. Health remains database-independent. The client shows maintenance, makes no automatic retry and does not claim an unknown write outcome.

A provider resume that preserves the PostgreSQL start time and has an unexpired success time is not observable by this bounded control. An unexpired session may work until the 90-minute freshness window closes. This is an accepted limitation, not universal provider-resume detection. A request already in progress is not cancelled by this control.

## Existing deployment, approval still required

Keep qualification enabled and traffic off. Apply only the new migration 20261127190000_demo_cleanup_readiness as the migration owner. Apply cleanup-readiness-upgrade.sql as the owner. Existing bootstrap/touch/cleanup ownership and ACL are preserved by CREATE OR REPLACE. Run real cleanup with the cleanup-only identity, then the full structural audit and runtime readiness checks. Review and deploy matching code with AutoDeploy off. Do not activate public traffic until the separate acceptance gate is cleared. There is no provider pause test in this change.

For an empty disposable database, migrations followed by grants.sql assign all new objects correctly. Harnesses invoke real cleanup once before demo access.

## Verification

The isolated PostgreSQL suite covers missing/null, stale, future and pre-start times, actual cleanup recovery, rollback, missing state rollback, singleton constraints and exact runtime/cleanup privileges. Browser isolation tests cover API rejection before touch, recovery, and AR/EN maintenance display without cooldown. CI runs PostgreSQL 17 and 18. Local evidence identifies its actual server version.
