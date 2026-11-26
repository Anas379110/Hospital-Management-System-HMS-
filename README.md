# Hospital Management System demo

Fictional-data bilingual demonstration in development. The repository contains React/MUI frontend and NestJS/Prisma/PostgreSQL backend implementation. It is not a hospital-ready product or a compliance certification. Do not enter real patient, staff or payment information.

Current workflows include patient registration/search/encounters, appointments, departments/beds/admissions, pharmacy, laboratory/radiology, manually recorded fictional billing and admin-only test-user management. Eight existing backend roles remain authoritative. Capacity10,000 and resilience targets have not been established by current performance or disruption testing.

See [local verification and open gates](./VERIFICATION.md), [API](./docs/api/API.md), [security](./SECURITY.md), and the scoped test instructions in [frontend/test-real-browser/README.md](./frontend/test-real-browser/README.md). Current successful local checks are not a successful hosted CI run or release. Existing legacy design/decision documents may contain historical claims, reconcile them with current code and VERIFICATION.md.

## Local development

Use Node22 and an isolated PostgreSQL test database. In backend and frontend run npm ci --ignore-scripts. Explicitly generate Prisma from backend, then build backend and frontend. npm test runs unit checks; backend npm run test:e2e runs mocked HTTP, not actual PostgreSQL. npm run lint is non-mutating focused correctness checking over declared source/test directories. Read each real-database/browser runner before use; they apply migrations and create fictional retained records, never point them at a live database.

All resources used for this demo must remain free. No payment gateway, real financial processing or clinical advice is provided.
