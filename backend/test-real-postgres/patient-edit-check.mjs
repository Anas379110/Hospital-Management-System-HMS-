import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

export async function verifyPatientEditing({ call, tokens, owner, base, artifacts, workspaceId }) {
  const scope = 'patient-demographic-edit';
  const server = (await owner.$queryRawUnsafe("SELECT version() AS full_version,current_setting('server_version_num') AS version_num"))[0];
  const created = await call('/patients', tokens.receptionist, { fullName: 'Fictional Edit Target', dateOfBirth: '1990-01-01', gender: 'male', phone: '0000000000', nationalId: ' ORIGINAL ', emergencyContactName: 'Original emergency' });
  assert.equal(created.status, 201); const original = created.data, path = '/patients/' + original.id;
  for (const role of ['doctor', 'nurse', 'manager', 'pharmacist', 'lab_tech', 'billing_clerk']) assert.equal((await call(path, tokens[role], { phone: '222222' }, 'PATCH')).status, 403);
  assert.equal((await call(path, null, { phone: '222222' }, 'PATCH')).status, 401);
  for (const data of [{ dateOfBirth: '2000-01-01' }, { gender: 'female' }, { fullName: null }, { phone: null }]) assert.equal((await call(path, tokens.receptionist, data, 'PATCH')).status, 400);
  const foreign = await call('/demo/start', null, {}); assert.equal(foreign.status, 201);
  assert.equal((await call(path, foreign.data.accessToken, { phone: '222222' }, 'PATCH')).status, 404);
  const updated = await call(path, tokens.admin, { address: 'Fictional Admin Address', emergencyContactName: null }, 'PATCH');
  assert.equal(updated.status, 200); assert.equal(updated.data.emergencyContactName, null); assert.equal(updated.data.nationalId, original.nationalId);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.HMS_BROWSER_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const screenshots = [], errors = [];
  try {
    for (const [lang, width] of [['en', 1280], ['ar', 390]]) {
      const labels = JSON.parse(readFileSync(new URL('../../frontend/src/i18n/' + lang + '.json', import.meta.url)));
      const user = (await call('/auth/me', tokens.receptionist)).data;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' }), page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
      const origin = base.replace('/api/v1', ''); await page.goto(origin + '/login');
      await page.evaluate(({ token, user, lang }) => { localStorage.setItem('hms_token', token); localStorage.setItem('hms_user', JSON.stringify(user)); localStorage.setItem('hms_demo', 'true'); localStorage.setItem('hms_locale', lang); }, { token: tokens.receptionist, user, lang });
      let patches = 0, clinicalReads = 0;
      page.on('request', request => { if (request.method() === 'PATCH') patches++; if (request.url().includes('/records') || request.url().includes('/test-orders/patient')) clinicalReads++; });
      await page.goto(origin + '/patients/' + original.id + '/edit'); const phone = page.getByLabel(labels.patients.phone, { exact: true }); await phone.waitFor();
      assert.equal(await page.getByLabel(labels.patients.dateOfBirth, { exact: true }).count(), 0);
      await page.getByLabel(labels.patients.fullName,{exact:true}).fill('ab');assert.equal(await page.getByRole('button',{name:labels.patients.save,exact:true}).isEnabled(),false);await page.screenshot({path:artifacts+'/patient-edit-validation-'+lang+'.png',animations:'disabled',fullPage:true});await page.getByLabel(labels.patients.fullName,{exact:true}).fill(original.fullName);
      await phone.fill('111111' + lang); await page.getByRole('link', { name: labels.patientEdit.cancel, exact: true }).click(); assert.equal(patches, 0);
      assert.equal((await call(path, tokens.receptionist)).data.phone, original.phone);
      await owner.patient.update({where:{id:original.id},data:{fullName:'Ab'}});assert.equal((await call(path,tokens.admin,{phone:'12',address:'External fresh '+lang},'PATCH')).status,200);
      await page.goto(origin + '/patients/' + original.id + '/edit'); await phone.waitFor(); await page.waitForFunction(()=>document.querySelector('#patient-edit-phone')?.value==='12');assert.equal(await page.getByLabel(labels.patients.address,{exact:true}).inputValue(),'External fresh '+lang);
      await page.getByLabel(labels.patients.address,{exact:true}).fill('Legacy unrelated edit '+lang);let legacySave=page.waitForResponse(r=>r.request().method()==='PATCH');await page.getByRole('button',{name:labels.patients.save,exact:true}).click();assert.equal((await legacySave).status(),200);assert.equal((await call(path,tokens.receptionist)).data.phone,'12');
      assert.equal((await call(path,tokens.receptionist)).data.fullName,'Ab');await page.getByLabel(labels.patients.fullName,{exact:true}).fill(original.fullName);
      let unexpectedRead=0;await page.route('**/api/v1/patients/'+original.id,async route=>{if(route.request().method()==='GET'){unexpectedRead++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'Fictional read failure'}})});}else await route.continue()});
      await phone.fill('222222' + lang);
      await page.getByLabel(labels.patients.nationalId, { exact: true }).fill(' LITERAL-' + lang + ' ');
      const response = page.waitForResponse(response => response.request().method() === 'PATCH'); await page.getByRole('button', { name: labels.patients.save, exact: true }).click(); assert.equal((await response).status(), 200); await page.getByText(labels.patientEdit.saved, { exact: true }).waitFor();
      await page.waitForTimeout(300);assert.equal(unexpectedRead,0);await phone.waitFor();await page.unroute('**/api/v1/patients/'+original.id);
      let current = (await call(path, tokens.receptionist)).data; assert.equal(current.phone, '222222' + lang); assert.equal(current.nationalId, ' LITERAL-' + lang + ' '); assert.equal(current.dateOfBirth, original.dateOfBirth); assert.equal(current.gender, original.gender);
      const file = artifacts + '/patient-edit-' + lang + '.png'; await page.screenshot({ path: file, animations: 'disabled', fullPage: true }); screenshots.push(file);
      // Confirmed invalid response preserves draft; no write reaches the app.
      await page.route('**/api/v1/patients/' + original.id, async route => { if (route.request().method() === 'PATCH') await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'Fictional rejected edit', details: [] } }) }); else await route.continue(); });
      await phone.fill('333333' + lang); await page.getByRole('button', { name: labels.patients.save, exact: true }).click(); await page.getByText('Fictional rejected edit', { exact: true }).waitFor(); assert.equal(await phone.inputValue(), '333333' + lang);await page.screenshot({path:artifacts+'/patient-edit-error-'+lang+'.png',animations:'disabled',fullPage:true}); await page.unroute('**/api/v1/patients/' + original.id);
      // Forward real PATCH, verify commit, then drop only its response to the browser.
      let committedResponseLost=false;
      await page.route('**/api/v1/patients/' + original.id, async route => { if (route.request().method() === 'PATCH') {const actual=await route.fetch();assert.equal(actual.status(),200);assert.equal((await call(path,tokens.receptionist)).data.phone,'333333'+lang);committedResponseLost=true;await route.abort();} else await route.continue(); });
      await page.getByRole('button', { name: labels.patients.save, exact: true }).click(); await page.getByRole('button', { name: labels.patientEdit.checked, exact: true }).waitFor();assert.equal(committedResponseLost,true); const attempts = patches;await page.screenshot({path:artifacts+'/patient-edit-held-'+lang+'.png',animations:'disabled',fullPage:true}); await page.reload(); await page.getByRole('button', { name: labels.patientEdit.checked, exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: labels.patients.save, exact: true }).isEnabled(), false); assert.equal(patches, attempts);
      await page.unroute('**/api/v1/patients/' + original.id); await page.getByRole('button', { name: labels.patientEdit.checked, exact: true }).click(); await page.getByRole('button', { name: labels.patientEdit.checked, exact: true }).waitFor({ state: 'hidden' }); assert.equal(await phone.inputValue(), '333333' + lang); assert.equal(clinicalReads, 0);
      // Proxy5xx may hide a commit; conservative hold. No server write is asserted here.
      await page.route('**/api/v1/patients/'+original.id,async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:{code:'BAD_GATEWAY',message:'Fictional gateway failure',details:[]}})});else await route.continue()});
      await phone.fill('444444'+lang);await page.getByRole('button',{name:labels.patients.save,exact:true}).click();await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).waitFor();await page.unroute('**/api/v1/patients/'+original.id);await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).click();await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).waitFor({state:'hidden'});assert.equal(await phone.inputValue(),'333333'+lang);
      // Actual audit failure rolls back PATCH; UI conservatively holds even this confirmed rollback.
      await owner.$executeRawUnsafe("CREATE FUNCTION hms_test_edit_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PATIENT_UPDATED' THEN RAISE EXCEPTION 'fictional edit audit failure'; END IF; RETURN NEW; END $$");await owner.$executeRawUnsafe('CREATE TRIGGER hms_test_edit_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_edit_audit_reject()');
      try{await phone.fill('555555'+lang);const rejected=page.waitForResponse(r=>r.request().method()==='PATCH');await page.getByRole('button',{name:labels.patients.save,exact:true}).click();assert.equal((await rejected).status(),503);await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).waitFor();assert.equal((await call(path,tokens.receptionist)).data.phone,'333333'+lang);}finally{await owner.$executeRawUnsafe('DROP TRIGGER hms_test_edit_audit_failure ON audit_logs');await owner.$executeRawUnsafe('DROP FUNCTION hms_test_edit_audit_reject()')}
      await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).click();await page.getByRole('button',{name:labels.patientEdit.checked,exact:true}).waitFor({state:'hidden'});
      await page.goto(origin + '/patients'); await page.getByLabel(labels.patients.searchLabel, { exact: true }).fill(original.mrn); const editLink = page.getByRole('link', { name: labels.patientEdit.edit, exact: true }); await editLink.waitFor();await page.screenshot({path:artifacts+'/patient-edit-list-'+lang+'.png',animations:'disabled',fullPage:true});
      // Stay within SPA cache lifetime, then change via another actor and reopen.
      assert.equal((await call(path,tokens.admin,{phone:'676767'+lang},'PATCH')).status,200);await editLink.click();await phone.waitFor();await page.waitForFunction(expected=>document.querySelector('#patient-edit-phone')?.value===expected,'676767'+lang);assert.equal(clinicalReads,0);
      // Restore same starting phone for independent language cancel proof.
      assert.equal((await call(path, tokens.admin, { phone: original.phone }, 'PATCH')).status, 200);
      await context.close();
    }
    for (const role of ['doctor','nurse','manager','pharmacist','lab_tech','billing_clerk']) {
      const context = await browser.newContext(), page = await context.newPage(), user = (await call('/auth/me',tokens[role])).data;
      await page.goto(base.replace('/api/v1','')+'/login'); await page.evaluate(({token,user})=>{localStorage.setItem('hms_token',token);localStorage.setItem('hms_user',JSON.stringify(user));localStorage.setItem('hms_locale','en')},{token:tokens[role],user});
      let patientReads=0;page.on('request',r=>{if(r.url().includes('/api/v1/patients/'))patientReads++});
      await page.goto(base.replace('/api/v1','')+path+'/edit');await page.getByText('You do not have access to this workspace.',{exact:true}).waitFor();assert.equal(patientReads,0);if(role==='doctor')await page.screenshot({path:artifacts+'/patient-edit-role-denied-en.png',animations:'disabled',fullPage:true});await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(errors, []);
  const audits = await owner.auditLog.findMany({ where: { workspaceId, entityId: original.id, action: 'PATIENT_UPDATED' } }); assert.ok(audits.length >= 3);
  assert.ok(!JSON.stringify(audits).includes('LITERAL-')); assert.ok(!JSON.stringify(audits).includes('Fictional Admin Address'));
  return { scope, legacyShortNameUnrelatedEdit:true, saveDoesNotRefetchEditRecord:true, server, screenshots, allSixForbidden403: true, anonymous401: true, foreign404: true, invalidDobGenderAndNull400: true, adminAndReceptionPatch: true, omittedAndNullPreserved: true, bilingualSaveCancelValidationAndFailures: true, unknownHeldAcrossReloadNoRetry: true,committedResponseLossVerified:true,proxy502Hold:true,actualAudit503RollbackConservativeHold:true,legacyShortPhoneUnrelatedEdit:true,spaReopenFreshExternalUpdate:true, noClinicalReads: true, dobGenderUnchanged: true, redactedAudits: audits.length };
}
