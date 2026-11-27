# Patient and waitlist response contract slice

Prepared November28 after exact48f3438 hosted waitlist acceptance. Requirement: SRS maintainability/OpenAPI, TRACEABILITY explicit unqualified success-schema gap. Existing native Swagger request/query annotations are retained. No new framework, dependency, database, endpoint, audience, serializer, query, business rule or provider setting.

1. Reconcile current requirements with accepted setup, attendance, freshness and waitlist evidence, preserving original functional gaps and bounded acceptance.
2. Document actual patient create/detail/update/search, restricted billing lookup, and waitlist list/create/cancel success payloads using native Nest response DTOs. Dates are serialized date-times, existing optional database columns required-but-nullable in complete row responses. Full row and redacted projection contracts must be distinct. Schema describes current fields, not a new grant or disclosure.
3. Keep independent validator/controller request export and role inventory checks. Extend native contract tests with a narrow response allowlist and exact route/schema mapping. Real restricted PostgreSQL17/18 HTTP checks must compare actual response keys/types/nulls to native Swagger and verify authorization, cross-workspace separation, duplicate and closed-state error envelopes. Include malformed,401,403,404,409 cases. No destructive or remote DB testing.
4. Update generated native document only after tests pass, then unit/mock/lint/build and portable/fullCI. Independent security and contract reviews before release. Private changed/new source delta. Hosted docs rendering and actual selected responses only after exact reviewed CI and free app release.

Not this slice: medical-record nested response contract, national-ID normalization/duplicate concurrency policy, DOB/gender correction rights, zero-responsibility invoice semantics, intranet backup retention or full HMS completion. These remain explicit decisions/research. No current live DB/config approval inferred. Use supplied backend/QA/security-review/technical-writing reference roles for the work and ask parent for independent review once a bounded package is ready.

## Executed local qualification, not release

- Backend226unit and62mockHTTP tests pass;16independent metadata/native/response-validator contract tests pass; build/lint pass.
- Real restricted PostgreSQL17.12 and18.7 complete waitlist suite rerun passes, plus17 actual HTTP response checks per version: create/detail/search/billing minimal identity/update nullable fields/clear fields, duplicate409, invalid400, unauthenticated401, forbidden403, notfound404, pending list and full create/cancel writes/repeatedcancel409. Reports response-contract-pg{17,18}-20261128.json bind24source/build inputs. No localhost test was run against remote DB.
- Native Swagger35schemas55operations rendered in a documentation-only local server. Patient required fields and waitlist page model pixels inspected. This preview did not initialize a DB; separate restricted DB tests prove runtime payloads.
- No change to existing services/filter/serialization/data selections/roles, no database or config mutation, no new dependency. Independent review, exact commit CI and hosted doc/payload verification remain pending. Existing hosted48f3438 remains unchanged.
