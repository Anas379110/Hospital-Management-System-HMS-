# HMS API contract

Reconciled27 November2026 against implementation2ad6bb2. All records must be fictional. This demo is not a clinical product or a legal/compliance certification.

## Base and generated reference

The versioned base is `/api/v1`, relative to the deployment origin. Public demonstration: https://hms-isolated-qualification.onrender.com/ . `hms.local` in historical documents was a proposed intranet hostname, not an existing service.

[openapi.yaml](openapi.yaml) is a JSON-formatted YAML1.2-compatible OpenAPI3.0.3 document. It contains44actual controller operations plus public-only liveness, derived from compiled Nest controller paths, guards, role metadata and class-validator DTO metadata.26body/query DTO schemas are emitted, including inherited optional patient-update fields, numeric limits, nested invoice items and enum values. This is not an assertion of exhaustive service response schemas. The former hand-written file and default Swagger output omitted current routes or field validation. The generator deliberately leaves unverified result shapes unspecified.

Regenerate from backend after `npm ci --ignore-scripts`, Prisma generate and build:

```
node test-real-postgres/export-openapi.mjs
node test-real-postgres/export-openapi.mjs --check
```

[ROUTE-INVENTORY.json](ROUTE-INVENTORY.json) lists exact controller source, method, path, role and guard metadata. No database/network connection is required to generate or check it. The live `/api/docs` view remains default Nest Swagger and has incomplete DTO schemas; use this checked reference until a separately tested runtime documentation change is deployed.

## Authentication and isolation

- Normal non-public mode: `POST /auth/login` takes username/password; protected routes use `Authorization: Bearer <JWT>`. Every authenticated request rechecks the persisted user's active status and role.
- Public demo mode: password login is disabled. Anonymous `POST /demo/start` creates a fictional isolated workspace and receptionist token. `POST /demo/role` chooses one of its eight fictional users. This is intentional demonstration role switching, not a production authorization feature.
- Public JWTs contain workspace/kind, without a fixed expiry. The database enforces sliding24hour idle expiry. Every protected request requires a fresh cleanup heartbeat and a successful workspace touch. Each workspace is scoped using transaction-local RLS. No real patient/staff/payment data.
- `GET /demo/audit` is public-demo workspace-admin-only, latest100redacted events. It is404outside public mode.
- `POST /auth/logout` returns success but does not revoke a JWT server-side. The client deletes its token. User disable and workspace expiry are independent rejection paths. Do not call logout server revocation.
- Public `GET /health` is DB-independent liveness. A200does not prove database readiness, cleanup freshness or functional health.

## Authorization

Exact roles per operation are in OpenAPI `x-roles` and the inventory, derived from the same metadata used by RolesGuard. RolesGuard fails closed without explicit role metadata. Authenticated auth routes and demo role switching use their own JwtAuthGuard, not RolesGuard.

Important boundaries: patient detail is receptionist/doctor/nurse/admin/manager, not every authenticated role. Billing clerk uses `GET /patients/billing-lookup?search=` with onlyid/MRN/name, not medical details. Departments list is receptionist/doctor/nurse/admin/manager. Bed identity is included only for doctor/nurse, not manager/admin. Admission/discharge is doctor/nurse, not automatic admin override. Encounter/prescription/test-order creation is doctor-only with service-level encounter ownership checks. Administrative user search/create/status is admin-only. Invoice read is billing_clerk/admin/manager; invoice writes are billing_clerk/admin. Pharmacy writes are pharmacist/admin; result entry is lab_tech/admin. See inventory for all remaining operations.

## Validation and error behavior

Global validation transforms DTO inputs, strips unknown fields by rejecting non-whitelisted properties, and reports invalid DTOs as400. `IsOptional` also accepts null at DTO level; downstream service/database rules can reject an invalid null. Unknown resources commonly return404, conflicting business state409, missing/expired/inactive session401, denied role403, throttling429, temporary audit/readiness/capacity rejection503. These are common classes, not a claim every route emits every class. The filter normalizes errors as:

```
{"error":{"code":"STRING_CODE","message":"Human-readable message","details":[]}}
```

The generated success codes use actual `@HttpCode` overrides or Nest defaults: normal POST201, login/logout200, GET/PATCH/DELETE200.

## Queries, bounds and service rules

There is no universal `page/limit` contract. Do not add pagination parameters to arbitrary lists based on the historical API file.

