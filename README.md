# Hospital Management System

Bilingual Arabic/English hospital-management application with a NestJS API, React interface, Prisma and PostgreSQL. Source code is present in `backend/` and `frontend/`.

## Current status

Development and isolated fictional-data qualification, not a hospital deployment or clinical approval. Modules cover patients, appointments, encounters, departments/admissions, pharmacy, laboratory and billing with role-based access. Real-world capacity, resilience and clinical suitability have not been established by the local tests.

The November24candidate is documented in [HMS-QUALIFICATION-20261124.md](./HMS-QUALIFICATION-20261124.md). It includes appointment concurrency protection, patient-form validation and bilingual duplicate warnings. That note distinguishes individually verified tests from an unavailable final combined validation result. Do not treat the candidate as fully qualified or deployed.

## Local development

Use separate development and qualification databases. Never point development seeds or tests at a real patient database. Set local connection/auth values privately, not in source control.

- Backend: install dependencies in `backend/`, generate Prisma Client, configure an isolated database, review/apply migrations, then build/start using the package scripts.
- Frontend: install dependencies in `frontend/`, then use its development/build scripts. The UI expects the API under `/api/v1`.
- Before the appointment-slot migration on an existing database, run the read-only `backend/scripts/check-appointment-slots.mjs`. Stop if duplicates or database-access errors are reported. Do not automatically cancel or delete records to make a migration pass.
- Real database regression tests require explicit `HMS_REAL_DB_TEST=1` and a loopback database named `hms_*qualification`. They create fictional fixtures only and are separate from mocked HTTP tests.

Existing seed credentials are development examples, not deployable access credentials. Never publish a seeded authenticated instance with those defaults.

## Deployment limits

The documented architecture is on-premise. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the existing plan, including unresolved server, backup, restore, security and human-UAT requirements. A fictional-data demonstration is not a live hospital system. No public demo or hospital launch is claimed here.

Dependency advisories remain tracked, including moderate findings. Passing selected tests does not establish a clean dependency audit or security certification.
