## Bounded whole-demo local outcome, 28 November 2026

Independent R2 plan and R3 source/local-outcome reviews accepted the bounded extension. Actual local PostgreSQL17r7 and18r1 both complete EN1280 and AR390 with eight fictional roles, captured entity states, one actual committed DELETE lost-reply/hold/reload/review without resend per language, stopped-source same-host independent-cluster restore, 18-table/security checks and same-origin existing sessions. Manager coverage is sequential end-state only; optional409 scenarios were not newly run. New runner helper is hashed in each report. Failed setup/observer/selector attempts are preserved, not counted as passes. No application, schema, role, retention or policy change. Exact remote CI for this changed runner is pending, not inferred from local success; deployed application remains qualificationd13de91 and no test/docs-only redeploy is required. See `docs/testing/evidence/whole-demo-local-20261128.json` (repository-root path). Whole HMS incomplete; no humanUAT, hosted-recovery, independent-media, physical power-loss, offline-installer or legal-compliance acceptance implied.

# Current requirements traceability

Reconciled28 November2026 at20:33 Istanbul against qualification/actual Render d13de91aea6b2f17844bbe7594aa2f1133bf32d2, tree992c1ff0866f06cf8f434eef34243547b4e57588. Exact tested source c7fb2ee91a5574a5c65cf6e85382ba2d8d737128 and release branch4fef1e2248abea8f5e5ee385710a9f47c417c37f share that tree. This file supersedes the historical57/57all-covered claim, not the original requirements. Original SRS targets stay intact. Implemented means code exists, not complete acceptance, clinical readiness or legal certification. Tests below name actual suites, without asserting each suite proves every stated requirement.

## Evidence key

- Unit/mock: `backend/test/unit/*.spec.ts` and `backend/test/e2e/*.e2e-spec.ts`. The latter use actual HTTP/validation/guards with mocked services/DB, not real PostgreSQL.
- Real DB: `backend/test-real-postgres/concurrency.mjs`, `cleanup-readiness.mjs`, `cleanup-upgrade.mjs`, actual migrations and compiled services/HTTP.
- Real browser: `frontend/test-real-browser/public-{clinical,stock,workflows,appointments,billing,users}.mjs` and `isolation.mjs`, actual public-mode app and isolated fictional PostgreSQL. Scoped views/scenarios, not all possible role/state combinations.
- Local performance: `backend/test-real-postgres/performance.mjs`, `docs/testing/evidence/performance-pg17-20261127.json` and `performance-pg18-20261127.json`. Actual local HTTP+nonownerRLS DB, not mocks and not hosted performance.
- Local crash: `backend/test-real-postgres/crash-recovery.mjs`, `docs/testing/evidence/crash-recovery-pg18-20261127.json`, observed committed rows/audits retained and uncommitted sentinel absent after immediate process stop/restart, not WAL or physical-power-loss certification.
- Local restore/offline: [qualification and limits](../testing/BACKUP-OFFLINE-QUALIFICATION.md), actual logical restorePG17/18andproductionbrowser external-network denial. These do not establish daily backups, independent-host disaster recovery or full intranet deployment.
- Current controller/DTO/role paths: [route inventory](../api/ROUTE-INVENTORY.json), generated [OpenAPI](../api/openapi.yaml), [API service rules](../api/API.md).
- Exact source hosted CI: https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46169159959 , PostgreSQL17and18. Public fictional demonstration https://hms-isolated-qualification.onrender.com/ . CI is execution evidence for named suites, not every original requirement.

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
| FR2.5 duplicate name+DOB OR nationalID warning | exact name+DOB and literal nonblank nationalID warning409+force=true; public clinical browser and current patientDuplicateRace | Released literal nonblank national-ID OR exact name+DOB warning, manual force override; name+DOB serialization released. No ID trim/case/digit normalization, competing-match precedence, update-race guarantee or unique-person constraint. MRN uniqueness is separate |
| FR3.1 appointment booking patient/doctor/department | appointment service active-doctor and relation checks; public-appointments | Implemented scoped workflow |
| FR3.2 same-doctor same-time conflict | DBpartialuniqueindex and service409; actual DB races | Implemented exact instant collision, not duration-overlap scheduling |
| FR3.3 update/cancel optional reason | time/department update and cancel service, linked/non-scheduled lock; public browser | Implemented scoped workflow, doctor/patient reassignment not supported |
| FR3.4 daily/weekly schedule per doctor | list filters/range/page, bounded31dayinterval; appointment browser | Implemented list/day-range views, not a separate calendar-grid UI |
| FR3.5 scheduled/attended/no-show/cancelled lifecycle | schema has scheduled/completed/no_show/cancelled, UI labels, booking/cancel code | Shipped scoped explicit Admin/reception attendance transition in371841a, PG17/18 CI46058985102 and actual hosted verification. No automatic encounter-to-attendance transition or reopen inferred |
| FR4.1 encounter with complaint/diagnosis/notes, optional appointment | encounters service ownership/relation guards; clinical/browser and real DB | Released doctor linked/standalone UI with fresh appointment validation and durable unknown-outcome review; appointment remains consumed after logical deletion. Exact-time lookup first100 has a fail-closed completeness limit |
| FR4.2 prescription linked to encounter | encounters service+UI, pharmacy tests | Released optional multiline prescription notes and history plus per-user/patient/tab unknown-outcome hold. No clinical dosing, edit/delete or server idempotency claim |
| FR4.3 chronological medical records | patients records endpoint descencounterDatewithprescriptions; separate test-results route/UI | Implemented scoped records. No universal combined longitudinal activity timeline |
| FR4.4 soft-delete with reason | encounter ownership+reason DTO, service tests and rollback coverage | Released owner-doctor/Admin UI with reason/confirmation and strict response identity. Retains stored encounter/prescriptions/completed test history; linked appointment consumed. Visibility404 is not commit proof; pending hold per user/patient/tab. One observed overlap is not universal ordering. Demo expiry physically deletes fictional data, unlike real-record retention |
| FR5.1 define departments/bed counts | existing schema plus seven released Admin setup writes and bilingual UI | Shipped approved Admin setup in fe787f5 with reviewed PG17/18 CI46065044976 and actual hosted EN/AR create/maintenance proof. See preserved historical release reconciliation; seeded fixtures alone do not count |
| FR5.2 admit only available bed | admissions service+transactional bed state, DB contention, browser | Implemented scoped workflow |
| FR5.3 discharge time/state | admissions service+audit/rollback; browser | Implemented scoped workflow |
| FR5.4 bed states current to all clients | APIreadsstates, local mutation cache invalidation | Shipped approved active-view15s polling/manual refresh in7eddacd, reviewed PG17/18 CI46070063934 and measured hosted cross-client update. Hidden/offline pause and stale warning. Not instant delivery or OS suspension guarantee |

