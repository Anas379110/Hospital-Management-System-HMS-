# Current requirements traceability

Reconciled27 November2026 against2ad6bb2. This file supersedes the historical57/57all-covered claim, not the original requirements. Original SRS targets stay intact. Implemented means code exists, not complete acceptance, clinical readiness or legal certification. Tests below name actual suites, without asserting each suite proves every stated requirement.

## Evidence key

- Unit/mock: `backend/test/unit/*.spec.ts` and `backend/test/e2e/*.e2e-spec.ts`. The latter use actual HTTP/validation/guards with mocked services/DB, not real PostgreSQL.
- Real DB: `backend/test-real-postgres/concurrency.mjs`, `cleanup-readiness.mjs`, `cleanup-upgrade.mjs`, actual migrations and compiled services/HTTP.
- Real browser: `frontend/test-real-browser/public-{clinical,stock,workflows,appointments,billing,users}.mjs` and `isolation.mjs`, actual public-mode app and isolated fictional PostgreSQL. Scoped views/scenarios, not all possible role/state combinations.
- Local performance: `backend/test-real-postgres/performance.mjs`, `docs/testing/evidence/performance-pg17-20261127.json` and `performance-pg18-20261127.json`. Actual local HTTP+nonownerRLS DB, not mocks and not hosted performance.
- Local crash: `backend/test-real-postgres/crash-recovery.mjs`, `docs/testing/evidence/crash-recovery-pg18-20261127.json`, observed committed rows/audits retained and uncommitted sentinel absent after immediate process stop/restart, not WAL or physical-power-loss certification.
- Current controller/DTO/role paths: [route inventory](../api/ROUTE-INVENTORY.json), generated [OpenAPI](../api/openapi.yaml), [API service rules](../api/API.md).
- Exact source hosted CI: https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46032128551 , PostgreSQL17and18. Public fictional demonstration https://hms-isolated-qualification.onrender.com/ . CI is execution evidence for named suites, not every original requirement.

## Original FR1..5

| Requirement | Actual code / evidence | Status and remaining limit |
| --- | --- | --- |
| FR1.1 five initial roles, extended to eight | schema Role; users controller/service; users unit/mock/public-browser; isolation role checks | Implemented eight roles, scoped role checks. Not exhaustive role-by-state UAT |
| FR1.2 username/password hashed | auth service bcrypt; auth/JWT unit/mock; public mode explicitly disables password login | Implemented non-public mode. Public demo switches fictional identities intentionally |
| FR1.3 API authorization | JwtAuthGuard, RolesGuard, per-controller metadata; service actor/ownership checks; isolation | Implemented at current exposed routes, not production authorization certification |
| FR1.4 sensitive mutation audit | transaction-audit and admission-audit, marked controller writes, rollback/race/audit-safety tests | Implemented for covered writes; redacted metadata/diffs rather than all sensitive values. Not universal read/external-event logging |
| FR1.5 admin creates/disables users | users controller/service; public-users real browser; users unit/mock | Implemented scoped workflows, current persisted user checked on requests |
| FR2.1 patient registration fields | CreatePatientDto, patients service/UI; unit/mock/public-clinical; final hosted create/readback | Implemented fictional workflow, DTO constraints documented |
| FR2.2 unique automatic MRN | transactional advisory lock/max suffix, per-workspace unique index; real concurrency;10k+40unique | Implemented/tested for recorded scenarios |
| FR2.3 name/MRN/phone search | patients service, take20; browser and local10k search | Implemented first20only, no full pagination |
| FR2.4 update plus audit | UpdatePatientDto excludes DOB/gender; transaction-audit; clinical browser/service tests | Partial interpretation: ordinary demographic edits supported, DOB/gender correction not supported; original text did not explicitly exclude those fields |
| FR2.5 duplicate name+DOB OR nationalID warning | exact name+DOB409+force=true; public clinical browser | Partial. NationalID not checked and concurrent duplicate-name races not prevented. MRN uniqueness is a different guarantee |
| FR3.1 appointment booking patient/doctor/department | appointment service active-doctor and relation checks; public-appointments | Implemented scoped workflow |
| FR3.2 same-doctor same-time conflict | DBpartialuniqueindex and service409; actual DB races | Implemented exact instant collision, not duration-overlap scheduling |
| FR3.3 update/cancel optional reason | time/department update and cancel service, linked/non-scheduled lock; public browser | Implemented scoped workflow, doctor/patient reassignment not supported |
| FR3.4 daily/weekly schedule per doctor | list filters/range/page, bounded31dayinterval; appointment browser | Implemented list/day-range views, not a separate calendar-grid UI |
| FR3.5 scheduled/attended/no-show/cancelled lifecycle | schema has scheduled/completed/no_show/cancelled, UI labels, booking/cancel code | Partial. No staff route/UI to mark completed/attended or no-show. Encounter creation does not update appointment status |
| FR4.1 encounter with complaint/diagnosis/notes, optional appointment | encounters service ownership/relation guards; clinical/browser and real DB | Implemented scoped workflow |
| FR4.2 prescription linked to encounter | encounters service+UI, pharmacy tests | Implemented fictional prescription. No clinical dosing/safety claim |
| FR4.3 chronological medical records | patients records endpoint descencounterDatewithprescriptions; separate test-results route/UI | Implemented scoped records. No universal combined longitudinal activity timeline |
| FR4.4 soft-delete with reason | encounter ownership+reason DTO, service tests and rollback coverage | Implemented domain soft-delete. Demo workspace expiry intentionally physically deletes fictional data, unlike real-record retention |
| FR5.1 define departments/bed counts | schema and seed, list/beds read routes | Partial. No staff department/bed setup mutations or UI; seeded fixtures are not administration functionality |
| FR5.2 admit only available bed | admissions service+transactional bed state, DB contention, browser | Implemented scoped workflow |
| FR5.3 discharge time/state | admissions service+audit/rollback; browser | Implemented scoped workflow |
| FR5.4 bed states current to all clients | APIreadsstates, local mutation cache invalidation | Partial. No staff maintenance-state mutation and no cross-client realtime/polling freshness guarantee |

