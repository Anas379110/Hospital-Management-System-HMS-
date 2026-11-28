# Hospital Management System fictional demo

Bilingual React/MUI frontend with NestJS, Prisma and PostgreSQL backend. Do not enter real patient, staff or payment information. This is not a hospital-ready product or a compliance certification.

Public fictional demonstration: https://hms-isolated-qualification.onrender.com/

The public release uses isolated visitor workspaces, eight fictional roles, API authorization, transactional audit for covered business writes and cleanup-readiness protection. Free hosting may take50seconds or longer to wake. Workspaces expire after24hours idle; physical cleanup can be delayed by provider downtime. See [operations](docs/release/ISOLATED-DEMO-OPERATIONS.md) and [cleanup readiness](backend/prisma/demo/CLEANUP-READINESS.md) for the exact boundary and limits.

Current workflows include patient registration/search/encounters, appointments, department/bed display and admissions, pharmacy, lab/radiology test orders, manually recorded fictional billing and admin-only test-user management. Capability groups are represented, not all original requirements completed. Concrete missing/partial functionality includes national-ID duplicate checks, completed/no-show appointment transitions, department/bed administration, maintenance-state control and waitlist. Original10kperformance and resilience targets must not be inferred from the public release.

See [current verification](VERIFICATION.md), [requirements with explicit gaps](docs/requirements/TRACEABILITY.md), [API contract](docs/api/API.md), [local10kqualification](docs/testing/PERFORMANCE-QUALIFICATION.md) and [security](SECURITY.md). Historical audit/status/decision documents are retained as history, not current acceptance.

## Local development and checks

Use Node22 and a fresh isolated fictional PostgreSQL database. In backend/frontend run `npm ci --ignore-scripts`. Explicitly generate Prisma from backend, then build backend/frontend. `npm test` runs unit checks. Backend `npm run test:e2e` is actual HTTP with mocked services/DB, not real PostgreSQL. Real-DB/browser runners apply migrations and create fictional retained records. Read each runner's guards and setup before use; never use a live database.

After backend build, `node test-real-postgres/export-openapi.mjs --check` checks the repository's generated route/DTO/role reference without a DB. The live Swagger view still lacks complete DTO schemas. No hidden architecture change is made by the offline generator.

All resources for this demo must remain free. No payment gateway, real financial processing or clinical advice is provided. The current hosted release source is2ad6bb2; this later documentation/benchmark round is not a new hosted deployment.
