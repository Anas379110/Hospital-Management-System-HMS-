# HMS appointments local round verification

2026-11-23. Local frontend changes only, no real DB/patient data/clinical decisions/backend writes/deployment.

## Delivered behavior

Appointment load failures have visible error and Retry. Booking validates required UUIDs and a real browser-local date/time before requests, preserves input on API conflict/error and disables duplicate submits. Cancellation requires a confirmation dialog with the selected appointment date/time, disables repeated requests while pending, keeps failure visible for retry and reports success. Appointment text/statuses and shared navigation translate through existing Arabic/English i18n. Locale changes update document lang/dir; success notices translate instead of staying in the old language. Mobile toolbar and filters wrap.

## Verified

- Baseline frontend npm test failed with no tests; six new pure validation tests now pass.
- TypeScript plus Vite production build passes.
- API-mocked browser checks passed load failure/retry, invalid submit with zero request, failed booking retains input, booking pending/success, cancellation with zero requests before confirmation, cancellation pending/error/retry/success, empty inventory and language switch. No horizontal overflow at320/390/1280. Actual screenshots inspected English desktop/mobile and Arabic mobile.
- Browser fixture user and appointment IDs are fictional; no authentication secret, patient record or actual API request used. Fixture route interception handles all API paths locally.
- git diff --check passes.

## Issues found and fixed during verification

Cancellation button initially had the Back label after translation replacement, corrected. Initial locale setup did not set document direction, fixed centrally. Success notice remained in English after Arabic switch, changed to a translation key. Initial harness failure was an exact-label assumption for required fields, corrected. A later harness reload reset the fixture language, corrected expectation. All behavioral checks rerun after changes.

## Not passed and not claimed

- Existing lint command fails because no eslint.config file exists. It is not counted as a pass.
- Baseline frontend audit had7findings,5high/2moderate. npm10 peer resolution failed with internal edgesOut even in isolation. A temporary isolated npm11.6.4 invocation resolved a compatible candidate lock with Vitest4.1.12 pinned. Clean npm ci,6tests, build and browser suite passed with that lock. Current audit1high finding remains in Zod<4.6.6. Zod4/resolver major would affect patient registration, not forced. No zero-vulnerability claim. Tracked build-info restored.
- Backend current audit, migrations, authorization integration, live appointment/DB behavior and hospital UAT not assessed in this frontend round. No production readiness, security certification or clinical readiness claim.
- Existing backend day-query bounds are UTC, while datetime entry uses device local timezone. This round labels device timezone but does not decide hospital timezone or silently change backend date policy.
- Existing UI still uses direct UUID identifiers, not a doctor/patient directory. No invented names or clinical information.

Source publication/deployment should not be confused with a verified clinical product. Resolve security findings and lint tooling, confirm timezone semantics and run isolated backend integration before any real environment qualification.
