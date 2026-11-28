# FR4.2 optional prescription notes

Base210a547a safety prerequisite. SRS.md FR4.2 explicitly names notes. Existing CreatePrescriptionDto accepts optional string, existing transaction stores dto.notes and audits PRESCRIPTION_ADDED. Existing response and patient records expose nullable notes. No backend/API/schema/dependency/policy change.

Add optional multiline input through corrected prescription write path, omit only empty string, preserve exact nonempty text including whitespace/newlines; React text rendering never HTML. Clear on verified success or explicit reviewed draft discard, preserve on definite failure/unknown outcome, disable with held/checking/pending. Show saved prescription notes under corresponding prescription in patient history, no empty label for absent notes. EN/AR with wrapping. No prescription edit/delete or dispensing UI expansion. WholeHMS incomplete.

Unit input/echo safety, actualPG17/18 browser create/read/reload/role/ownership/audit and notes failure-preservation tests, exact combinedCI and hosted fake/pixels/private changednewexports, independent review before release.