## Extended FR6..8

| Requirement | Actual code / evidence | Status and remaining limit |
| --- | --- | --- |
| FR6.1 inventory management | medications create/stock adjustment and reasoncodes; pharmacy unit/mock/public-stock | Implemented stock quantity workflows; general medication metadata editing not exposed |
| FR6.2 pending prescriptions | pharmacy pendingroute/UI; stock browser | Implemented scoped workflow, not universal pagination |
| FR6.3 atomic dispense/decrement | service transaction/locks/audit; actual DB concurrency+public-stock | Implemented fictional workflow |
| FR6.4 insufficient stock no partial deduction |409androllbacktests | Implemented/tested scoped contention |
| FR6.5 reorder list stock<=threshold | lowStock service/API, LowStock component, useLowStock hook and current lowStock report | Released bilingual read-only pharmacist/Admin low-stock UI with manual/local-mutation refresh. Unbounded list, no polling/cross-client freshness or automatic purchasing |
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

- UC1no available bed: shipped exact48f3438 clinical-only persistent queue, explicit add/cancel and atomic same-department admission closure. PG17/18 CI46074861109, protected backup/disposable restore and separately approved additive live operation; actual hosted add/cancel/role/isolation/closure verified November28 01:31. Other department unaffected, no automatic admission or medical priority. Timestamp ties use arbitrary stable ID, offset pages shift.
- UC1state update for every viewer/US5near-realtime: approved active-view15secondpolling/manualrefresh shipped7eddacd with measured cross-client hosted evidence; pause hidden/offline and show stale state. Timestamp is last confirmed read, not server push. Do not assert immediate propagation.
- UC2out-of-stock alternative: safe rejection exists. Alternative-drug suggestion and persistent unavailable/shortage workflow not implemented as an accepted clinical decision process. Optional original wording does not establish a clinical substitution requirement.
- Eight roles and eleven capability groups are represented, not eleven completed requirement certificates.

## Nonfunctional targets, unchanged

| Target | Current evidence | Acceptance status |
| --- | --- | --- |
|10k+patients and basicAPI<300msonmediumserver/normal load | actual local10k+40fixture,1and4concurrentclientbenchmark, all600timedsamplesperrun<300msinactualguardedPG17.12andPG18.7reruns | Bounded local evidence only. Medium-server definition, representative normal workload and Free hosted performance not established. Separate explicit synthetic rich-history HTTP scenario exists, not a clinical workload certification |
| bcrypt/HTTPS/audit/API RBAC | bcrypt, hostedHTTPS, transaction audit and scoped authorization checks | Scoped engineering evidence. Not deployment-wide/intranetTLS or security certification |
| intranet without internet + daily local backup | proposed deployment files, local source/dependencies | Partial local evidence: actual logical dump/restorePG17/18matched all public rows/catalogs and restricted RLS/audit protections; measured production browser paths made no external requests with external routing denied. Current exact CI also runs preinstalled-dependency local production EN/AR journeys and stopped-source independent-cluster restore on the same host,18tables/security checks and same-origin session recovery. Full network-disconnected clean install, independent physical storage and scheduled daily backup remain unqualified |
| no loss on sudden power failure | DBtransactions, recorded rollback/contention checks and localPG18process-crash recovery preservingcommits/rejectinguncommittedsentinel | Physical power-loss target not established. Transactions do not prove physical power-loss durability; backup/restore/crash matrix required |
| RTL/LTR and clear contrast | scoped Arabic/English pixel/axe checks | Scoped passed views, no full route/state/browser/WCAG certification |
| i18n and OpenAPI | existing translations; native shared runtime Swagger and independent offline metadata contract; exactCI and actual hosted docsJSON/UI verified | Later patient/clinical/pharmacy/admission/department/setup/appointment response-contract checks are present in exact combined CI. Historical42schema/17route counts are not a current total; consult generated OpenAPI and named report keys rather than inferring universal coverage.320/390/1280tested model wrapping shippedfdee7ec. fullName/phone nullPATCH400/readback verified. Universal responses/strings/WCAG not certified |
| cited legal compliance | historical SRS names a statute | Unverified legal target, no assertion that citation or compliance is correct; needs current legal/source review for any actual deployment |
| modular monolith / future FHIR | module layout and domain entities | Architecture shape exists; extraction/FHIR interoperability not demonstrated |

