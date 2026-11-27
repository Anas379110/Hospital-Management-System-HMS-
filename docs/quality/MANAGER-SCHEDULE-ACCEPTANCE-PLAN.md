# Basic manager workbench and appointment range acceptance

27 November 2026. Incremental completion of SRS US-5 and FR-3.4, UI-UX Flow4 and functional plan Gate4. This is not hosted acceptance. Preserve PR4 v4 commit06bf32482bdc2f0502799573820b8cb5dd5b7100 as the prior isolation qualification snapshot.

## Required, not advanced analytics
- Manager/admin operational overview: every department's total, available, occupied and maintenance beds, and selected local-day appointment count. Aggregate-only response, no patient, doctor, appointment or admission identities. Count includes all statuses, clearly labeled, not an invented attendance metric.
- Exact start-inclusive/end-exclusive local-day boundaries supplied by client, validated paired timestamps and duration at most26hours (DST-safe). Single consistent read snapshot, workspace-scoped ORM only. Manager/admin only; other roles403. Existing manager patient/detail permissions are not expanded.
- Read refresh every60seconds only while visible, manual refresh, last successful update, loading/empty/error/retry, no claim of real-time push.
- Appointment daily/7day schedule selected by an anchor local date, no calendar library. Seven calendar days from selected date, not an assumed Monday/Sunday week. Existing paginated queue and doctor filter retained, date/range visible. Add permitted link from queue to that patient's workspace.
- Manager lands on overview, nurse on existing beds, doctor/receptionist on existing appointments. Other real workflow landings unchanged; no eight-dashboard or optional admin redesign.

## Verification
Backend unit validation/count/redaction and HTTP role denials. Actual PostgreSQL two-workspace aggregate isolation with distinct data, admission/discharge/appointment changes reflected, no cross-visitor identity/count leak. Both-language browser manager and schedule flows, patient handoff, loading/error/retry where feasible, keyboard refresh/range controls, desktop/mobile pixels and scoped axe. Rerun existing units/build/lint/portable gate and exact-commit17/18CI. Record scope honestly; landing screenshots are not full role journeys. No new table, framework, paid tool, hosted mutation or retention change.

## Local evidence, not release signoff

Actual PostgreSQL18.7 portable run passes28 check groups and19 scoped axe scans. Two workspace counts remain separate; nurse admission/discharge changes the manager's totals only in that workspace; appointment writes update the local-day aggregate, with six disallowed roles403, invalid/missing timezone ranges400, admin200, and manager appointment details403. Actual schedule interval probes return one daily and two weekly appointments while excluding the exact seven-day upper boundary. Browser EN/AR manager refresh failure/retry, keyboard range selection and appointment-to-same-patient handoff pass. Inspected pixels include EN desktop and AR390 manager/schedule, AR320manager and EN320schedule. These remain scoped checks, not all-state/all-role journey certification. Existing v4 tests/results retained separately; exact new commit CI and independent review remain required. No hosted evidence added.

## Narrow review follow-up

Schedule cards are grouped by localized weekday/year/date with counts of the represented appointments on the current page, not an unpaginated total. The doctor filter visibly defaults to All doctors. The native date input follows browser date presentation; human-readable headings/cards use locale formatting and Latin numerals in both languages to match displayed counts. Midnight on the sixth-day fixture is deliberately constructed from local midnight plus six calendar days; exact boundary inclusion is asserted over HTTP, not inferred from screenshots.

The existing cancel-confirmation dialog is now opened and dismissed in both browser languages. Manager refresh has a visible loading message; failures label retained figures as the last successful update. Loading, error/retry and zero-day AR screenshots were rendered and inspected. Date inputs receive keyboard arrows, range selection opens by keyboard, and patient handoff activates by Enter. These are bounded checks, not complete keyboard certification.

A controlled browser clock verifies an overview request after61seconds in foreground, then no interval request after61seconds with a simulated hidden visibility signal. The installed query observer gates intervals on focus unless refetchIntervalInBackground is enabled; this option is false. This test uses a simulated visibility signal, not proof against every real browser background-throttling mode.

Axe incomplete findings were inspected rather than counted as passes. Full rule/check messages and targets are retained: background overlap prevents automatic contrast calculation; MUI popup aria-controls targets are dynamic; users-dialog aria-hidden-focus requires state review. Current schedule/range popup opens and closes, dialog keyboard containment was exercised, and actual pixels were read. Those observations do not replace a full manual contrast audit of every node, so no WCAG certification is claimed. Zero automated violations is scoped only to the19 recorded scans.

Appointment days and manager-selected-day totals use each visitor's local browser timezone, explicitly shown. The aggregate count includes cancelled/no-show rows and says all statuses. No manager appointment-detail permission was added. Hosted and exact-new-commit CI acceptance remain separate.
