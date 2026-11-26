# Security status

Fictional-data demonstration only, not a clinical product or legal compliance certification. Do not enter real patient, staff or payment information.

## Verified local behavior

Authentication uses bcrypt12password hashes and JWT bearer headers. Current persisted active state/role is checked on authenticated requests, rejecting disabled prior tokens and disallowed roles. Create-user passwords are8characters minimum and72UTF8bytes maximum to prevent bcrypt truncation. No password/hash is returned by the management search. DTO validation is globally configured with transformation and unknown-field rejection.

Covered sensitive business mutations write redacted trusted audit records inside the same Prisma transaction. Forced SQL audit-insert failures roll back the mutation; successful retries are checked for exactly one audit. The legacy post-handler interceptor is not an atomic durability guarantee. Local restricted-runtime PostgreSQL tests reject audit UPDATE/DELETE/TRUNCATE; this does not establish hosted configuration or owner/superuser defenses.

Exception responses hide unknown internal diagnostics. Prisma parameterization and constrained service operations are used; raw SQL in isolated tests intentionally installs failure fixtures. The application does not process real payments. Insurance percentage0..100 is existing fictional demo behavior, not verification of a real policy.

## Unverified or open

Audit reader audience, authentication/read/denied-event logging and retention await a scoped policy. Client logout clears local token, not individual server-side token revocation. An in-flight transaction may outlive concurrent account disable. Transport TLS, hosted CORS/environment, deployment credentials and database privileges must be verified on the actual selected launch arrangement, not inferred from local source. No live or hosted migration has been applied by this current work.

Production dependency scans have no high/critical findings but have8backendmoderate and1frontendmoderate; development graphs still contain high findings. Counts are current scan findings, not exploitability guarantees. Current translation resource path uses static bundles, no untrusted deep resource merge. No advisory is automatically accepted or erased.

No qualified current GitHub CI or functional hosted launch. Public demo session isolation, wider accessibility/performance, backup restore/rollback and health verification remain release gates. See VERIFICATION.md and individual reproducible test scripts. All tests require isolated fictional databases, never live data. All resources must remain free.
