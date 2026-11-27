# HMS verification and open requirements

Reconciled27 November2026. Fictional-data demonstration, not hospital readiness or compliance certification. Exact public release source2ad6bb273529260a1fb22456c14965c0568d2618.

## Executed release evidence

- Exact-source CI on PostgreSQL17and18 passed: https://github.com/Anas379110/Hospital-Management-System-HMS-/actions/runs/46032128551 . The workflow records unit, mocked HTTP, builds/lint/audits, actual PostgreSQL concurrency/readiness/upgrade and scoped real-browser/isolation checks. A passing workflow is not universal requirements coverage.
- Reviewed isolated migration/upgrade and restricted runtime/readiness source are present in `backend/prisma/demo`. Actual scheduled cleanup and heartbeat/audit acceptance were observed27 November17:00UTC. Separate hourly alert-only availability monitoring does not replace request-time fail-closed checks.
- Public release became live27 November20:23Istanbul: https://hms-isolated-qualification.onrender.com/ . Actual anonymous liveness200, protectedpatients401, removed identity diagnostic404, loginHTML200; ENdesktop/ARmobile fictional bootstrap and domain reads passed. Additional UI patient create201andMRNreadback passed. Three fictional workspaces left to ordinary24hour idle expiry.
- LinkedIn existing HMS project has the verified demo link. Portfolio repository/demo two-link correction awaits its separate decision at this snapshot.

## Current engineering evidence

[Local10kqualification](docs/testing/PERFORMANCE-QUALIFICATION.md) contains exact runner, workload, raw samples and limits. Actual compiled app/nonownerRLS/PostgreSQL, not a mocked service. A local result does not prove Free hosted latency, representative medium-server load,10kcomplete longitudinal records or power-loss durability.

[API reference](docs/api/API.md) and [traceability](docs/requirements/TRACEABILITY.md) distinguish current implementation from original target requirements. The generated repository OpenAPI has actual route/role/DTO validation metadata. The live Swagger DTO schemas remain incomplete until an explicitly tested source/runtime documentation fix is selected and released.

## Open requirements

Concrete functional gaps include national-ID duplicate matching, DOB/gender correction scope, appointment completed/no-show transitions, department/bed setup/maintenance mutations, cross-client bed freshness, persistent waitlist and zero-responsibility invoice status semantics. See traceability for exact partial/missing labels. Eight roles/eleven capability groups do not establish all requirements complete.

Offline/intranet deployment, daily backup and tested restore, physical power-loss guarantees, complete accessibility, legal compliance and future interoperability are not certified. Two-real-client-network rate separation and actual provider pause/resume persistence remain unmeasured. Hidden provider resume with preserved DB start and fresh heartbeat remains undetectable within the agreed90minute boundary. Daily prune's first actual scheduled observation is separate support work, not yet claimed here.

[Local process-crash evidence](docs/testing/CRASH-RECOVERY.md): actual disposable PostgreSQL18immediate-stop/restart preserved10,040committedfictionalpatientsand40audits, discarded an open uncommitted transaction. This is not a physical power-cut, hosted restart or backup/restore certification.

No auto-delete/credential rotation, disruptive hosted test or paid infrastructure is implied. HMS remains active after demo launch until full targets are met or the user changes scope.
