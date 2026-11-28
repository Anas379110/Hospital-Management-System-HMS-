# Clinical notes UI plan

Base c56104eb. Original Must FR4.1 includes clinical notes, US2 reviews prior encounters. Existing CreateEncounterDto, service, scalar response and records API already support optional notes; UI lacks entry and display. No API, business policy, roles, schema, dependency or historical-edit change.

Wireframe: within existing doctor-only encounter card, optional multiline notes after diagnosis and before Save. Saved record cards show labeled notes under complaint, preserving whitespace and wrapping long text. No HTML rendering. Missing notes omit section. Existing clinical readers doctor/nurse/admin only; receptionist must not request records or results.

Submission: unchanged shared API/hook, optional empty notes omitted, exact nonempty text retained. Disable pending form. Confirmed failures retain draft; unknown outcomes conservatively hold encounter creation in this tab across reload, no automatic retry. Explicit successful readback plus operator acknowledgment discards draft; not terminal-write or idempotency proof. No sensitive draft persisted in storage. No clinical automation or editing past records.

Qualification: payload units, actual PG17/18 API/browser save/read/reload, empty notes, literal multiline/HTML-like text rendered safely, roles/isolation, confirmed400, committed-response-loss, audit503rollback and per-tab hold. EN1280/AR390 pixels, lint/unit/build, independent source/security review, exact both-PG CI, fictional hosted workflow before release and private changed/new exports.
