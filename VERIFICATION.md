# HMS verification and open requirements

Reconciled28 November2026 02:43 Istanbul. Fictional-data demonstration, not hospital readiness or compliance certification. Latest verified public release fdee7ece38c73431758f6ef9e0bf40aa749fe8d5. Earlier evidence remains historical and does not establish newer source execution.

## Executed release evidence

- Exact-source CI on PostgreSQL17and18 passed: https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46032128551 . The workflow records unit, mocked HTTP, builds/lint/audits, actual PostgreSQL concurrency/readiness/upgrade and scoped real-browser/isolation checks. A passing workflow is not universal requirements coverage.
- Reviewed isolated migration/upgrade and restricted runtime/readiness source are present in `backend/prisma/demo`. Actual scheduled cleanup and heartbeat/audit acceptance were observed27 November17:00UTC. Separate hourly alert-only availability monitoring does not replace request-time fail-closed checks.
- Public release became live27 November20:23Istanbul: https://hms-isolated-qualification.onrender.com/ . Actual anonymous liveness200, protectedpatients401, removed identity diagnostic404, loginHTML200; ENdesktop/ARmobile fictional bootstrap and domain reads passed. Additional UI patient create201andMRNreadback passed. Three fictional workspaces left to ordinary24hour idle expiry.
- LinkedIn existing HMS project has the verified demo link. Portfolio repository/demo two-link correction awaits its separate decision at this snapshot.

## Current engineering evidence

Latest exact source CI PostgreSQL17/18 passed https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46082348667 including actual320/390/1280Swagger model browser checks. Render Free/manual exactfdee7ec Live November28 02:34:56 in1m44, actual public hosted same six model checks, unchanged42schema55operation snapshot and keyboard nested controls passed. Actual pixels inspected. This is scoped model-layout proof, not blanket Swagger/WCAG acceptance.

Prior clinical contracts8dbf28f CI46080158788 and actual hosted22response checks passed02:16; patient/waitlist contracts8d7abab CI46078195061 and17hosted checks passed01:56. Response schemas cover selected routes only. Prescription dispensed/unavailable and test cancelled enums had schema-only coverage, not those22clinical probes. No new serializer/audience semantics.

Approved attendance, Admin department/bed setup, active-view15s freshness and persistent manual clinical waitlist shipped with named reconciliation in traceability. Waitlist48f3438 used separate approved live table/minimal grants/ledger after protected backup and actual disposable restore. Historical candidate preparation claims are superseded by those named results, not erased.

[Local10kqualification](docs/testing/PERFORMANCE-QUALIFICATION.md) contains exact runner, workload, raw samples and limits. Actual compiled app/nonownerRLS/PostgreSQL, not a mocked service. A local result does not prove Free hosted latency, representative medium-server load,10kcomplete longitudinal records or power-loss durability.

[API reference](docs/api/API.md) and [traceability](docs/requirements/TRACEABILITY.md) distinguish current implementation from original target requirements. The generated repository OpenAPI has actual route/role/DTO validation metadata. Native shared Swagger request metadata and selected success shapes are now released and tested; universal response coverage remains unproven.

## Open requirements

Concrete functional gaps include national-ID duplicate matching, DOB/gender correction scope and zero-responsibility invoice status semantics. Existing exact name+DOB warning concurrency fix is locally qualified only, not released at this snapshot. See traceability for exact partial/missing labels. Eight roles/eleven capability groups do not establish all requirements complete.

Offline/intranet deployment, scheduled daily backup and independent-host disaster restore, physical power-loss guarantees, complete accessibility, legal compliance and future interoperability are not certified. Two-real-client-network rate separation and actual provider pause/resume persistence remain unmeasured. Hidden provider resume with preserved DB start and fresh heartbeat remains undetectable within the agreed90minute boundary. Daily prune's first actual scheduled observation is separate support work, not yet claimed here.

[Local process-crash evidence](docs/testing/CRASH-RECOVERY.md): actual disposable PostgreSQL18immediate-stop/restart preserved10,040committedfictionalpatientsand40audits, discarded an open uncommitted transaction. This is not a physical power-cut, hosted restart or backup/restore certification.

No auto-delete/credential rotation, disruptive hosted test or paid infrastructure is implied. HMS remains active after demo launch until full targets are met or the user changes scope.
