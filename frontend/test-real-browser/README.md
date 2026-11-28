# Real clinical browser regression

Uses actual Vite, Nest AppModule, Prisma and PostgreSQL. No provider mocks. Only run against a separate disposable database whose name contains hms_test. Applies repository migrations and creates fictional records; retains them, does not purge audit history. Database URL is a test-owner URL because this harness installs/removes synthetic rejection triggers. This browser gate does not establish restricted-runtime protection; the separate backend realPG suite covers that with explicit role identity evidence.

From the repository root after locked installs, Prisma generate and backend build:

    cd frontend
    node node_modules/playwright/cli.js install chromium
    HMS_BROWSER_DATABASE_URL=... node test-real-browser/clinical.mjs

No embedded PostgreSQL package or absolute project/browser path is required. Playwright is locked in package-lock.json. Its default Chromium is used; optional HMS_BROWSER_EXECUTABLE selects an already installed local browser. HMS_BROWSER_ARTIFACTS selects an output folder, default frontend/browser-artifacts. Requires the Vite test port5194 available. Temporary JWT secret and fictional login password are random and not printed. On failure trigger teardown is not promised, since the entire DB is disposable; never use a shared or hosted database. CI uses its own named browser-test DB and uploads result/screenshots on failure or success.

Arabic390 and English1440 clinical and registration SQL-audit-failure/retry flows are covered. This is not all-role/a11y/full-browser acceptance, and CI scaffold has not run on GitHub yet.

## Isolated public-demo candidate

public-clinical.mjs, public-stock.mjs, public-workflows.mjs, public-appointments.mjs, public-billing.mjs and public-users.mjs run actual API requests through a separate restricted NOSUPERUSER/NOBYPASSRLS login. They seed fixtures through the disposable test owner, issue explicitly workspace-bound test sessions and run public-mode app/role UX, while preserving original audit-failure/rollback/retry assertions. These suites do not claim UI anonymous bootstrap for every workflow. Separate production isolation harness evidence covers actual bootstrap/role switching/expiry and same-origin compiled UI.

Set the owner test URL options to hms.workspace_id=00000000-0000-4000-a000-000000000001 (URI encoded as options=-c%20hms.workspace_id%3D00000000-0000-4000-a000-000000000001). App runtime URL removes this session option and scopes per authenticated transaction. Each suite creates its own named restricted cluster role so tests can share a CI PostgreSQL cluster with separate disposable databases. Do not run on a shared or hosted database. Candidate CI has PostgreSQL17/18 matrix and public-mode suites, but has not run until this separate candidate is published. FrozenPR3 commit8270b0b passed GitHub CI attempt2; that does not certify candidate changes.