## Extended FR6..8

| Requirement | Actual code / evidence | Status and remaining limit |
| --- | --- | --- |
| FR6.1 inventory management | medications create/stock adjustment and reasoncodes; pharmacy unit/mock/public-stock | Implemented stock quantity workflows; general medication metadata editing not exposed |
| FR6.2 pending prescriptions | pharmacy pendingroute/UI; stock browser | Implemented scoped workflow, not universal pagination |
| FR6.3 atomic dispense/decrement | service transaction/locks/audit; actual DB concurrency+public-stock | Implemented fictional workflow |
| FR6.4 insufficient stock no partial deduction |409androllbacktests | Implemented/tested scoped contention |
| FR6.5 reorder list stock<=threshold | lowStockservice+unit/mock/browser | Implemented scoped workflow |
| FR7.1 order lab/radiology against encounter | doctor-owned encounter/patient match, service and clinical tests | Implemented shared typed test-order workflow, no separate imaging subsystem |
| FR7.2 pending test queue | lab.pendingOrders+UI | Implemented first-party queue, unbounded list |
| FR7.3 result text/notes complete | lab.recordResultlock/transition/audit, service/DB/browser | Implemented one-time pending-to-completed fictional result; no clinical approval/amendment workflow |
| FR7.4 results in patient record UI | separate patient test-results route consumed in detail | Implemented scoped UI display |
| FR8.1 invoice/items | billing service+DTO+UI, public-billing | Implemented fictional workflow, up to50initialitems |
| FR8.2 add items before paid/cancelled | service locks+audit, unit/DB/browser | Implemented positive payable cases; no cancellation mutation exists |
| FR8.3 simple0..100coverage | computeTotalsandrounding, tests | Implemented creation-time percentage, not insurer integration |
| FR8.4 payments reject overbalance | transactional rowlocks/safe-integer checks; DB races/browser | Implemented manual fictional records, not payment processing |
| FR8.5 derive unpaid/partial/paid | computeTotals/deriveStatus, tests | Partial edge: zero-responsibility invoice currently derives unpaid, not paid/settled. Need explicit accepted semantics and tests |

## Use-case alternatives and unresolved decisions

- UC1no available bed: missing persistent waitlist and queue UI. Current rejection/empty options do not satisfy the stated waitlist alternative.
- UC1state update for every viewer/US5near-realtime: no measured cross-client freshness target. Choose bounded polling versus push only after explicit alternatives, do not assert immediate propagation.
- UC2out-of-stock alternative: safe rejection exists. Alternative-drug suggestion and persistent unavailable/shortage workflow not implemented as an accepted clinical decision process. Optional original wording does not establish a clinical substitution requirement.
- Eight roles and eleven capability groups are represented, not eleven completed requirement certificates.

## Nonfunctional targets, unchanged

| Target | Current evidence | Acceptance status |
| --- | --- | --- |
|10k+patients and basicAPI<300msonmediumserver/normal load | actual local10k+40fixture,1and4concurrentclientbenchmark, all600timedsamplesperrun<300msinactualguardedPG17.12andPG18.7reruns | Bounded local evidence only. Medium-server definition, normal workload, rich related history and Free hosted performance not established |
| bcrypt/HTTPS/audit/API RBAC | bcrypt, hostedHTTPS, transaction audit and scoped authorization checks | Scoped engineering evidence. Not deployment-wide/intranetTLS or security certification |
| intranet without internet + daily local backup | proposed deployment files, local source/dependencies | Not qualified. Browser asset/runtime dependency inventory and repeatable offline deployment/backup/restore remain |
| no loss on sudden power failure | DBtransactions, recorded rollback/contention checks and localPG18process-crash recovery preservingcommits/rejectinguncommittedsentinel | Physical power-loss target not established. Transactions do not prove physical power-loss durability; backup/restore/crash matrix required |
| RTL/LTR and clear contrast | scoped Arabic/English pixel/axe checks | Scoped passed views, no full route/state/browser/WCAG certification |
| i18n and OpenAPI | existing translations; offline generated metadata contract | Partial. Live Swagger DTO schemas empty; generator fixes checked repository reference, not live view. Full response schema and all strings not certified |
| cited legal compliance | historical SRS names a statute | Unverified legal target, no assertion that citation or compliance is correct; needs current legal/source review for any actual deployment |
| modular monolith / future FHIR | module layout and domain entities | Architecture shape exists; extraction/FHIR interoperability not demonstrated |

## Acceptance rule

A row changes to accepted only with source, named execution/evidence and limits. A unit/mock suite does not become real PostgreSQL evidence; localhost does not become hosted qualification; a public demo release does not close original functional gaps. Preserve original requirements until the user changes them.