## Acceptance rule

A row changes to accepted only with source, named execution/evidence and limits. A unit/mock suite does not become real PostgreSQL evidence; localhost does not become hosted qualification; a public demo release does not close original functional gaps. Preserve original requirements until the user changes them.

## Current release evidence and limits

Current exact CI [46169159959](https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46169159959) is terminal success on PG17/18. Each waitlist report has19named combined checks and92non-dist source hashes; both full manifests match. This count is not19requirements or exhaustive acceptance. Current hosted fictional soft-delete run17:28:55–17:29:33Z and3servedJS hashes match CI. [Render deploy](https://dashboard.render.com/web/srv-dc4nf1bl550s73a0unhg/deploys/dep-dc5gso2jnfac73d5r1rg) is Live on qualificationd13de91, not the distinct exact CI commitc7fb2ee. Full-tree equivalence is recorded.

| Released slice | Source / named evidence | Remaining limit |
| --- | --- | --- |
| Exact name+DOB warning serialization |552ddc8; CI46084720712; current patientDuplicateRace report | Registration scope, no normalization/update-race guarantee |
| Literal national-ID warning |a5074cc; CI46130651815; prior hosted409/cancel/force201 EN/AR | Blank IDs excluded; literal equality, no unique-person guarantee |
| Six-field patient edit |c56104e; CI46135839101; current patientEditing report | DOB/gender excluded, last-writer-wins, per-tab holds |
| Clinical notes/history |a137b58; CI46143267310; current clinicalNotes report | No visit-edit workflow or universal navigation protection |
| Medication create and corrected acknowledgment |2eb936f; CI46149482178; current medicationCreate report | Supersedes preliminarye382a72; dedicated fresh read is not proof a delayed write is terminal |
| Low-stock UI |17162d5; CI46151881450; current lowStock report | No timed/cross-client refresh, metadata edit or clinical substitution |
| Encounter/prescription outcome guards |2a6074a and210a547; current encounterAck/prescriptionSafety reports | Per-tab scoped hold, no server idempotency/cross-tab guarantee |
| Prescription notes |1d9a94b; CI46162144364; current prescriptionNotes report | Prior failed candidate runs remain historical, not passing evidence |
| Appointment-linked encounter UI |5ea5229 tested,1e87e90 deployed; CI46165746129; current appointmentEncounter | First100exact-time lookup, no implicit attendance/relink |
| Logical encounter deletion UI |c7fb2ee tested,d13de91 deployed; CI46169159959; current encounterDelete | Mobile confirmation-only pixels; hosted no stored-row/auditfault/otherdoctor/foreign fixture; those CI only |

[Existing evidence inspection](../testing/evidence/current-demo-reconciliation-20261128.json) records current local-recovery report hashes, source/script matches and scope. Current exact CI local recovery reports are complete on PG17/18: ENdesktop and AR390 journeys, production assets, UI bootstrap/role switching,18table restore verification and existing same-origin sessions. This is already executed evidence, not a new missing implementation. It does not carry the newer linked encounter/notes/delete states through that same recovery journey, and it does not exercise Manager or Admin setup as part of that coherent journey. Those are targeted integration-evidence gaps, not claims that the separate modules are absent.

Human five-person UAT has not been performed or established by these automated tests. See [next bounded plan](../testing/WHOLE-DEMO-E2E-RECOVERY-PLAN.md). Original functional/NFR targets remain unchanged, including unresolved DOB/gender and zero-responsibility invoice semantics. No default decision is created here. Optional alternative-drug wording grants no substitution automation. The demo remains fictional and wholeHMS incomplete.

## Historical provenance

[Preserved preparation/reconciliation notes](history/TRACEABILITY-PREPARATION-20261128.md) retain original candidate states and later reconciliations. They are not current blockers or replacement acceptance. No new role, DB, retention, clinical or billing policy is selected by this reconciliation. Historical statements about approval are retained as provenance, not independent authorization for new actions; any new effect must recover the original user-channel evidence.
