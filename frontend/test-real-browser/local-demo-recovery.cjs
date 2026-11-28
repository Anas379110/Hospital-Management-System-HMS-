const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
const { createHash } = require("node:crypto");
const path = require("node:path"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."),
  base = fs.mkdtempSync(path.join(os.tmpdir(), "hms-local-proof-")),
  dir = path.join(base, "source"),
  restored = path.join(base, "restored"),
  backup = path.join(base, "backup"),
  pgBin = process.env.HMS_LOCAL_PG_BIN,
  port = Number(process.env.HMS_KIT_HTTP_PORT || 4381),
  origin = "http://127.0.0.1:" + port,
  out =
    process.env.HMS_KIT_ARTIFACTS ||
    path.join(root, "frontend/browser-artifacts/local-demo-recovery"),
  report = {
    startedAt: new Date().toISOString(),
    inputSha256: Object.fromEntries(
      [
        "local-demo/hms-local.mjs",
        "backend/src/main.ts",
        "backend/dist/src/main.js",
        "frontend/src/components/EncounterTestOrder.tsx",
        "frontend/src/components/testOrderOutcome.ts",
        "frontend/src/hooks/useLab.ts",
        "frontend/src/pages/PatientDetailPage.tsx",
        "frontend/dist/index.html",
      ].map((p) => [
        p,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, p)))
          .digest("hex"),
      ]),
    ),
    scriptSha256: createHash("sha256")
      .update(fs.readFileSync(__filename))
      .digest("hex"),
    complete: false,
    refusals: [],
    checks: [],
    externalAttempts: [],
    pageErrors: [],
  };
