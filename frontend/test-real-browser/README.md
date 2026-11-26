# Real clinical browser regression

Uses actual Vite, Nest AppModule, Prisma and PostgreSQL. No provider mocks. Only run against a separate disposable database whose name contains hms_test. Applies repository migrations and creates fictional records; retains them, does not purge audit history. Database URL is a test-owner URL because this harness installs/removes synthetic rejection triggers. This browser gate does not establish restricted-runtime protection; the separate backend realPG suite covers that with explicit role identity evidence.

From the repository root after locked installs, Prisma generate and backend build:

    cd frontend
    node node_modules/playwright/cli.js install chromium
    HMS_BROWSER_DATABASE_URL=... node test-real-browser/clinical.mjs

No embedded PostgreSQL package or absolute project/browser path is required. Playwright is locked in package-lock.json. Its default Chromium is used; optional HMS_BROWSER_EXECUTABLE selects an already installed local browser. HMS_BROWSER_ARTIFACTS selects an output folder, default frontend/browser-artifacts. Requires the Vite test port5194 available. Temporary JWT secret and fictional login password are random and not printed. On failure trigger teardown is not promised, since the entire DB is disposable; never use a shared or hosted database. CI uses its own named browser-test DB and uploads result/screenshots on failure or success.

Arabic390 and English1440 clinical and registration SQL-audit-failure/retry flows are covered. This is not all-role/a11y/full-browser acceptance, and CI scaffold has not run on GitHub yet.
