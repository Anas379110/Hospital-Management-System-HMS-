# Local fictional demo and recovery qualification

Candidate, 28 November 2026. Not a whole-project completion or real-hospital readiness statement.

## Measured scope

The local kit was exercised against independent PostgreSQL 17 and 18 server/client tools with compiled production Nest/React assets. The EN desktop and AR 390px mobile journeys use UI bootstrap and role switching, not injected tokens or pre-created clinical fixtures. Each creates a fictional patient, doctor encounter, lab and radiology order, technician result, prescription and pharmacy dispensing, appointment and attendance, simulated invoice/payment, nurse waitlist, admission that fulfills the request, and discharge. After stopping the source, backup and restore into a fresh separate cluster compare all 18 public-table row hashes and measured security catalogs, then the original browser sessions reopen completed records at the same HTTP origin.

The test rejects browser external HTTP/WebSocket routes, observes page errors and writes screenshots plus a nonsecret report. This does not block Node/database network egress at the OS level. No OS-wide air-gap claim is made.

Negative checks refuse an existing initialization target, a second operation while serving, an existing restore target and an archive with changed bytes. Test-order UI checks a too-short name, pending disable, injected validation/permission/atomic-audit rejection and ambiguous transport failure, no automatic retry and explicit reconciliation. The injected responses prove frontend handling, not server rollback. Existing backend lab authorization/ownership/validation/audit tests remain required in the ordinary test suites.

The backup retains a private JWT recovery key to resume existing same-origin sessions. It is not encrypted or signed and must be operator-trusted. Workspace idle expiry remains 24 hours. Temporary source/backup/restore directories are retained outside the repository and must never be exported as source or ordinary browser evidence.

## Release gates still apply

Independent source/security review, exact final-head PG17/18 CI and applicable hosted-default regression remain gates. See the exact build report and release record rather than treating this candidate note as a pass certificate. No national-ID/DOB/gender/zero-invoice policy, remote DB, new framework, paid service or clinical workflow rule was selected here.

## Remaining project-card gaps

A local runtime with preinstalled dependencies is now implementable, but a clean offline dependency installer, supported hospital commissioning, OS/disk/power-loss resilience, daily unattended backup/retention/key custody policy and representative 10k-patient related-history qualification are not established. Recovery is an explicit stopped-source logical drill on the same host with an independent cluster, not independently stored physical-media recovery. Normal local user password provisioning/recovery and permanent patient storage are not introduced. The doctor form targets a last encounter created by that doctor for that patient in the same tab; it does not add editing of prior orders, clinical approval or result amendments. User-held national-ID/DOB/gender/zero-invoice decisions remain open.
