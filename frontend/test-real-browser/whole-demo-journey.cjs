// Bounded extension of local-demo-recovery.cjs. Fictional UI writes only.
// Review candidate: no new execution/acceptance is implied by these assertions.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
function createJourney({ page, changeRole, label, lang, origin, out }) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const expected = {
    lang,
    nationalId: "Fictional-Journey-ID-" + lang,
    clinicalNotes: "Fictional clinical notes\nسطر وهمي",
    prescriptionNotes: "Fictional prescription notes\nملاحظات وهمية",
    medicationName: "Fictional Journey Inventory " + lang,
    departmentEn: "Fictional Journey Department " + lang,
    departmentAr: "قسم رحلة وهمية " + lang,
    bedNumber: "JOURNEY-" + lang,
    phone: "0000412345",
  };
  const roles = new Set();
  let doctor, options;
  const role = async (name) => {
    const actor = await changeRole(label("roles." + name));
    assert.equal(actor.role, name);
    roles.add(name);
    if (name === "doctor" && doctor)
      assert.equal(
        actor.id,
        doctor.id,
        "UI Doctor identity changed; no substitute",
      );
    return actor;
  };
  const api = async (route, method = "GET", data) => {
    const token = await page.evaluate(() => localStorage.getItem("hms_token"));
    const response = await page.request.fetch(origin + "/api/v1" + route, {
      method,
      headers: { Authorization: "Bearer " + token },
      ...(data ? { data } : {}),
    });
    return { status: response.status(), data: await response.json() };
  };
  const read = async (route) => {
    const r = await api(route);
    assert.equal(r.status, 200, route);
    return r.data;
  };
  const saved = async (response, status = 201) => {
    assert.equal(response.status(), status);
    return response.json();
  };
  const observe = async (suffix, click, method = "POST", status = 201) => {
    const waiting = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1" + suffix) && r.request().method() === method,
    );
    await click();
    const response = await waiting;
    return saved(response, status);
  };
  const button = (name, scope = page) =>
    scope.getByRole("button", { name: label(name), exact: true });
  const select = async (id) => {
    const exact = page.locator('[role=option][data-value="' + id + '"]');
    assert.equal(
      await exact.count(),
      1,
      "Exact observed ID must be a unique UI option",
    );
    await exact.click();
  };
  const department = () =>
    lang === "ar" ? expected.departmentAr : expected.departmentEn;
  const selectDepartment = async () => {
    await select(expected.departmentId);
  };
  const closeDialog = () =>
    page.getByRole("dialog").waitFor({ state: "hidden" });
  const card = () =>
    page.locator(".MuiCard-root").filter({
      has: page.getByText("Fictional Local Recovery " + lang, {
        exact: true,
      }),
    });
  async function setup() {
    await role("admin");
    await page.goto(origin + "/departments");
    await button("setup.createDepartment").click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(label("setup.nameAr"), { exact: true })
      .fill(expected.departmentAr);
    await dialog
      .getByLabel(label("setup.nameEn"), { exact: true })
      .fill(expected.departmentEn);
    const dep = await observe("/departments", () =>
      button("setup.confirm", dialog).click(),
    );
    expected.departmentId = dep.id;
    assert.equal(dep.nameEn, expected.departmentEn);
    await closeDialog();
    await page
      .getByRole("combobox", { name: label("departments.choose"), exact: true })
      .click();
    await selectDepartment();
    await button("setup.createBed").click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(label("setup.bedNumber"), { exact: true })
      .fill(expected.bedNumber);
    const bed = await observe("/departments/" + dep.id + "/beds", () =>
      button("setup.confirm", dialog).click(),
    );
    expected.bedId = bed.id;
    assert.equal(bed.status, "available");
    await closeDialog();
    await page.getByText(expected.bedNumber, { exact: true }).first().waitFor();
    await page.screenshot({
      path: out + "/journey-admin-setup-" + lang + ".png",
      fullPage: true,
    });
    doctor = await role("doctor");
    expected.doctorId = doctor.id;
    await role("receptionist");
  }
  async function patientCreated(response) {
    const p = await saved(response);
    expected.patientId = p.id;
    expected.mrn = p.mrn;
    assert.equal(p.nationalId, expected.nationalId);
  }
  async function patientReady(patientPath) {
    assert.equal(patientPath, "/patients/" + expected.patientId);
    expected.patientPath = patientPath;
    await page.goto(origin + "/patients/new");
    await page
      .getByLabel(label("patients.fullName"), { exact: true })
      .fill("Fictional duplicate probe " + lang);
    await page
      .getByLabel(label("patients.dateOfBirth"), { exact: true })
      .fill("1992-02-02");
    await page
      .locator("form").getByRole("combobox")
      .click();
    await page
      .getByRole("option", { name: label("patients.genderMale"), exact: true })
      .click();
    await page
      .getByLabel(label("patients.phone"), { exact: true })
      .fill("0000555555");
    await page
      .getByLabel(label("patients.nationalId"), { exact: true })
      .fill(expected.nationalId);
    const warning = await observe(
      "/patients",
      () => button("patients.save").click(),
      "POST",
      409,
    );
    assert.ok(JSON.stringify(warning).includes(expected.patientId));
    await button("patients.duplicateCancel", page.getByRole("dialog")).click();
    await closeDialog();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const found = await read(
      "/patients?search=" +
        encodeURIComponent("Fictional duplicate probe " + lang),
    );
    assert.ok(Array.isArray(found));
    assert.equal(found.length, 0);
    await page.goto(origin + patientPath + "/edit");
    await page.locator("#patient-edit-phone").fill(expected.phone);
    const edited = await observe(
      "/patients/" + expected.patientId,
      () => button("patients.save").click(),
      "PATCH",
      200,
    );
    assert.equal(edited.phone, expected.phone);
    options = await read("/appointments/options");
    assert.equal(options.doctors.filter((x) => x.id === doctor.id).length, 1);
    assert.ok(options.departments.some((x) => x.id === expected.departmentId));
  }
  async function selectDoctor() {
    assert.equal(options.doctors.filter((x) => x.id === doctor.id).length, 1);
    await select(doctor.id);
  }
  async function scenarioDay() {
    return page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    });
  }
  async function booked(response) {
    const row = await saved(response);
    const sent = response.request().postDataJSON();
    assert.equal(sent.doctorId, doctor.id);
    assert.equal(row.doctorId, doctor.id);
    assert.equal(row.patientId, expected.patientId);
    assert.equal(row.departmentId, expected.departmentId);
    assert.equal(row.status, "scheduled");
    expected.appointmentId = row.id;
    expected.appointmentAt = row.scheduledAt;
    expected.scenarioDay = await scenarioDay();
  }
  async function attended(response) {
    const row = await saved(response);
    assert.equal(row.id, expected.appointmentId);
    assert.equal(row.status, "completed");
  }
  async function startLinkedVisit() {
    await role("doctor");
    await page.goto(origin + "/appointments");
    await page.locator("input[type=date]").fill(expected.scenarioDay);
    await card()
      .getByRole("link", { name: label("emr.startAppointment"), exact: true })
      .click();
    await page.waitForURL(
      (u) =>
        u.pathname === expected.patientPath &&
        u.searchParams.get("appointment") === expected.appointmentId,
    );
  }
  async function encounterSaved(response) {
    const row = await saved(response);
    assert.equal(row.doctorId, doctor.id);
    assert.equal(row.appointmentId, expected.appointmentId);
    assert.equal(row.notes, expected.clinicalNotes);
    expected.encounterId = row.id;
  }
  async function prescriptionSaved(response) {
    const row = await saved(response);
    assert.equal(row.encounterId, expected.encounterId);
    assert.equal(row.notes, expected.prescriptionNotes);
    expected.prescriptionId = row.id;
  }
  async function medication() {
    await page
      .getByLabel(label("medicationCreate.name"), { exact: true })
      .fill(expected.medicationName);
    await page
      .getByLabel(label("medicationCreate.unit"), { exact: true })
      .fill("fictional-unit");
    await page
      .getByLabel(label("medicationCreate.currentStock"), { exact: true })
      .fill("5");
    await page
      .getByLabel(label("medicationCreate.reorderThreshold"), { exact: true })
      .fill("4");
    const med = await observe("/medications", () =>
      button("medicationCreate.create").click(),
    );
    assert.equal(med.currentStock, 5);
    assert.ok(
      !(await read("/medications/low-stock")).some((x) => x.id === med.id),
    );
    expected.medicationId = med.id;
    await page
      .getByText(label("medicationCreate.saved"), { exact: true })
      .waitFor();
  }
  async function selectMedication() {
    await select(expected.medicationId);
  }
  async function dispensed(response) {
    const row = await saved(response);
    assert.equal(row.id, expected.prescriptionId);
    assert.equal(row.status, "dispensed");
    const meds = await read("/medications");
    assert.equal(
      meds.find((x) => x.id === expected.medicationId).currentStock,
      4,
    );
    assert.ok(
      (await read("/medications/low-stock")).some(
        (x) => x.id === expected.medicationId,
      ),
    );
  }
  async function invoiced(response) {
    const row = await saved(response);
    assert.equal(row.patientId, expected.patientId);
    assert.equal(row.patientResponsibility, 100);
    expected.invoiceId = row.id;
  }
  async function paid(response) {
    await saved(response);
    const row = await read("/invoices/" + expected.invoiceId);
    assert.equal(row.remaining, 60);
    assert.equal(row.totalPaid, 40);
    assert.equal(row.status, "partial");
    expected.paymentId = row.payments[0].id;
  }
  async function manager(recoveryOnly = false) {
    await role("manager");
    await page.goto(origin + "/overview");
    await page
      .getByRole("heading", { name: department(), exact: true })
      .waitFor();
    const range = await page.evaluate(() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const e = new Date(d);
      e.setDate(e.getDate() + 1);
      return (
        "?start=" +
        encodeURIComponent(d.toISOString()) +
        "&end=" +
        encodeURIComponent(e.toISOString())
      );
    });
    const summary = (
      await read("/departments/overview" + range)
    ).departments.find((x) => x.id === expected.departmentId);
    assert.equal(summary.available, 1);
    assert.equal(summary.occupied, 0);
    expected.managerAvailable = summary.available;
    await page.goto(origin + "/departments");
    await page
      .getByRole("combobox", { name: label("departments.choose"), exact: true })
      .click();
    await selectDepartment();
    assert.equal(await button("setup.createBed").count(), 0);
    assert.equal(await button("departments.admit").count(), 0);
    await page.goto(origin + "/billing?invoice=" + expected.invoiceId);
    await page
      .getByText(new RegExp(expected.invoiceId.slice(0,8)))
      .first()
      .waitFor();
    assert.equal(await button("billing.create").count(), 0);
    assert.equal(await button("billing.record").count(), 0);
    if (!recoveryOnly) {
      const forbidden = await api(
        "/invoices/" + expected.invoiceId + "/payments",
        "POST",
        { amount: 1, method: "cash" },
      );
      assert.equal(forbidden.status, 403);
      const after = await read("/invoices/" + expected.invoiceId);
      assert.equal(after.totalPaid, 40);
      assert.equal(after.payments.length, 1);
    } else {
      const restoredInvoice = await read("/invoices/" + expected.invoiceId);
      assert.equal(restoredInvoice.remaining, 60);
      assert.equal(restoredInvoice.totalPaid, 40);
      assert.equal(restoredInvoice.status, "partial");
      assert.equal(restoredInvoice.payments.length, 1);
      assert.equal(restoredInvoice.payments[0].id, expected.paymentId);
    }
    await page.screenshot({
      path: out + "/journey-manager-" + lang + ".png",
      fullPage: true,
    });
  }
  async function deleteSeparate() {
    await role("doctor");
    await page.goto(origin + expected.patientPath);
    await page
      .getByLabel(label("emr.complaint"), { exact: true })
      .fill("Fictional removed complaint");
    await page
      .getByLabel(label("emr.diagnosis"), { exact: true })
      .fill("Fictional removed journey " + lang);
    const row = await observe("/encounters", () =>
      button("emr.saveEncounter").click(),
    );
    expected.deletedEncounterId = row.id;
    await page
      .getByLabel(label("emr.medication"), { exact: true })
      .fill("Fictional retained deleted medicine");
    await page
      .getByLabel(label("emr.dose"), { exact: true })
      .fill("Fictional dose");
    await page
      .getByLabel(label("emr.duration"), { exact: true })
      .fill("Fictional duration");
    const rx = await observe("/encounters/" + row.id + "/prescriptions", () =>
      button("emr.add").click(),
    );
    expected.deletedPrescriptionId = rx.id;
    const region = page.getByRole("region", {
      name: label("testOrder.title"),
      exact: true,
    });
    await region
      .getByLabel(label("testOrder.name"), { exact: true })
      .fill("Fictional retained deleted test " + lang);
    const order = await observe("/test-orders", () =>
      button("testOrder.submit", region).click(),
    );
    expected.deletedOrderId = order.id;
    await role("lab_tech");
    await page.goto(origin + "/lab");
    const test = page
      .locator(".MuiCard-root")
      .filter({ has: page.getByText(order.testName, { exact: true }) });
    await button("lab.record", test).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(label("lab.result"), { exact: true })
      .fill("Fictional retained deleted result " + lang);
    await button("lab.save", dialog).click();
    await closeDialog();
    await role("doctor");
    await page.goto(origin + expected.patientPath);
    await page
      .getByRole("button", {
        name: label("emr.deleteOpen") + " " + row.diagnosis,
        exact: true,
      })
      .click();
    await page
      .getByLabel(label("emr.deleteReason"), { exact: true })
      .fill("Fictional journey deletion reason");
    let deletes = 0,
      deleteStatus,
      deleteTransportFailure = false;
    await page.route("**/api/v1/encounters/" + row.id, async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      deletes++;
      try {
        const r = await route.fetch();
        deleteStatus = r.status();
      } catch {
        deleteTransportFailure = true;
      } finally {
        await route.abort("failed");
      }
    });
    await button("emr.deleteConfirm").click();
    await button("emr.deleteCheck").waitFor();
    await page.reload();
    await button("emr.deleteCheck").click();
    await page
      .getByText(label("emr.deleteUnavailable"), { exact: true })
      .waitFor();
    assert.equal(
      deleteTransportFailure,
      false,
      "Committed response-loss route transport failed",
    );
    assert.equal(deleteStatus, 200, "Committed response-loss server status");
    assert.equal(deletes, 1);
    await button("emr.deleteReviewed").click();
    await closeDialog();
    await page.unroute("**/api/v1/encounters/" + row.id);
    expected.deleteRequests = deletes;
    const history = await read("/patients/" + expected.patientId + "/records");
    assert.ok(history.some((x) => x.id === expected.encounterId));
    assert.ok(!history.some((x) => x.id === row.id));
    assert.ok(
      (await read("/patients/" + expected.patientId + "/test-results")).some(
        (x) => x.id === order.id,
      ),
    );
  }
  async function finish() {
    await manager();
    await deleteSeparate();
    await role("admin");
    await page.goto(origin + "/audit");
    await page
      .getByRole("heading", { name: label("nav.audit"), exact: true })
      .waitFor();
    const audit = await read("/demo/audit");
    for (const [id, action] of [
      [expected.encounterId, "ENCOUNTER_CREATED"],
      [expected.deletedEncounterId, "ENCOUNTER_SOFT_DELETED"],
      [expected.departmentId, "DEPARTMENT_CREATED"],
    ])
      assert.ok(
        audit.some((x) => x.entityId === id && x.action === action),
        "Journey audit missing " + action,
      );
    expected.auditIds = audit
      .filter((x) =>
        [
          expected.encounterId,
          expected.deletedEncounterId,
          expected.departmentId,
        ].includes(x.entityId),
      )
      .map((x) => x.id);
    assert.equal(roles.size, 8);
  }
  async function verifyState(localDir, sourceOnly = false) {
    const history = await read("/patients/" + expected.patientId + "/records");
    const encounter = history.find((x) => x.id === expected.encounterId);
    assert.ok(encounter);
    assert.equal(encounter.appointmentId, expected.appointmentId);
    assert.equal(encounter.notes, expected.clinicalNotes);
    assert.equal(
      encounter.prescriptions.find((x) => x.id === expected.prescriptionId)
        .notes,
      expected.prescriptionNotes,
    );
    assert.equal(
      encounter.prescriptions.find((x) => x.id === expected.prescriptionId)
        .status,
      "dispensed",
    );
    assert.ok(!history.some((x) => x.id === expected.deletedEncounterId));
    await page.getByText(expected.clinicalNotes, { exact: true }).waitFor();
    await page.getByText(expected.prescriptionNotes, { exact: true }).waitFor();
    const results = await read(
      "/patients/" + expected.patientId + "/test-results",
    );
    const mainResults = results.filter((x) =>
      ["Fictional Lab " + lang, "Fictional Imaging " + lang].includes(
        x.testName,
      ),
    );
    assert.equal(mainResults.length, 2);
    assert.ok(
      mainResults.every(
        (x) => x.result === x.testName + " completed fictional result",
      ),
    );
    if (sourceOnly)
      expected.mainResultIds = mainResults.map((x) => x.id).sort();
    else
      assert.deepEqual(
        mainResults.map((x) => x.id).sort(),
        expected.mainResultIds,
      );
    // Read-only local owner inspection, never passed to app/exported/logged. Existing kit owns setup and lifecycle.
    assert.ok(
      path.basename(localDir) === (sourceOnly ? "source" : "restored") &&
        path
          .dirname(localDir)
          .startsWith(
            require("node:os").tmpdir() + path.sep + "hms-local-proof-",
          ),
    );
    const cfg = JSON.parse(
      fs.readFileSync(path.join(localDir, "config.json"), "utf8"),
    );
    const u = new URL("postgresql://127.0.0.1:" + cfg.port + "/hms_local_demo");
    u.username = "hms_owner";
    u.password = cfg.passwords.hms_owner;
    const {
      PrismaClient,
    } = require("../../backend/node_modules/@prisma/client");
    const db = new PrismaClient({ datasources: { db: { url: u.toString() } } });
    try {
      const data = (await db.$queryRawUnsafe("SHOW data_directory"))[0]
        .data_directory;
      assert.equal(path.resolve(data), path.join(localDir, "pgdata"));
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const removed = await tx.encounter.findUnique({
          where: { id: expected.deletedEncounterId },
        });
        assert.ok(removed.deletedAt);
        assert.equal(removed.deleteReason, "Fictional journey deletion reason");
        assert.ok(
          await tx.prescription.findUnique({
            where: { id: expected.deletedPrescriptionId },
          }),
        );
        assert.equal(
          (
            await tx.testOrder.findUnique({
              where: { id: expected.deletedOrderId },
            })
          ).status,
          "completed",
        );
        assert.equal(
          (await tx.patient.findUnique({ where: { id: expected.patientId } }))
            .phone,
          expected.phone,
        );
        assert.equal(
          (
            await tx.appointment.findUnique({
              where: { id: expected.appointmentId },
            })
          ).status,
          "completed",
        );
        assert.equal(
          (
            await tx.medication.findUnique({
              where: { id: expected.medicationId },
            })
          ).currentStock,
          4,
        );
        const queues = await tx.waitlistRequest.findMany({
          where: {
            patientId: expected.patientId,
            departmentId: expected.departmentId,
          },
        });
        assert.equal(queues.length, 1);
        assert.equal(queues[0].status, "admitted");
        assert.equal(queues[0].id, expected.waitlistId);
        const admissions = await tx.admission.findMany({
          where: { patientId: expected.patientId, bedId: expected.bedId },
        });
        assert.equal(admissions.length, 1);
        assert.ok(admissions[0].dischargedAt);
        assert.equal(admissions[0].id, expected.admissionId);
        assert.equal(queues[0].admissionId, expected.admissionId);
        assert.equal(
          (await tx.bed.findUnique({ where: { id: expected.bedId } })).status,
          "available",
        );
        const payments = await tx.payment.findMany({
          where: { invoiceId: expected.invoiceId },
        });
        assert.equal(payments.length, 1);
        assert.equal(payments[0].id, expected.paymentId);
        assert.equal(
          Number(payments[0].amount),
          40,
          "Restored retained payment amount",
        );
        const audits = await tx.auditLog.findMany({
          where: { id: { in: expected.auditIds } },
        });
        assert.equal(audits.length, expected.auditIds.length);
        const dep = await tx.department.findUnique({
          where: { id: expected.departmentId },
        });
        assert.equal(dep.nameAr, expected.departmentAr);
        assert.equal(dep.nameEn, expected.departmentEn);
      });
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      throw new Error(
        "Bounded local retained-state read failed: " +
          error.name +
          "; credential-bearing DB diagnostics intentionally omitted",
      );
    } finally {
      await db.$disconnect();
    }
    if (sourceOnly) return;
    await manager(true);
    await role("doctor");
    await page.goto(origin + expected.patientPath);
    expected.recovered = true;
  }
  function observeRole(actor) {
    assert.ok(actor.id);
    roles.add(actor.role);
    if (actor.role === "doctor" && doctor)
      assert.equal(
        actor.id,
        doctor.id,
        "Actual switched Doctor differs from booked doctor; stop",
      );
  }
  async function waitlisted(response) {
    const row = await saved(response);
    assert.equal(row.patientId, expected.patientId);
    assert.equal(row.departmentId, expected.departmentId);
    expected.waitlistId = row.id;
  }
  async function admitted(response) {
    const row = await saved(response);
    assert.equal(row.patientId, expected.patientId);
    assert.equal(row.bedId, expected.bedId);
    expected.admissionId = row.id;
    const beds = await read("/departments/" + expected.departmentId + "/beds");
    assert.equal(
      beds.find((x) => x.id === expected.bedId).status,
      "occupied",
      "Intermediate created bed occupied",
    );
  }
  async function discharged(response) {
    const row = await saved(response);
    assert.equal(row.id, expected.admissionId);
    assert.ok(row.dischargedAt);
  }
  function summary() {
    return {
      lang,
      viewportWidth: lang === "ar" ? 390 : 1280,
      managerCoverage:
        "Sequential end-state only, not cross-client synchronization",
      optional409Branches: "Not run by this extension",
      roles: [...roles].sort(),
      ids: {
        patient: expected.patientId,
        doctor: expected.doctorId,
        department: expected.departmentId,
        bed: expected.bedId,
        appointment: expected.appointmentId,
        encounter: expected.encounterId,
        prescription: expected.prescriptionId,
        medication: expected.medicationId,
        invoice: expected.invoiceId,
        payment: expected.paymentId,
        waitlist: expected.waitlistId,
        admission: expected.admissionId,
        mainResults: expected.mainResultIds,
        deletedEncounter: expected.deletedEncounterId,
        deletedPrescription: expected.deletedPrescriptionId,
        deletedTest: expected.deletedOrderId,
      },
      actualLostDeleteRequests: expected.deleteRequests,
      recovered: expected.recovered === true,
      scope:
        "Fictional UI writes, current API read-only verification and explicit local read-only retained-state inspection. No humanUAT/universal role-state/independent-media/power-loss/offline-installer claim.",
    };
  }
  return {
    expected,
    setup,
    patientCreated,
    patientReady,
    selectDoctor,
    selectDepartment,
    scenarioDay,
    booked,
    attended,
    startLinkedVisit,
    encounterSaved,
    prescriptionSaved,
    medication,
    selectMedication,
    dispensed,
    invoiced,
    paid,
    finish,
    verifyState,
    recovered: (localDir) => verifyState(localDir),
    observeRole,
    waitlisted,
    admitted,
    discharged,
    summary,
  };
}
module.exports = { createJourney };
