> Historical record, not current acceptance. Reconciled27 November2026: see [current verification](../../VERIFICATION.md), [requirements traceability](../../docs/requirements/TRACEABILITY.md) and [API contract](../../docs/api/API.md). Old counts, completion statements and release gates below describe an earlier snapshot. Original requirement targets remain open where traceability says partial/missing/unproven.

# Current security review status

Fictional-data demonstration only. Current code and reproducible tests supersede earlier historical mitigation claims. No hospital/legal certification or permanent no-loss guarantee.

## Implemented and locally exercised

- JWT guard resolves persisted active user/current role for every authenticated request. Disabled previous tokens rejected401 and nonpermitted roles403.
- Covered sensitive mutations write one reviewed redacted audit inside their business transaction. Real forced SQL-audit failures roll back mutation; retry checks exact counts. The legacy post-handler fallback is not an atomic guarantee and is bypassed by transaction-marked handlers.
- User search admin-only, bounded2..100characters,50stable results, exactly identity/role/active projection, no hashes. Create identities trimmed/bounded, passwords min8characters/max72UTF8bytes with realHTTP storage evidence. Self/last-admin disable safeguards.
- Patient/encounter, appointment doctor/department/linkage/lifecycle, admissions/bed occupancy, stock/dispense and billing/payment boundaries checked by services and database constraints. Actual concurrent/rollback tests are in backend/test-real-postgres/concurrency.mjs; bilingual UI integration is in frontend/test-real-browser.
- Exception filtering suppresses unknown diagnostic payloads. DTO validation rejects invalid fields. Covered audit snapshots redact credentials, contact data, clinical/free-text fields. Stock audit stores reason category and delta, not raw optional reason.

## Open security/release issues

Audit read audience, denied/auth/read event policy and retention are not decided. Restricted local runtime cannot update/delete/truncate audit rows, but this is not hosted protection or defense against an owner. General in-flight actor validation can race concurrent account disable. Client logout clears local token, not individual server-side revocation.

Current app uses static bundled translations, no untrusted deep resource merge; i18next advisory remains in graph. Dependency scans still show moderate production and high development-tooling findings, not accepted or erased. See VERIFICATION.md for last counts. Insurance coverage0..100 is existing demo scope, no real policy validation or gateway. No stricter business approval policy is invented.

Public-demo session isolation, no reusable privileged demo credentials, load/performance, wider accessibility, actual CI, hosted backup/restore/rollback/health checks remain gates. Real personal data must not be introduced. All automated DB runners require isolated disposable hms_test databases and retain the fictional test data; no live migration authorized by these instructions.
