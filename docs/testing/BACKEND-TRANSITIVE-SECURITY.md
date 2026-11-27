# Backend transitive security candidate

27 November 2026. Separate candidate after hosted371841a. Not deployed.

## Minimal patch choice

Pin transitive qs6.17.1 and uuid11.1.1 through npm overrides. Both stay within
installed major versions, but exceed the exact/caret ranges declared by some dependent packages. Overrides therefore need explicit edge-shape and real-HTTP compatibility evidence; same-major alone is not compatibility proof. Avoid npm audit fix --force: it proposes Nest12 and
would turn a transitive patch into a framework/Swagger/scheduler compatibility
round. Nest10 currently has no newer version than installed10.4.22 in the
registry. No schema, grant, provider or first-party runtime behavior change.

Production audit changes from8moderate to6moderate,0high/critical. Those counts
are affected package chains, not eight distinct first-party vulnerabilities.
This is not a zero-audit claim. Full audit including development dependencies
still has21 findings:3low,13moderate,5high. High dev chains include NestCLI,
glob, brace-expansion, picomatch and tmp. Current CI production-only audit gate
does not certify build tooling clean. Their compatible fixes/reachability need
a distinct build-tooling review before claiming all dependencies remediated.

## Advisory preconditions and measured reachability

- https://github.com/advisories/GHSA-4mjr-xmp4-gh2g : qs stringify invokes hostile
  constructor.isBuffer. Express uses allowPrototypes:true extended parsing, but
  no first-party qs import or parse-to-stringify sink was found. Patch anyway.
- https://github.com/advisories/GHSA-x5fp-wj9c-mxmx : comma:true bracket arrays
  bypass arrayLimit. Express query parsing and body-parser options inspected,
  neither enables comma:true. This narrows that path, not all use of qs.
- https://github.com/advisories/GHSA-q8mj-m7cp-5q26 and
  https://github.com/advisories/GHSA-6pq8-jhm2-2vcw : qs comma-format stringify
  edge cases. No first-party stringify sink found. All qs copies now6.17.1.
- https://github.com/advisories/GHSA-w5hq-g745-h8pq : uuid v3/v5/v6 external
  buffer bounds. Installed scheduler calls only v4, no first-party scheduler
  or uuid API calls found. Patch11.1.1 also fixes dependency inventory.
- https://github.com/advisories/GHSA-36xv-jgw5-4q75 : Nest SseStream type/id
  newline injection. No Sse/EventSource API in first-party source. Residual
  installed Nest10 remains affected in audit; fixed11.1.18 is a major migration.
- https://github.com/advisories/GHSA-j47w-4g3g-c36v and
  https://github.com/advisories/GHSA-5v7r-6r5c-r473 : file-type malformed ZIP/ASF
  detection. Nest FileTypeValidator imports fileTypeFromBuffer. No first-party
  upload routes, FileTypeValidator, ParseFilePipe or FileInterceptor found.
  Installed20.4.1 remains affected;21.3.2 is patched but changes dependency major.
  Do not treat unused path evidence as removing the dependency vulnerability.

Source search covers backend/src. Dependency caller inspection covers installed
Express query parser, body-parser urlencoded parser, Nest schedule orchestrator
and common FileTypeValidator. First-party source reachability was checked by the implementing worker, not independently rechecked by the dependency reviewer. Static reachability evidence is bounded to this
source and configuration, not a general guarantee about arbitrary future code.

## Checks executed locally

- Dependency regression against existing vulnerable qs6.14.3/uuid11.0.3:3fail,
  1pass. Against patched qs6.17.1/uuid11.1.1:4pass. Covers hostile isBuffer,
  comma bracket limit, ordinary Express parse shape and uuid v5 buffer bounds.
- npm ls valid,193unit tests,62mockedHTTP,17document/security contracts, lint/build.
- Actual fresh disposable PG17/18 attendance HTTP/browser suite passes with
  patched dependencies. Original attendance reports are not overwritten or
  relabeled; new candidate reports are separate evidence files.
- Exact-head hosted CI, independent review, source publication and deployment
  remain pending. No full project completion claim.
