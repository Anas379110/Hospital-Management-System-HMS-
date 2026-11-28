# Department read summary response contracts

Base b0905cc. Original FR5.1/5.4; supplied Backend, QA, Security Reviewer and Technical Writer roles apply.

Scope three existing reads only: GET departments, overview and department beds/summary. Explicit scalar list, normalized range and aggregate department projection, four bed counts. Keep all services/queries/permissions/DTO validation/database/config/dependencies unchanged. Do not annotate role-polymorphic beds or setup writes in this slice. No clinical patient identity in these outputs. Existing lists remain unbounded, an existing limitation, not a pagination claim.

Verify strict required fields, scalar formats and nested aggregate arrays in native generated OpenAPI, plus actual restricted PG17/18 HTTP for every allowed role and every denied role, anonymous access, missing/foreign department404, malformed path and overview range400. Verify current 26-hour inclusive maximum and positive interval semantics, normalized offset bounds, available/maintenance/occupied summary transitions and no foreign identity. Reuse prior audit/concurrency evidence only with original provenance.

Local build/lint/unit/mockHTTP/contract and mobile/desktop model pixels, independent source review, exact bothPG CI, private changed/new-only source export, actual hosted commit/status and HTTP/model proof, private evidence and superseding release comment precede closeout. No functional nationalID/demographic/billing decisions inferred and no live database change.

## Local execution
230unit62mockHTTP25metadata/validator/dependency/build/lint pass. FreshrestrictedPG17.12/18.7 fullrunner each50named department response cases,53source/buildhashes revalidated; prior admission/pharmacy/clinical/patient/waitlist/race suites retained. Overview offset normalization, inclusive26h/exclusive26h+1ms/zero/reversed/missing/malformed/timezone/unexpectedquery cases, allroles,401/403/404/400, empty/available/maintenance/occupied/discharged counts and foreign manager404/aggregate isolation. Fourmodels320/390/1280fit. Initial local runner interrupted by command timeout, fresh rerun used new data directories/ports and completed; interrupted runs are not evidence. A nested overview expansion attempt timed out, replaced with direct standalone item model inspection, not claimed nested keyboard coverage. Independent source review/exactCI/hosted pending.
