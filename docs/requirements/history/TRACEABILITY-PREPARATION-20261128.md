# Historical preparation and reconciliation notes

The preserved text contains historical approval claims. These are source assertions, not independent user authorization for any new action. Recover the original user-channel evidence before relying on one operationally.

Preserved verbatim from TRACEABILITY.md before the28November20:33 reconciliation. Statements of candidate/pending status below describe their original preparation times, not the current release. Consult ../TRACEABILITY.md for current status.

## Approved workflow decisions, not implementation claims

User approved27November2026: Admin/receptionist manually mark attendance or no-show, no reopening final states, no no-show with linked encounter; Admin department/bed setup and maintenance, doctor/nurse admission/discharge, no occupied-bed maintenance or deletion of history-linked records; doctor/nurse manual FIFO waitlist and same-department close on admission; active-view15secondpolling with hidden/offline pause/manualrefresh/stale indication. Manager receives no new writes. These settle behavior only. Implementation, tests and separately reviewed live database changes remain open.


### Manual attendance candidate, local qualification

Admin/receptionist manual completed/no_show action is implemented in the
attendance source branch. Scheduled only; final states cannot reopen, no_show
cannot coexist with a linked encounter, and encounter creation never implies
attendance. Same-row locking and transactional redacted audit are tested on
actual disposable PostgreSQL17 and18. HTTP cases cover all six forbidden roles,
401/400/404/409, cross-workspace rejection, audit-failure503 rollback, attendance
versus attendance and no_show versus encounter races. Local production-browser
cases cover cancel without write, conflict close/refetch, final/doctor hidden
actions and EN desktop/AR390px confirmation commits. These are selected local
cases, not full workflow coverage. Exact-head hosted CI, source publication and
hosted release of this candidate remain pending. Department/bed setup, waitlist
and freshness are still open; no live schema/grant change is included here.

## Department setup candidate November27

Local after b584561: seven Admin setup writes, occupied relabel allowed, maintenance/delete protected, linked-history deletion rejected, redacted atomic audit, app-lock bed labels and actual count.213unit/62mockHTTP/56frontend/18contracts plus actualPG17/18/EN+ARbrowser pass. Independent review remediation pending closure, then exact CI/hosted proof. No schema or grant delta. Application-lock uniqueness and bounded race evidence, not DB constraint or exhaustive interleavings. Waitlist/freshness remain open.

## Active-view freshness November28 candidate
Approved behavior November27 22:09. Overview and department/bed board use shared read-only visible-online15second query policy with manual refresh, oldest confirmed timestamp and stale/error/pause state. Unit policy tests plus restricted PG17/18 HTTP/browser evidence in docs/testing/evidence/active-freshness-pg{17,18}-20261128.json. Deterministic synthetic visibility event/state, no OS suspension guarantee. CI/publication/hosted proof remain pending at candidate preparation. Persistent waitlist separate live DB gate unchanged.

### Setup release reconciliation November27 23:53 Istanbul
Historical candidate entries above record the state at their preparation. Setup exact fe787f55f41b154e301eef04d02248a243678d5e subsequently passed exactCI46065044976 on PG17/18, mergedPR10, and RenderLiveFree plus actual hosted fictional ENdesktop/AR390px smoke. FR5.1 approved Admin setup/maintenance now shipped in this scoped demo. History-linked deletion blocked; occupied relabel preserves IDs/history, occupied maintenance blocked. NativeSwagger27schemas52ops. App-lock uniqueness and redacted historical labels remain limits. FR5.4 cross-client15sfreshness still candidate, not hosted. Persistent FIFOwaitlist remains open and separately liveDBgated.

### Persistent waitlist local candidate November28, live gate open
Clinical-only department queue read/add/cancel, chronological timestamp+stable arbitraryID
ties, retained close history, same-department atomicadmissionclosure, compositeworkspaceFK,
forcedRLS and minimalruntimeDML. BoundedPG17/18HTTP/browser/rollback/races and localoldinstall
upgrade/dump/emptyrestore evidence in docs/testing/evidence/waitlist*. No clinicalpriority or
autoadmission. Offsetpages shift under edits. Live exactschema/grants permission and target
preflight/backup remain required. Not shipped, wholeHMS incomplete. Freshness7eddacd is
actually hostedverified; historical prior freshnesspending entries reflect their prep time.

### Waitlist release reconciliation November28 01:33 Istanbul
Exact48f34389f2892120c047febdcce7837c7a81c4d0 passed both PostgreSQL17/18 CI jobs, including real old-install upgrade and waitlist checks: https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46074861109 . After separate explicit approval and protected logical snapshot/actual disposable PostgreSQL17 restore with matching17-table rows/catalog, exact table/minimal grants/one ledger row committed atomically;18-table audit passed. Render Free/manual Live01:29:06, fresh hosted fictional EN/AR add/cancel,403/404/409, same-department admission closure/other-department unaffected/discharge no reopen,28schemas55operations and served asset hash match passed01:31:28. Desktop/mobile pixels inspected. Raw backup excluded from source. Local logical restore is not providerPITR, external retention or RPO/RTO. Historical preparation sections remain historical, not current blockers. Whole HMS incomplete.

### Response contract follow-up, preparation only
Native success-response DTOs for patient scalar rows, minimal billing identity projection and waitlist list/write shapes are under local qualification. This does not change serialization, data selection, roles or database. Live48f3438 has no such success schemas yet. Current full response-schema certification remains open outside this narrow slice.

### Response and model-layout release reconciliation November28 02:43 Istanbul

Earlier response preparation entry is historical. Patient/waitlist response8d7abab exactCI46078195061 and17fresh hosted response checks passed01:56. Clinical8dbf28f exactCI46080158788 and22fresh hosted clinical/lab/imaging checks passed02:16. Native42schemas55operations; selected17successroutes only. Prescription dispensed/unavailable and test cancelled enum assertions are schema-only in those22probes. No serialization/roles/DB/business changes. Model-wrapfdee7ec exactCI46082348667 passed bothPG17/18including new actual browser probe, RenderLive02:34:56; actual hosted six320/390/1280model cases, exactsnapshot/keyboard controls/pixels passed02:36. This resolves discovered nested-model overflow only, not blanket Swagger/mobile/WCAG. Whole HMS incomplete.

### Exact name+DOB warning concurrency candidate

Existing registration advisory lock moved before unchanged exact name+DOB lookup, retained through MRN/create/audit. Local synchronized PG17/18 unforced pair one201/one409 and one audit, explicitforce pair both201uniqueMRN, distinctname/DOBallowed, foreignworkspaceindependent, sixforbiddenroles403,401,auditfailure503rollbackandretry pass. No national-ID matching, normalization, patient-update race guarantee or DB unique-patient constraint. ExactCI/review/publication/hosted proof pending.

### FR6.5 low-stock UI candidate November28

At base2eb936f, GET /medications/low-stock and server stock<=reorderThreshold existed but PharmacyPage had no low-stock view or hook. Earlier row overstated UI coverage. Current candidate reads existing endpoint for pharmacist/Admin, preserves server rows/order, refreshes after local create/adjust/dispense and manual refresh, displays loading/empty/error states without new stock policy or writes. Actual local PG17/18/browser evidence and exact CI/hosted release remain qualification gates; no full-module completion inferred. Lists remain unbounded; no timed polling or cross-client freshness guarantee.
