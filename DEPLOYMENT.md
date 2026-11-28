> Historical record, not current acceptance. Reconciled27 November2026: see [current verification](VERIFICATION.md), [requirements traceability](docs/requirements/TRACEABILITY.md) and [API contract](docs/api/API.md). Old counts, completion statements and release gates below describe an earlier snapshot. Original requirement targets remain open where traceability says partial/missing/unproven.

# Fictional demo deployment plan

No qualified functional hosted release is claimed. Isolated local PostgreSQL migration/concurrency tests pass. Existing read-only showcase is separate. Historic on-premise product design is not a request to commission a real hospital system.

## Pre-release gates

Use reviewed source on a separate branch with successful actual CI, free standard runner, no paid services or converting trials. Run actual staging/end-to-end checks before replacing the showcase. Resolve public session isolation, no reusable privileged seed login, audit audience/retention, chosen persistence/hosting terms, TLS/CORS and environment separation. No real patient/staff/payment data.

## Build and startup contract

Node22, locked npm ci --ignore-scripts in backend and frontend. Explicit backend Prisma generation, lint/tests/build; frontend lint/tests/build. Actual backend build entry is backend/dist/src/main.js. From backend run npm run start:prod, which executes node dist/src/main.js. The startup contract has been exercised as a child process against isolated PostgreSQL and a protected HTTP401 readiness check, not a hosted health check.

Supply DATABASE_URL, JWT_SECRET and FRONTEND_URL through approved secret configuration on the chosen target. Never commit live values. Migration identity must be separate from restricted application runtime. Additive migrations include active allocation constraints and audit actor restriction; review/apply only with target-specific authorization. Do not run manual duplicate indexes or fictional seed scripts blindly.

## Recovery and operations

Before release verify supported backup/restore on the actual chosen arrangement, independent backup storage, rollback to the known source/configuration, migration compatibility and health checks. Retention/RTO/RPO are not invented. Local test artifacts are retained separately, not deployed. No cancellation/purge policy is silently implemented. Do not change account billing/settings to overcome a banner without explicit scope.
