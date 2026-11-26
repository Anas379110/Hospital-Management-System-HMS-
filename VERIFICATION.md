# HMS local verification

Fictional-data demo in development, not a hospital-ready release. Existing React/NestJS/Prisma/PostgreSQL architecture retained. No real patient, staff or payment data is permitted.

Implemented current-session role/active-user checks, transactional redacted audit for covered business mutations, appointment lifecycle/range/options UI, safer inventory/admissions/clinical flows, manual fictional billing items/payments and admin-only user management. Sensitive writes have atomic failure rollback/retry evidence. Database migrations are additive and locally tested, not hosted-applied.

Local qualification:129backendunit,35mockedHTTP,50actualPostgreSQLchecks,25frontendunit, both builds. Six bilingual real-browser workflows pass in isolated fictional databases. Focused src lint/correctness rules pass, not complete repository/style/a11y certification. All-dependency high tooling advisories remain unresolved; production scans have0high/critical but still moderate findings. No GitHub CI success or functional hosted launch claimed.

Open: audit read audience/retention, public demo isolation, wider performance/accessibility, scoped billing lookup, hosted restore/rollback and release verification. Existing showcase is read-only and separate.
