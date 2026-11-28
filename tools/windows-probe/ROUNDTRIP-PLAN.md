# Windows backend round-trip qualification, R6 review candidate

Not a package or installer. Not executed on Windows. R5c remains the accepted baseline. This change adds one separate `roundtrip` child after the unchanged baseline PostgreSQL child, using a different private data directory and the same unprivileged temporary OS user. Everything is in the original HMS repository and PR40. No deployed service, real database, account or billing setting changes.

## Sequence and bounds

Preparation downloads the same pinned Node, EDB PG17.12-2 and Prisma engines, uses the locked npm tree, generates the client and builds the existing backend. Source/migrations are copied into the staged runtime. Network access occurs only during preparation, before the existing path-specific firewall rules. This is not an offline-install claim.

The new child budget is 420 seconds, explicitly separate from the baseline child's unchanged 180 seconds. The JS helper has a 240 second deadline; native commands have 45 second deadlines, IPC startup 15 seconds and graceful close 10 seconds. PostgreSQL start remains bounded at 90 seconds with its own 60 second limit. A timeout is failure, not a graceful-stop success. Existing scoped process cleanup remains the last safety net.

1. Create a new private PostgreSQL cluster under the probe user's protected home. Apply all repository Prisma migrations to `hms_roundtrip` and compare the applied migration count with the migration directories.
2. Use the repository workspace function and a linked fictional seed across all public tables. Arabic text and timestamps are in HMS rows. A separate probe-owned `windows_probe_types` table exercises bytea, numeric, timestamptz and a sequence without changing HMS migrations or money types.
3. Apply the existing restricted runtime/cleanup grants, deny the runtime access to migration metadata and the probe fixture, and check unsafe role flags, schema CREATE and cleanup-function access. The app uses only the restricted runtime role. A real CREATE TABLE attempt by that role must fail.
4. `pg_dump --format=custom`, check `pg_restore --list` includes each table, create the distinct `hms_restored` DB and restore with `--exit-on-error`. Compare counts and order-independent full-row checksums for all public tables, migration metadata included. Compare enum/index/constraint counts and sequence last values. No table is excluded; an unexpected empty table fails. Compare source again after dump. Mutate one restored fixture row, require a mismatch, then undo and require a match.
5. Start a test-only IPC child that imports the actual compiled `createApplication` factory. Bind to a random port on 127.0.0.1, confirm its reported bind address, exact health response, and the DB-backed demo-start and patients routes. No production main or Linux launcher changes.
6. IPC `close` calls `app.close`, including existing Prisma module destroy hooks. Require a closed acknowledgement, exit code 0, no signal and unavailable HTTP port. No Windows SIGTERM/Ctrl-C behavior is claimed. Force termination only occurs on failure cleanup.
7. Stop PostgreSQL, assert the postmaster/listener absent, and run existing scoped process/user/profile/firewall cleanup. Delete the dump even on failure; no dump is uploaded.

## Secret and artifact boundary

Owner DB password, runtime/cleanup passwords, JWT signing secret and test access token are generated locally. They never appear in CLI arguments, reports or console output. The protected home contains a private scan list of raw and URL-encoded values, removed after scan. Before writing the single allowlisted report JSON, compare it and private child logs with this list. A missing list or a match replaces the report with fixed scan-failure metadata and verified cleanup, excluding all candidate values. The scan runs before profile deletion and is a required success gate. The uploaded artifact contains only that exact report file, not logs or dumps. Archive bytes are produced by GitHub, so the secret scan applies to its sole uncompressed member, not the compressed byte stream. Missing scan-list failures must remain failures, never silently become a pass.

## Runtime prerequisite and notices

VC++ runtime is **a prerequisite, not bundled**. R5c observed VCRUNTIME140, VCRUNTIME140_1 and MSVCP140 14.52.37029.0 from Windows System32. R6 records the same observed module paths/versions and fails its prerequisite gate if the expected modules are absent. This does not establish the oldest compatible runtime or a clean Windows 10/11 pass. Never copy System32 DLLs or install a redistributable as an incidental test step.

Microsoft source and redistribution terms:
https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170
https://learn.microsoft.com/en-us/visualstudio/releases/2022/redistribution

Microsoft says the architecture must match the app and the installed runtime must be at least as recent as the build tools used. Redistribution rights are subject to the applicable Visual Studio license. No redistribution is proposed here.

Native notices are carried by the pinned archives: Node LICENSE; EDB server_license.txt and commandlinetools_3rd_party_licenses.txt; Prisma engine license at the pinned commit; bcrypt's installed license. These files must be included and rechecked before any package is distributed. `dependency-notices.json` inventories 194 production lockfile entries from installed package metadata, preserving unknown license fields instead of guessing. Unknown metadata does not mean a package is unlicensed. In particular pause 0.0.1 has an already verified MIT notice in its Readme.md; its missing package.json license field is only a metadata gap.

## Windows-only changes

Use node.exe and the staged Prisma CLI directly, npm.cmd only during preparation, `path.join`/Join-Path and quoted controlled paths, PowerShell environment assignments, IPC close rather than Unix signals. No POSIX launcher is claimed to work on Windows. Frontend/UI is explicitly out of scope for this slice and remains part of the later user outcome.

## Validation status

`node --check` passes for both added JS helpers. Windows PowerShell parsing/execution is unavailable locally. Local SQL validation was attempted, but the installed client has no server/initdb binary; no database was started and no SQL pass is claimed. Exact source still needs independent review before any publication or fifth run.

Job budget: the unchanged workflow timeout is 20 minutes. Preparation previously took about 5 to 8 minutes. Its worst-case downloads have no tighter overall bound, so a timeout can still occur. The baseline child is at most 180 seconds and the new child at most 420 seconds, plus setup/cleanup. A job timeout is failure and must not be reported as qualification; no timeout is extended without review.