- Patients search: `search` name/MRN/phone substring, at most20rows, no offset parameter. Empty search returns up to20. Duplicate check is exact name+DOB;409possible duplicate includes an ID/MRN. `force=true` explicitly overrides the warning. National-ID duplicate matching remains an original requirement gap. Patient PATCH excludes DOB/gender. MRNs allocate the next conforming suffix transactionally with an advisory lock, not row count.
- Billing lookup: trimmed search2..80characters, at most20minimal identity results. Shorter query returns[]rather than revealing a roster.
- Users search: required trimmed2..100characters, at most50minimal records; no password hashes. Password creation8..72UTF8bytes, with ordinary length and user/role validation as generated.
- Appointment list: optional doctor_idUUID, legacy date strictYYYY-MM-DDUTCday, paired timezone-qualified start/endinstants, start-inclusive/end-exclusive, maximum31days. Explicit range wins overdate; without either, currentUTCday. Optional page1..10000returns at most100ordered by scheduledAtthenID. Withoutpage, compatibility maximum500, with400APPOINTMENT_RANGE_TOO_LARGEabove that. Offset pages are not stable snapshots. Options returns active doctorID/nameand departmentID/namesonly. Update/cancel rejects non-scheduled or encounter-linked appointments. Only time and department are updateable. No no-show/completed transition route currently exists.
- Department overview: required timezone-qualified start/end, valid positive interval at most26hours. Snapshot contains appointment count and bed-state counts, not clinical patient details. The local setup candidate adds seven Admin writes, described below; hosted b584561 does not yet include them. Cross-client bed updates do not use WebSocket/SSE or polling guarantees.
- Medical records returns non-soft-deleted encounters newest-first with prescriptions. Test results are a separate route used on the patient UI. No universal timeline combining all billing/admission/test activity is claimed.
- Pharmacy pending/stock and lab pending lists are not universally paginated. Stock delta must be nonzero signed32bitrange. Optional reasonCode is restock/correction/disposal. Free-text stock reason and clinical content are excluded/redacted from audit.
- Invoice amounts are integer fictional minor units. Up to50initial items, quantity>=1andunitPrice>=0. Coverage0..100, rounded patient responsibility. Safe-integer bounds checked in service. No real payment gateway. Overpayment/concurrent conflict rejected; fully paid/cancelled invoices lock item addition. Zero-responsibility invoice status behavior remains a traceability edge case, not silently declared complete.

## Transactions, audit and limits

Covered business writes persist redacted audit in the same DB transaction; audit insert failure rolls the mutation back with503. Controllers mark these as transactional to bypass the legacy post-handler interceptor fallback. That legacy interceptor remains in source, but must not be described as the safety boundary for current covered writes. This is not a universal audit of every read or external event.

Global throttling is100requests/minute per configured connection key and controller/handler bucket, not per authenticated user. Login5/minute; demo start3/minute. Public Render routing uses the documented Cloudflare identity mode and conservative shared fallback; normal local mode uses ExpressIP. Public request/transaction capacity is bounded24perinstance, with shared resources and retryable503. These limits remain enabled in the local10kqualification.

No rate control is a guarantee against distributed abuse. Two-real-network bucket separation remains unmeasured. Public Free hosting may cold-start50seconds or longer. Cleanup follows the documented heartbeat boundary, not an absolute all-provider-resume or permanent-erasure guarantee. See [operations](../release/ISOLATED-DEMO-OPERATIONS.md), [cleanup readiness](../../backend/prisma/demo/CLEANUP-READINESS.md), [traceability](../requirements/TRACEABILITY.md) and [verification](../../VERIFICATION.md).

## Generated-reference boundaries

The generated file inventories controller routes whether or not a particular deployment mode makes a route usable. `/demo/*` is usable only in public mode; outside it the service returns404. Health is public-mode middleware only. All exposed controller routes are under the actual global throttle even where the snapshot does not repeat deployment-specific limits in each operation. `x-guards`/`x-roles` record metadata, not a claim all service-level outcomes are enumerated.

The snapshot does not model every Transform decorator: username/fullName/user-search trimming is described here and enforced by current DTOs, not inferred as an OpenAPI regex. Named primitive query parameters do not get DTO nullability automatically. `force=true` is a literal string comparison, not a universal boolean conversion. Unknown non-DTO query parameters are not uniformly rejected by global DTO validation. Query nullable flags originate from optional DTO metadata and are not a promise that URLstrings are converted to JSONnull. Inspect service rules before constructing a client from this reference.


