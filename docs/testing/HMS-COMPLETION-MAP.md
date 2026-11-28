# Remaining demo completion map
As of notes1d9a94b release, appointment-linked encounter UI under qualification, not released. WholeHMS incomplete.

Functional remaining work:
- FR4.1 appointment-linked visit UI, current candidate. Backend policy retained.
- FR4.4 soft-delete UI with explicit reason/ownership/confirmation and existing history behavior. No permanent clinical deletion or retention changes assumed.
- Reconcile traceability historical rows with exact released artifacts for nationalID duplicate warning, clinical notes, patient edits, medication creation, lowstock, encounter/prescription safety and prescription notes. Historical candidate notes are not current acceptance claims.
- Whole-demo coherent multi-role journey, error/permissions/recovery map and source/recovery delivery. Use current tests as evidence, not automatic whole-project acceptance.

Real policy decisions remain open, not silently defaulted:
- DOB/gender corrections, which current UpdatePatientDto excludes.
- Zero-responsibility invoice settlement semantics, current derives unpaid.
- Optional alternative-drug wording establishes no substitution automation scope.

Original nonfunctional targets remain unchanged and only qualified to their actual evidence: medium-server/load performance definition, clean disconnected/offline install plus independent daily backups, real power-loss durability and current legal compliance source review are not proven by the hosted demo. Existing bounded local recovery/benchmark/egress/crash evidence must be described with its limits. These are not newly imposed real-hospital commissioning gates for trial/demo launch, and not waived production guarantees.
