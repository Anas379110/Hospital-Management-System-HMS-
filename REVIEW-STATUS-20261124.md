# HMS review snapshot

Saved 24 November 2026. Review and preservation only. Not a release, deployment, hospital approval or a claim that the current candidate passes final validation.

## Contents and baseline

Only changed and new source files are included under delta/. Unchanged project files are not duplicated.

Baseline Git commit: 3f6e4cf8a49c7d36f097366ead38333ecf896b8a
Branch at capture: launch-qualification

Tracked modifications are also supplied in tracked-changes.patch. New files are in delta/ and listed in MANIFEST.json. The two forms overlap for modified tracked files. Do not apply both forms to the same file.

## Review and restore order

1. Keep an untouched copy of your existing checkout. Use a separate review checkout at the exact baseline commit above. Do not apply to a live hospital installation.
2. Compare MANIFEST.json with your checkout. Each modified file records its baseline SHA256 and saved SHA256. Stop on any mismatch; do not overwrite intervening work.
3. Copy files from delta/ to their same relative paths in the separate baseline checkout. This preserves new files as well as tracked modifications. Alternatively apply the tracked patch and copy only manifest entries marked new from delta/.
4. Keep the result unmerged and undeployed until the evidence gaps below are resolved through an allowed qualification process. No automatic installation, test, database migration, account creation or deployment is part of this archive.

## Earlier verified evidence

The following were separate earlier checks, not proof of the final saved candidate as a whole:

- 62 backend unit checks, 33 mocked HTTP checks, 3 isolated real PostgreSQL appointment checks and 11 frontend checks passed in earlier independent runs.
- Earlier lint/build checks and bilingual patient registration/duplicate/cancel/explicit override browser flows passed. These do not prove later source edits.
- The read-only appointment-slot precheck independently produced stop outcomes for duplicate slots and inaccessible databases, and a clear outcome for no duplicates. It never resolves records or applies migrations.
- An isolated fictional-data PostgreSQL backup restored into a separate database. Four table counts and ordered content digests matched, and the appointment-slot unique index was present. This does not prove production recovery readiness.

## Changes preserved

Appointment-slot migration and narrow conflict handling, regression fixtures and isolated database tests, patient form validation/submission guard and bilingual duplicate warning, dependency/configuration updates, non-destructive lint setup, read-only migration precheck, corrected documentation and production startup path.

## Open qualification and launch gaps

- The result of the last combined clean-install/lint/build/test run is unavailable. It is neither a pass nor a demonstrated failure. This snapshot does not close that evidence gap.
- The production startup path was changed to dist/src/main.js after the last independently verified runs. Runtime qualification of that change remains outstanding.
- Moderate dependency findings remain. No clean-audit claim is made.
- The migration has not been applied to an authorized populated hospital database. Duplicate slots require authorized staff decisions, never automatic deletion/cancellation.
- A hospital host, operational access controls, retained protected backups, recovery ownership and clinical/user acceptance are not established here.
- No HMS remote source update, merge or deployment was performed in this preservation step.

## Exclusions

No node_modules, built output, local database runtime, database dumps, environment files, local credentials, authentication state, screenshots, command logs or private conversation records are included. Fictional runtime test records remain separate from the deliverable.

SHA256SUMS.txt lists every archive member except itself. MANIFEST.json records per-source baseline and saved hashes. Preserve the external ZIP checksum with the ZIP.

## Source review upload

The owner requested source upload without the unavailable final verification on 24 November 2026. This branch is a review candidate only. It must not be interpreted as a completed launch, a verified release, or permission for use with real patient data. No merge, deployment or migration is part of this upload. The earlier local archive remains the preservation snapshot described above.