## Native Nest documentation (2026-11-27)

The live application's native Swagger UI is served at `/api/docs`, with JSON at
`/api/docs-json`. Both use `backend/src/api-documentation.ts`. The checked-in
`docs/api/native-openapi.json` snapshot records that same runtime builder.
All 24 request schemas now have explicit native annotations; three search DTOs
are represented as query parameters. All 45 controller operations include role,
security, status-code and query metadata. The independent offline reference and
route inventory remain a separate check, not the document served by Swagger.

Success response bodies are deliberately not described as verified response
DTOs. Status descriptions are present, but service-defined result shapes still
need a separate response-contract round. This change fixes empty request models;
it does not finish every API or hospital workflow requirement.

After `npm run build` in `backend`, run:

```sh
node test-real-postgres/export-openapi.mjs --check
node --test test-real-postgres/openapi-contract.test.mjs test-real-postgres/native-openapi.test.mjs
```

Regenerate the native snapshot only after reviewing intentional annotation
changes: `node test-real-postgres/native-openapi.test.mjs --snapshot`.
The native contract gate compares every request field, required property,
validator constraint, route role, bearer requirement and reference status code.
It also checks query limits and snapshot drift. The HTTP documentation test
serves the real Nest Swagger UI/JSON with a mocked Prisma provider, not a live
PostgreSQL database. Local visual inspection covered 1280px desktop and 390px
mobile request schema views. No live database, deployment, workflow policy or
provider setting is changed by documentation generation or these tests.

### Scope and known validation/service mismatch

The annotation contract checks describe DTO validation and declared controller
metadata, not every service-thrown error or all possible database failures.
Documented response-code sets mirror the independent controller reference;
they are not an exhaustive service error catalogue. Query string transforms
(for example trimmed user search and number conversion for appointment pages)
remain runtime behavior, not fully expressible by these schema constraints.
`x-auth` explicitly distinguishes public, any-authenticated-user and role-limited
operations; `x-roles: []` alone must not be read as public access.

`UpdatePatientDto` has exactly six optional properties and excludes dateOfBirth
and gender. The shared ValidationPipe rejects either excluded field with400
because forbidNonWhitelisted is enabled, rather than silently stripping it.
The earlier PartialType/IsOptional behavior accepted null fullName or phone,
although both database columns are non-nullable. The follow-up remediation now
uses explicit update-field validation: omitted fullName/phone remain optional,
explicit null is rejected with400 before the patient write. The other four
nullable fields still allow null clearing. The six-field patch scope and
DOB/gender exclusion are unchanged. Regression tests cover both DTO boundaries
and authenticated HTTP rejection before patient.update. No live DB migration
or workflow-policy change is required.

No-DB ValidationPipe tests compare accepted/rejected boundary values against the
actual native schemas/query parameters: patient name2/3, invoice item count
0/1/50/51, quantity0/1, coverage100/101, appointment page0/1/10000/10001,
user search1/2/100/101. HTTP docs tests use the production application setup
through an injected Nest test-app factory with mocked Prisma, isolated database
URL and restored environment. No live database is contacted by those tests.


## Manual appointment attendance

`POST /appointments/{id}/attendance` accepts exactly `{ "status": "completed" }`
or `{ "status": "no_show" }`. Admin and receptionist only. Attendance is manual;
creating or completing an encounter does not silently record attendance.
Only scheduled appointments can change. Completed, no_show and cancelled are
final, including an identical repeat request. A linked encounter blocks no_show,
but does not block manual completed. The appointment row lock is shared with
encounter creation. Mutation and redacted audit commit together.

- 201: status and one attendance audit committed.
- 400: malformed appointment UUID or invalid/missing/null/extra body property.
- 401/403: current authentication/role does not permit this action.
- 404 `APPOINTMENT_NOT_FOUND`: absent or inaccessible in current workspace.
- 409 `APPOINTMENT_FINAL` or `APPOINTMENT_HAS_ENCOUNTER`: no write or attendance
  audit. Client closes the stale confirmation, refreshes, and asks the user to
  check current state before choosing again. It never retries the write.
- 503 `AUDIT_PERSISTENCE_FAILED`: status mutation rolled back. Other network/5xx
  failures have unknown outcomes and must not be automatically retried.

These service statuses are explicitly included for this new endpoint. Other
routes' declared status sets are still not exhaustive service-error catalogues.

## Admin department/bed setup candidate

