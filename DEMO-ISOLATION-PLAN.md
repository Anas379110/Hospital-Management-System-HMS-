# Fictional demo isolation plan

24 November2026. Source-grounded design only. No controls in this plan are claimed as implemented or tested. No deployment approval follows from this document.

## Intended boundary

An Arabic/English portfolio demonstration using fictional data only. Existing business modules remain intact for review. Render Free plus Neon Free is the planning candidate, not a committed hosting change. Real-hospital commissioning is outside this objective.

## Source facts and consequences

| Current source | Consequence for a public demo | Planned boundary |
| --- | --- | --- |
| App routes include patients, appointments, departments, pharmacy, lab and billing. AppLayout shows the same navigation for every logged-in role. | Giving a user a limited role alone leaves misleading links and actions visible. Hiding links alone does not secure API routes. | Align navigation and disabled actions with server-enforced demo permissions. |
| Prisma Role enum contains business roles, not a demo viewer. RolesGuard fails closed but manager cannot read appointments. | Existing manager role is not a complete read-only demo role. Do not falsely label it as one or grant admin to avoid denials. | Explicit demo permission policy, with schema/API effects considered before implementation. |
| Seed creates administrator and module accounts with a known development password. | Running that seed unchanged on an internet-facing service exposes powerful credentials. | Separate demo initializer, no reuse of development users or passwords, no real data import. Never publish admin credentials. |
| Patient write DTOs accept names, dates, phones and optional identity/address fields. | A warning cannot prevent visitors from entering real sensitive information. | Initial public mode should not accept arbitrary patient input. Use fixed fictional fixtures and a server-enforced read-only boundary, or a separate protected interactive review environment. |
| Billing service records invoice/payment rows locally. | A simulated payment entry is not a real payment processor, but could still mislead viewers. | Public demo billing read-only, clearly marked simulated amounts. No money collection or claims of payment integration. |
| Global throttling is configured at100requests/60seconds, with existing role/JWT guards. | This is a source setting, not proof of internet abuse resistance or correct trusted proxy behavior. | Review deployment proxy identity and login limits before public exposure. Retain existing guards, do not bypass them for demo convenience. |
| API docs are mounted at/api/docs and CORS defaults to localhost. | Deployment origins and API-doc exposure need explicit decisions rather than wildcard defaults. | Exact allowed frontend origin. Either restrict API docs to reviewers or expose only a deliberately sanitized documented demo API. |
| Audit fallback writes a local file; Render Free disk is ephemeral. | It cannot be represented as durable audit retention. | Fictional-only scope and no clinical audit guarantee. Prefer externally persisted limited demo audit rows, avoid copying sensitive request bodies or secrets to logs. |
| Appointment input is browser-local; API day filtering uses UTC bounds. | Dates near midnight may be grouped differently from displayed local times. | Choose one visible demo-zone policy and apply it at input, rendering and query bounds. Do not infer a hospital timezone. |

## Recommended staged demo shape

1. Public read-only fictional showcase, showing seeded synthetic patients, appointments and module examples with no arbitrary data-entry endpoints exposed to the demo principal. This reduces personal-data collection and abuse while allowing inspection of the implemented interface.
2. A separately protected interactive review environment may later demonstrate booking and cancellation using fixed fictional fixtures. This is not a replacement for the public showcase or a new production environment. Its credentials and write scope must not be published as admin access.
3. Do not claim both modes already exist. The implementation requires a narrow plan, server-side permission enforcement, frontend consistency and permitted tests before launch.

No new framework or database technology is proposed. An explicit demo role would require a Prisma enum migration and changes across JWT typing/guards/tests; a method-only mutation block is simpler but insufficient alone because existing roles have different read permissions. Prefer a dedicated allowlist policy with deliberate read coverage over silently reusing admin. Resolve the exact implementation design before code.

## Proposed request matrix, not implemented

- Anonymous: login and non-sensitive demo identity/status only. No patient/module records or write operations.
- Demo viewer: authenticated fixed fictional records for explicitly allowlisted GET endpoints only. Deny every module POST/PATCH/PUT/DELETE regardless of hidden UI controls. Login/logout are separate authentication operations, not an exception for module mutation.
- Demo initializer: offline bounded initialization against an explicitly named demo database only. No public endpoint. Refuse unknown/non-demo database targets; no reset of another application's data.
- Operator: secret credentials for environment administration, not bundled in frontend assets, API responses, repository or portfolio links.

## Acceptance criteria to qualify later

These are future checks, not test results and not a substitute for the restricted validation:

- The deployed page labels the entire experience fictional in both languages, including login and all module views, at mobile and desktop sizes.
- Direct HTTP mutation requests from the demo principal fail without changing rows, including patient override, booking/cancel, admission/discharge, medication stock/dispense, lab results, invoice/payment and user creation/status.
- Public read endpoints return only the fixed fictional fixture set. No admin credentials, password hashes, tokens or database connection values appear in responses, assets or logs.
- Denied controls and absent navigation agree with server policy. A crafted request cannot bypass a hidden control.
- Fixed-zone midnight/DST behavior and date filtering agree with the chosen policy.
- A dedicated database reset/initialization cannot affect the school demo, Directory or any other project. Do not implement deletion as a convenience under the current preparation scope.
- Provider plans remain Free, no card or paid add-on is added, and quota exhaustion pauses service rather than creating an approved charge.

## Current stop

The final candidate validation result remains unavailable and restricted from recovery/repetition/bypass. The startup-path correction remains runtime-unqualified. No new runtime test, account resource, migration, main merge or deployment occurred while writing this plan.
