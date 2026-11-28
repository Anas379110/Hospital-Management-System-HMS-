# Synthetic related-history performance plan

28 November 2026, base141347b. Plan sent before code, parent confirmed delivery10:31. Existing stack, no new dependencies, architecture or API decisions.

## Gap

The previous10kpatient benchmark measured empty medical records and tiny related tables. This cannot establish rich-history performance. Source SRS target remains basic API<300ms on an unspecified medium server under normal load. The synthetic fixture below is an explicit engineering scenario, not a definition of representative hospital load or acceptance of that target.

## Fixture and measurement

New retained private disposable loopback cluster per PostgreSQL17/18, initialized with the reviewed local kit and existing migrations/grants. Verify actual data-directory identity before any fixture write. Two fictional workspaces, restricted runtime and actual compiled HTTP app. Owner bulk fixtures are outside timed requests and are not claimed as clinical business-workflow executions. No real patient data or fixed reusable credentials.

Primary workspace10,000patients. Five encounters per patient, plus245additional encounters for one heavy-history patient (250total). One prescription and one lab/radiology order per encounter, with explicit small pending-queue subset; completed results have bounded fictional text lengths. One appointment and one positive-responsibility invoice per patient, two items and one payment per invoice. Synthetic audit metadata records fixture provenance, not invented execution of real workflows. Validate exact counts, foreign/workspace links, status/invoice arithmetic, and order/read results before timing.

Measure actual HTTP with unchanged RLS/guards/throttles/cleanup at explicit concurrency1/4: patient search/detail, typical and heavy medical histories/results, pending lab/pharmacy, invoice details, daily appointments, overview/audit. Record every sample, byte size, result counts, status, resource environment/load and source/build hashes. Four warmups plus20timed samples per operation/concurrency initially; pace shared-route scenarios to stay below existing100/minute rather than disable limits. Add a small measured set of full audited encounter/test/invoice writes and verify exact deltas.

Return measured bottlenecks/options to parent before changing indexes/schema/API/pagination or clinical policy. Preserve results above300ms, HTTP failures, payload size or integrity mismatches rather than weakening the benchmark. Independent QA/security source review, exact bothPGCI and private source/proof delta delivery gate publication of new qualification tools. No public Free-host stress test, paid resources, normal password provisioning, backup/retention policy or held national-ID/DOB/gender/zero-invoice choice.