fs.mkdirSync(out, { recursive: true });
(async () => {
  let app, browser, page;
  const sessions = [];
  const runKit = (args, ok = true) => {
    const r = spawnSync(
      process.execPath,
      ["local-demo/hms-local.mjs", ...args],
      { cwd: root, encoding: "utf8", timeout: 120000 },
    );
    if (ok) assert.equal(r.status, 0, r.stdout + r.stderr);
    else {
      assert.notEqual(r.status, 0);
      report.refusals.push({
        command: args[0],
        target: path.basename(args[args.indexOf("--dir") + 1]),
        exitStatus: r.status,
        diagnostic: JSON.parse(r.stderr.trim()).error,
      });
    }
    return r.stdout.trim();
  };
  const stop = async () => {
    if (app && app.exitCode === null) {
      app.kill("SIGTERM");
      await new Promise((r) => app.once("exit", r));
      assert.equal(app.exitCode, 0);
    }
  };
  try {
    assert.ok(pgBin, "HMS_LOCAL_PG_BIN required");
    report.init = JSON.parse(
      runKit([
        "init",
        "--dir",
        dir,
        "--pg-bin",
        pgBin,
        "--port",
        process.env.HMS_LOCAL_PG_PORT || "55601",
      ]),
    );
    runKit(["init", "--dir", dir, "--pg-bin", pgBin], false);
    app = spawn(
      process.execPath,
      [
        "local-demo/hms-local.mjs",
        "serve",
        "--dir",
        dir,
        "--http-port",
        String(port),
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((r, j) => {
      app.stdout.on("data", (x) => {
        if (String(x).includes("foreground")) r();
      });
      app.once("exit", (c) => j(Error("serve exit" + c)));
    });
    runKit(
      ["backup", "--dir", dir, "--out", path.join(base, "while-running")],
      false,
    );
    browser = await chromium.launch({
      headless: true,
      ...(process.env.HMS_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HMS_BROWSER_EXECUTABLE }
        : {}),
      args: ["--no-sandbox"],
    });
    for (const lang of ["en", "ar"]) {
      const c = await browser.newContext({
        timezoneId: "Europe/Istanbul",
        viewport: { width: lang === "ar" ? 390 : 1440, height: 1100 },
        serviceWorkers: "block",
      });
      await c.route("**/*", (route) => {
        const u = route.request().url();
        if (new URL(u).origin === origin) return route.continue();
        report.externalAttempts.push(u);
        return route.abort();
      });
      await c.routeWebSocket("**/*", (ws) => {
        report.externalAttempts.push(ws.url());
        ws.close();
      });
      page = await c.newPage();
      page.on("pageerror", (e) => report.pageErrors.push(e.message));
      const T = (en, ar) => (lang === "ar" ? ar : en);
      const dict = require(
        path.join(root, "frontend/src/i18n/" + lang + ".json"),
      );
      const label = (k) => k.split(".").reduce((v, p) => v[p], dict);
      await page.goto(origin + "/login");
      if (lang === "en") {
        await page
          .getByRole("button", { name: "English", exact: true })
          .click();
      }
      await page
        .getByRole("button", {
          name: T("Start a private demo workspace", "ابدأ مساحة تجريبية خاصة"),
          exact: true,
        })
        .click();
      await page.waitForURL((u) => !u.pathname.includes("/login"));
      const changeRole = async (role) => {
        await page
          .getByRole("combobox", {
            name: T("Demo role", "الدور التجريبي"),
            exact: true,
          })
          .click();
        const navigation = page.waitForEvent("load");
        const response = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/v1/demo/role") &&
            r.request().method() === "POST",
        );
        await page.getByRole("option", { name: role, exact: true }).click();
        const changed = await response;
        assert.equal(changed.status(), 201, "role switch");
        await navigation;
        await page
          .getByRole("combobox", {
            name: T("Demo role", "الدور التجريبي"),
            exact: true,
          })
          .filter({ hasText: role })
          .waitFor();
        await page.waitForTimeout(100);
      };
      // UI creates a new patient. No direct API fixtures or injected token.
      await page.goto(origin + "/patients/new");
      await page
        .getByRole("textbox", {
          name: T("Full Name", "الاسم الكامل"),
          exact: true,
        })
        .fill("Fictional Local Recovery " + lang);
      await page
        .getByLabel(T("Date of Birth", "تاريخ الميلاد"), { exact: true })
        .fill("1991-01-01");
      await page
        .getByRole("textbox", { name: T("Phone", "رقم الهاتف"), exact: true })
        .fill("0000000000");
      await page
        .getByRole("button", { name: T("Save", "حفظ"), exact: true })
        .click();
      await page.waitForURL((u) => u.pathname === "/patients");
      await page
        .getByRole("textbox", {
          name: T("Find a patient", "ابحث عن مريض"),
          exact: true,
        })
        .fill("Fictional Local Recovery " + lang);
      const link = page
        .getByText("Fictional Local Recovery " + lang, { exact: true })
        .first();
      await link.click();
      const patientPath = new URL(page.url()).pathname;
      await changeRole(T("Doctor", "طبيب"));
      await page.goto(origin + patientPath);
      await page
        .getByRole("textbox", {
          name: T("Chief complaint", "الشكوى الرئيسية"),
          exact: true,
        })
        .fill("Fictional local complaint");
      await page
        .getByRole("textbox", { name: T("Diagnosis", "التشخيص"), exact: true })
        .fill("Fictional diagnosis");
      await page
        .getByRole("button", {
          name: T("Save encounter", "حفظ الزيارة"),
          exact: true,
        })
        .click();
      await page
        .getByText(T("Encounter saved.", "حُفظت الزيارة."), { exact: true })
        .waitFor();
      const order = page.getByRole("region", {
        name: T("Order lab or imaging test", "طلب تحليل أو تصوير"),
        exact: true,
      });
      await order
        .getByRole("textbox", {
          name: T("Test name", "اسم الفحص"),
          exact: true,
        })
        .fill("Fictional Lab " + lang);
      await order
        .getByRole("button", {
          name: T("Order test", "طلب الفحص"),
          exact: true,
        })
        .click();
      await order
        .getByText(
          T(
            "Test ordered. It is now in the pending test queue.",
            "سُجل طلب الفحص وأُضيف إلى قائمة الفحوص المنتظرة.",
          ),
          { exact: true },
        )
        .waitFor();
      await order.locator("#encounter-test-type").click();
      await page
        .getByRole("option", { name: T("Radiology", "أشعة"), exact: true })
        .click();
      await order
        .getByRole("textbox", {
          name: T("Test name", "اسم الفحص"),
          exact: true,
        })
        .fill("Fictional Imaging " + lang);
      await order
        .getByRole("button", {
          name: T("Order test", "طلب الفحص"),
          exact: true,
        })
        .click();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: out + "/doctor-orders-" + lang + ".png",
        fullPage: true,
      });

      await page
        .getByRole("textbox", {
          name: T("Medication name", "اسم الدواء"),
          exact: true,
        })
        .fill("Fictional medicine");
      await page
        .getByRole("textbox", { name: T("Dose", "الجرعة"), exact: true })
        .fill("Fictional dose");
      await page
        .getByRole("textbox", { name: T("Duration", "المدة"), exact: true })
        .fill("Fictional duration");
      await page
        .getByRole("button", { name: T("Add", "إضافة"), exact: true })
        .click();
      await page
        .getByText(T("Prescription saved.", "حُفظت الوصفة."), { exact: true })
        .waitFor();

      // Explicit rejections remain editable; uncertain outcomes hold until reconciliation and never auto-retry.
      const endpoint = origin + "/api/v1/test-orders";
      let intercepted = 0;
      await order
        .getByRole("textbox", { name: label("testOrder.name"), exact: true })
        .fill("X");
      assert.equal(
        await order
          .getByRole("button", { name: label("testOrder.submit"), exact: true })
          .isEnabled(),
        false,
      );
      for (const failure of [
        { status: 400, code: "VALIDATION_ERROR" },
        { status: 403, code: "FORBIDDEN_ROLE" },
        { status: 503, code: "AUDIT_PERSISTENCE_FAILED" },
      ]) {
        await c.route(endpoint, (route) => {
          intercepted++;
          return route.fulfill({
            status: failure.status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: failure.code,
                message: "Fictional confirmed refusal",
              },
            }),
          });
        });
        await order
          .getByRole("textbox", { name: label("testOrder.name"), exact: true })
          .fill("Fictional refusal");
        await order
          .getByRole("button", { name: label("testOrder.submit"), exact: true })
          .click();
        await order.getByRole("alert").waitFor();
        assert.equal(await order.getByRole("textbox").count(), 1);
        await c.unroute(endpoint);
      }
      await c.route(endpoint, async (route) => {
        intercepted++;
        await new Promise((r) => setTimeout(r, 250));
        await route.abort("failed");
      });
      await order
        .getByRole("textbox", { name: label("testOrder.name"), exact: true })
        .fill("Fictional uncertain");
      await order
        .getByRole("button", { name: label("testOrder.submit"), exact: true })
        .click();
      assert.equal(
        await order
          .getByRole("button", { name: label("testOrder.submit"), exact: true })
          .isEnabled(),
        false,
      );
      await order
        .getByText(label("testOrder.unknown"), { exact: false })
        .waitFor();
      await page.waitForTimeout(400);
      assert.equal(intercepted, 4);
      assert.equal(await order.getByRole("textbox").count(), 0);
      await page.reload();
      await order
        .getByText(label("testOrder.unknown"), { exact: false })
        .waitFor();
      assert.equal(await order.getByRole("textbox").count(), 0);
      await page.waitForTimeout(400);
      assert.equal(intercepted, 4);
      await page.screenshot({
        path: out + "/unknown-after-reload-" + lang + ".png",
        fullPage: true,
      });
      await c.unroute(endpoint);
      await order
        .getByRole("button", { name: label("testOrder.checked"), exact: true })
        .click();
      assert.equal(await order.getByRole("textbox").inputValue(), "");
      await changeRole(T("Lab technician", "فني المختبر"));
      await page.goto(origin + "/lab");
      for (const test of [
        "Fictional Lab " + lang,
        "Fictional Imaging " + lang,
      ]) {
        const card = page
          .locator(".MuiCard-root")
          .filter({ has: page.getByText(test, { exact: true }) });
        await card
          .getByRole("button", {
            name: T("Record result", "تسجيل النتيجة"),
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("textbox", { name: T("Result", "النتيجة"), exact: true })
          .fill(test + " completed fictional result");
        await dialog
          .getByRole("button", { name: T("Save", "حفظ"), exact: true })
          .click();
        await dialog.waitFor({ state: "hidden" });
      }
      await changeRole(T("Pharmacist", "صيدلي"));
      await page.goto(origin + "/pharmacy");
      const rx = page.locator(".MuiCard-root").filter({
        has: page.getByText("Fictional Local Recovery " + lang, {
          exact: false,
        }),
      });
      await rx
        .getByRole("button", { name: T("Dispense", "صرف"), exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox").click();
      await page.getByRole("option", { name: /Fictional medicine/ }).click();
      await dialog
        .getByRole("spinbutton", {
          name: T("Quantity to dispense", "الكمية المصروفة"),
          exact: true,
        })
        .fill("1");
      await dialog
        .getByRole("button", {
          name: T("Confirm dispensing", "تأكيد الصرف"),
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await changeRole(T("Doctor", "طبيب"));
      await page.goto(origin + patientPath);
      for (const test of ["Fictional Lab " + lang, "Fictional Imaging " + lang])
        await page
          .getByText(test + " completed fictional result", { exact: true })
          .waitFor();
      await page.screenshot({
        path: out + "/completed-record-" + lang + ".png",
        fullPage: true,
      });

      await changeRole(label("roles.receptionist"));
      await page.goto(origin + "/appointments");
      await page
        .getByRole("button", { name: label("appointments.new"), exact: true })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("combobox", {
          name: label("appointments.patientId"),
          exact: true,
        })
        .fill("Fictional Local Recovery " + lang);
      await page
        .getByRole("option", {
          name: new RegExp("Fictional Local Recovery " + lang),
        })
        .click();
      await dialog.locator("#appointment-doctor").click();
      await page.getByRole("option").first().click();
      await dialog.locator("#appointment-department").click();
      await page.getByRole("option").first().click();
      // Fixed fictional scenario date is computed from this browser's current local day, no scheduling commitment.
      const day = await page.locator("input[type=date]").inputValue();
      await dialog.locator("input[type=datetime-local]").fill(day + "T18:30");
      await dialog
        .getByRole("button", { name: label("appointments.book"), exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      const appointment = page.locator(".MuiCard-root").filter({
        has: page.getByText("Fictional Local Recovery " + lang, {
          exact: true,
        }),
      });
      await appointment
        .getByRole("button", {
          name: label("appointments.markAttended"),
          exact: true,
        })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", {
          name: label("appointments.confirmAttendance"),
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByText(label("appointments.attendanceSaved"), { exact: true })
        .waitFor();
      await changeRole(label("roles.billing_clerk"));
      await page.goto(origin + "/billing");
      await page
        .getByRole("combobox", {
          name: label("billing.patientLookup"),
          exact: true,
        })
        .fill("Fictional Local Recovery " + lang);
      await page
        .getByRole("option", {
          name: new RegExp("Fictional Local Recovery " + lang),
        })
        .click();
      await page
        .getByRole("textbox", {
          name: label("billing.description"),
          exact: true,
        })
        .fill("Fictional local service");
      await page
        .getByRole("spinbutton", {
          name: label("billing.unitPrice"),
          exact: true,
        })
        .fill("100");
      await page
        .getByRole("button", { name: label("billing.create"), exact: true })
        .click();
      await page.getByText(label("billing.saved"), { exact: true }).waitFor();
      await page
        .getByRole("spinbutton", { name: label("billing.amount"), exact: true })
        .fill("100");
      await page
        .getByRole("button", { name: label("billing.record"), exact: true })
        .click();
      await page
        .getByText(label("billing.paymentSaved"), { exact: true })
        .waitFor();
      await page.screenshot({
        path: out + "/paid-invoice-" + lang + ".png",
        fullPage: true,
      });

      await changeRole(label("roles.nurse"));
      await page.goto(origin + "/departments");
      await page.locator("main").getByRole("combobox").first().click();
      await page.getByRole("option").first().click();
      const queue = page.getByRole("region", {
        name: label("waitlist.title"),
        exact: true,
      });
      await queue
        .getByRole("button", { name: label("waitlist.add"), exact: true })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("combobox")
        .fill("Fictional Local Recovery " + lang);
      await page
        .getByRole("option", {
          name: new RegExp("Fictional Local Recovery " + lang),
        })
        .click();
      await dialog
        .getByRole("button", {
          name: label("waitlist.confirmAdd"),
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await queue.getByText(label("waitlist.added"), { exact: true }).waitFor();
      await page
        .getByRole("button", { name: label("departments.admit"), exact: true })
        .first()
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("combobox")
        .fill("Fictional Local Recovery " + lang);
      await page
        .getByRole("option", {
          name: new RegExp("Fictional Local Recovery " + lang),
        })
        .click();
      await dialog
        .getByRole("button", {
          name: label("departments.confirmAdmit"),
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByText(label("departments.admitSuccess"), { exact: true })
        .waitFor();
      await queue.getByText(label("waitlist.empty"), { exact: true }).waitFor();
      await page
        .getByRole("button", {
          name: label("departments.discharge"),
          exact: true,
        })
        .first()
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", {
          name: label("departments.confirmDischarge"),
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByText(label("departments.dischargeSuccess"), { exact: true })
        .waitFor();
      await page.screenshot({
        path: out + "/beds-waitlist-" + lang + ".png",
        fullPage: true,
      });
      await changeRole(label("roles.doctor"));
      await page.goto(origin + patientPath);
      report.checks.push({
        lang,
        patientPath,
        createdPatient: true,
        doctorLabAndImaging: true,
        labAndImagingResults: true,
        prescribedAndDispensed: true,
        appointmentAndAttendance: true,
        fictionalInvoiceAndPayment: true,
        testOrderRefusalsAndUnknownHold: true,
        unknownHoldAfterActualReloadNoDuplicate: true,
        waitlistAdmitDischarge: true,
      });
      sessions.push({ context: c, page, patientPath, lang });
    }
    await stop();
    report.backup = JSON.parse(
      runKit(["backup", "--dir", dir, "--out", backup]),
    );
    report.restore = JSON.parse(
      runKit([
        "restore",
        "--dir",
        restored,
        "--pg-bin",
        pgBin,
        "--port",
        process.env.HMS_LOCAL_RECOVERY_PG_PORT || "55602",
        "--backup",
        backup,
      ]),
    );
    report.verify = JSON.parse(runKit(["verify", "--dir", restored]));
    runKit(
      ["restore", "--dir", restored, "--pg-bin", pgBin, "--backup", backup],
      false,
    );
    const altered = path.join(base, "altered");
    fs.cpSync(backup, altered, { recursive: true });
    fs.chmodSync(altered, 0o700);
    fs.appendFileSync(path.join(altered, "fictional.dump"), "tampered");
    runKit(
      [
        "restore",
        "--dir",
        path.join(base, "rejected"),
        "--pg-bin",
        pgBin,
        "--port",
        process.env.HMS_LOCAL_RECOVERY_PG_PORT || "55602",
        "--backup",
        altered,
      ],
      false,
    );
    app = spawn(
      process.execPath,
      [
        "local-demo/hms-local.mjs",
        "serve",
        "--dir",
        restored,
        "--http-port",
        String(port),
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((r, j) => {
      app.stdout.on("data", (x) => {
        if (String(x).includes("foreground")) r();
      });
      app.once("exit", (c) => j(Error("restored serve exit" + c)));
    });
    for (const session of sessions) {
      page = session.page;
      await page.goto(origin + session.patientPath);
      for (const test of [
        "Fictional Lab " + session.lang,
        "Fictional Imaging " + session.lang,
      ])
        await page
          .getByText(test + " completed fictional result", { exact: true })
          .waitFor();
      await page.screenshot({
        path: out + "/recovered-record-" + session.lang + ".png",
        fullPage: true,
      });
    }
    report.sameOriginExistingSessionRecovery = true;
    assert.deepEqual(report.externalAttempts, []);
    assert.deepEqual(report.pageErrors, []);
    report.complete = true;
  } catch (e) {
    report.error = e.stack;
    if (page)
      await page
        .screenshot({ path: out + "/failure.png", fullPage: true })
        .catch(() => {});
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await stop();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
