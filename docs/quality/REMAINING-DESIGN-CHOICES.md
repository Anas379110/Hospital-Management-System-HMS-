# Remaining HMS design choices

27 November2026. These are proposals for the original requirements, not permission to change a live database/deployment. Existing demo release remains unchanged. Routine source/tests/docs can continue; substantive workflow/architecture choices should be settled before implementation.

## 1. Source-derived API documentation

Observed: default live Nest Swagger has44controlleroperations but empty body DTO schemas because validation decorators alone do not populate Swagger property metadata. The checked offline generator now derives26DTOschemas plus route/role metadata. That is a repository-reference repair, not a live product fix.

|Option|What changes|Tradeoff|
|---|---|---|
|A. Keep offline generator only|No runtime change; checked file/inventory available to developers|Lowest runtime risk, but live `/api/docs` continues misleading empty schemas; not enough to close API documentation target|
|B. Add Swagger DTO property decorators + explicit query/response annotations|Native Nest tooling, runtime and exported document use the same decorators; contract tests check fields/roles/routes|Best fit for existing architecture. Requires maintaining validation and OpenAPI metadata together, plus tests to prevent drift. Response annotations need actual result contracts, not assumptions|
|C. Enable Nest Swagger compiler plugin|Infer DTO schemas from TypeScript and validators, build-time generation|Less repetition but build/config/plugin inference differences and inherited DTO/nested/query behavior need qualification. Does not automatically document all service response semantics|
|D. Embed the checked generated snapshot at runtime|One generated artifact serves live/docs/export after build validation|Avoids hand duplication, but custom generator becomes runtime build dependency and must cover all validators/edge cases; offline snapshot can drift from the live source unless CI enforces it|

Recommendation: B, incremental native source annotations and contract tests, keep the offline metadata generator as an independent drift audit rather than make the custom exporter a new runtime schema engine. Start request/query/roles, then define actual response DTOs per route. No new paid tool/database/framework. C is a viable alternative if build inference is preferred; compare its generated schema on inherited/nested DTOs before choosing. None is silently deployed by this docs round.

## 2. Appointments completed/no-show

Original FR3.5 is not satisfied by enum values/labels alone. Choices: explicit staff `status` transition route versus automatic completed state when an encounter is created. Automatic completion confuses encounter start with completed visit; it also makes cancellation/soft-delete/reopen semantics implicit. Recommendation: explicit additive status transition with guarded role, permitted state machine and transactional audit, with attended/completed wording confirmed. Decide who can mark no-show/attended and whether encounter-linked appointments may be reopened. Do not invent these permissions from booking roles.

## 3. Department/bed administration and freshness

Original FR5.1/5.4 need more than seed/read views. Recommendation: additive admin-only department/bed create/edit and maintenance transition with transactional conflict checks, no destructive delete of occupied/history-linked beds. But role choice, bed identifier uniqueness, whether capacity is derived from bed rows, and occupied-to-maintenance policy require explicit design acceptance. Retain eight existing roles. For cross-client state, bounded polling is simpler for this monolith/Free demo; WebSocket/SSE adds reconnect, scale and hosting behavior. Agree a freshness bound before claiming realtime. Neither mechanism can promise instant visibility during offline clients.

## 4. No-bed waitlist

The stated UC1 alternative requires durable workflow, not a client-only list. Options: A. persistent per-department request with waiting/admitted/cancelled transitions and audit; B. transient UI pending selection, which does not satisfy durable waitlist; C. defer after explicit requirement change. Recommendation A for the original target, with priority/FIFO rules, duplicate active request handling, authorized actors, transfer/cancel rules and whether admission is ever automatic settled first. This is an additive data model and a substantive workflow decision, not a routine docs fix. No clinical triage algorithm inferred.

## 5. Duplicate patient and billing edges

National-ID duplicate warning can extend current exact name+DOB warning without hard-blocking registration. Need normalization policy and whether concurrent duplicate warnings should be serialized. DOB/gender correction needs explicit permission/audit scope, not a silent removal of the existing guardrail. Zero-responsibility invoices need a deliberate settled/paid/unpaid interpretation; no money is processed, but staff-facing totals/status must agree. Tests should cover0%,100%,zero-priced items and repeated payments.

## 6. Resilience toward the original target

Current transactions/rollback and scoped unknown-write handling are narrower than no data loss on sudden physical power failure. Two deployment alternatives must not be conflated:

- Free public cloud demo: provider availability, quotas and cleanup/readiness boundary remain. No unsupported physical power-cut or provider-restore guarantee. Do not use disruptive tests against it.
- Local intranet deployment: package all runtime assets, explicitly inventory external calls, pin dependencies, verify browser works without internet, document local HTTPS/auth setup and daily backup/restore. A disposable PostgreSQL process-crash/restart test plus `pg_dump`/restore checks can provide source-grounded engineering evidence without pretending to certify power-loss hardware durability. True power protection/WAL/storage guarantees require the intended machine and backup media, outside an app-only test.

Recommendation: develop repeatable local offline deployment and disposable crash+backup/restore qualification first, with explicit RPO/RTO targets and limitations. Compare plain `pg_dump` scheduled backups versus physical/WAL archives before selecting a retention architecture. A local process crash is not a sudden hardware power cut. Existing fictional-demo24hour cleanup is not suitable real-record retention and must never be silently reused for real hospital data.
