# HMS appointments interaction round

Local fictional/mocked data only. No real DB, patient data, clinical logic, insurance policy or deployment. Existing Nest/React architecture retained.

Baseline commit5cccfd81820b24f2b2b5d5a36fc42dfd90ca437b. Frontend build passes; test command fails because no frontend tests exist. Baseline audit7findings (5high/2moderate); compatible repair subsequently reduced to1high Zod finding. No production readiness claim.

## Functional goal

Appointments loading failures must be visible and retryable, not look like an empty day. Booking must validate required UUID fields and local datetime before requests, keep entered values after failure and prevent duplicate submits. Cancellation requires confirmation, a pending state and visible success/error, not a silent one-click mutation. Labels/statuses/errors in Arabic and English through existing i18n. Responsive filters/actions and readable mobile table.

## Boundaries and known gaps

No backend mutation behavior changes, no policy choice about allowed dates or insurance, no doctor directory promised. IDs remain identifiers, not invented names. Datetime conversion preserves existing browser-local to ISO behavior, explicitly labels local timezone. Backend day filtering currently uses UTC bounds; this pre-existing timezone semantics gap is not silently rewritten in a frontend round and must be reported before any real deployment. No live booking performed.

## QA/security

Pure validation tests for blank/malformed IDs, impossible dates and valid input. Browser API-mocked tests for loading/error/retry/empty, failed then successful booking, duplicate prevention, cancellation confirmation/pending/error/success, responsive Arabic/English. No real credentials or seeded patient records. Test fixtures must be visibly fictional and kept outside published app content. Dependency risk separately assessed; no major migration without comparing implications, no vulnerable release claim.