Local-only candidate after b584561, not yet reviewed/deployed. Seven Admin-only writes: POST /departments, PATCH/DELETE /departments/{id}, POST /departments/{id}/beds, PATCH/DELETE /departments/{id}/beds/{bedId}, PATCH /departments/{id}/beds/{bedId}/maintenance. Both localized department names are required, trimmed and max120; bed label required trimmed max40, unique per department through serialized setup. UUID parameters and strict DTO whitelist. Maintenance accepts available/maintenance only, never occupied. Current active Admin rechecked inside transaction. Doctor/nurse alone retain admission/discharge.

Department row lock serializes setup/count operations, followed by bed row lock. Admission uses status CAS; references/row locks protect concurrent deletion. Occupied maintenance rejected409; relabeling an occupied bed is permitted without changing its identity or history. Any admission history prevents bed deletion; any beds or appointment history prevents department deletion. Successful unused deletion retains explicit redacted audit. All setup writes and audit atomic; audit failure503 rolls back. Count updated from actual beds on add/delete, not entered as a free number. No schema/grant/provider change in this candidate.

## Waitlist candidate, not yet deployed
GET /departments/:departmentId/waitlist?page=0 returns100pending items perpage, page andtotal.
POST samepath with patientId recordsmanualrequest. POST /:id/cancel closespendingrequest.
Allthree doctor/nurse only, currentactiveactor rechecked, no newAdmin/Managerclinicalidentity.
IDsUUIDvalidated, page0..10000, extraDTOkeysrejected. GET items containrequestid/department/
requestedAt/status andpatient{id,fullName,mrn}. Noautoadmit, no reservation or clinicaltriage.
Timestampascending andIDtie order is deterministic but not strictarrivalpriority for ties.
Crosspage reads may shift with concurrentchanges. Duplicatepending/closed/requestconflict409,
scopedmissing404; auditfailure503 rollsback write. Uncertainwrite shouldbereadback, never
blindlyretried. Histories retained inDB/audit, pending-only list not a newhistoryscreen.

## Narrow native response schemas, local candidate November28
Patient create/detail/update/search now describe their existing complete scalar row payload, including required-but-nullable optional columns and date-time serialization. Billing lookup remains a separate minimal identity projection (`id`, `mrn`, `fullName`), never the full patient row. Search remains capped at20, not silently paginated. Waitlist pending list uses a separate identity projection/page/count contract from full scalar create/cancel write results. Common error envelope is `{error:{code,message,details}}`; details can contain validation strings or redacted objects, so no false universal detail shape is promised. No query/serializer/permission/data-field changes. Medical-record nested and other response contracts remain service-defined. Actual restricted PostgreSQL response/schema tests must pass before publication; these annotations alone prove no new access.

## Clinical response contract continuation, local candidate
Nine additional success responses are described: encounter create/soft-delete scalar, encounter detail and patient medical records with prescription arrays, prescription creation scalar, test-order creation/completion/current patient results scalar, and pending queue with only patient fullName/MRN and ordering-user fullName nested. Existing route roles and current query/serializer output do not change. Nullable stored fields remain required keys with null values. Lists that lack pagination remain unbounded; the documentation does not claim otherwise. A nonexistent or foreign patient test-result lookup currently yields an empty list, not a new404 assertion. Soft-deleting an encounter hides it from encounter/medical-record reads but does not remove already completed test results. No amendment/clinical signoff workflow is implied by a completed result. This narrow contract still does not cover every response in the API.

### Pharmacy response contracts, November28 candidate
Six existing pharmacy success responses now have explicit native schemas: medication create/list/low-stock scalar rows, stock-adjustment row with required delta and optional nullable echoed reason, pending prescriptions with only nested encounter patient fullName/MRN and doctor fullName, and dispensed prescription scalar. No query, serializer, role, database or workflow change. Inventory and pending lists are unbounded. Free-text reason is echoed when supplied (null allowed), omitted when absent, and remains redacted in audit. The prescription enum includes unavailable as stored schema vocabulary only, not an implemented unavailable workflow. Existing conflict/notfound/auth error envelopes are tested without claiming every service failure is exhaustively annotated.

### Admission response contracts, November28 candidate
Admission create and discharge describe existing complete scalar Admission row, with required nullable dischargedAt/dischargeNotes and date-time serialization. No nested patient/doctor identity or new policy. Omitted/null notes persist as null; supplied string is echoed. Existing conflicts/auth/isolation unchanged. No service/query/serializer/audience change or new one-admission-per-patient rule.
