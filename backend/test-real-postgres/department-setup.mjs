// Approved manual setup, real local PostgreSQL/HTTP. No live DB.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {realpathSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '../../frontend/node_modules/playwright/index.mjs';
const artifacts=process.env.HMS_SETUP_ARTIFACTS??'/downloads';mkdirSync(artifacts,{recursive:true});
const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
const u=new URL(process.env.HMS_SETUP_DATABASE_URL??''),ci=process.env.HMS_SETUP_CI==='true';assert.equal(u.hostname,'127.0.0.1');assert.ok(u.port);
let data;
if(ci){assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(u.pathname,'/hms_test_setup');assert.equal(u.port,'5432');assert.equal(u.username,'hms_test');assert.equal(u.searchParams.has('options'),false);}
else{assert.match(u.pathname,/^\/hms_test_perf_[a-z0-9_]+$/);data=realpathSync(process.env.HMS_TEST_PG_DATA??'');assert.match(data,/^\/tmp\/hms_test_perf_[a-zA-Z0-9_]+$/);}
const owner=new PrismaClient({datasources:{db:{url:u.toString()}}});let app;const report={scope:'Disposable actual HTTP manual setup, fictional data only',mode:ci?'GitHub Actions dedicated empty database':'local cluster identity checked',complete:false,checks:[],scriptSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),startedAt:new Date().toISOString()};
try{
 const actualData=(await owner.$queryRawUnsafe('SHOW data_directory'))[0].data_directory;
 if(!ci)assert.equal(realpathSync(actualData),data);
 const password=randomBytes(24).toString('hex'),role='hms_runtime_setup';
 {
  // Dedicated empty disposable database only: CI requires its exact fresh database and runs its own migrations.
  assert.equal((await owner.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'")).length,0);
  const backend=fileURLToPath(new URL('../',import.meta.url));
  const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:backend,env:{...process.env,DATABASE_URL:u.toString()},encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);
  await owner.$executeRawUnsafe(`CREATE ROLE hms_runtime_setup LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
  for(const sql of ['REVOKE CREATE ON SCHEMA public FROM PUBLIC','GRANT USAGE ON SCHEMA public TO hms_runtime_setup','GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO hms_runtime_setup','REVOKE ALL ON demo_workspaces FROM hms_runtime_setup','GRANT SELECT ON demo_workspaces TO hms_runtime_setup','REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs FROM hms_runtime_setup','GRANT EXECUTE ON FUNCTION hms_create_demo_workspace(text),hms_touch_demo_workspace(text),hms_demo_cleanup_fresh() TO hms_runtime_setup','REVOKE ALL ON hms_cleanup_state FROM hms_runtime_setup'])await owner.$executeRawUnsafe(sql);
  await owner.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');
 }
 const runtime=new URL(u);runtime.username=role;runtime.password=password;runtime.searchParams.delete('options');
 const proof=new PrismaClient({datasources:{db:{url:runtime.toString()}}});
 try{const who=(await proof.$queryRawUnsafe('SELECT current_user AS role,session_user AS session'))[0];assert.equal(who.role,role);assert.equal(who.session,role);const flags=(await proof.$queryRawUnsafe('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'))[0];assert.equal(flags.rolsuper,false);assert.equal(flags.rolbypassrls,false);for(const sql of ['UPDATE audit_logs SET action=action','DELETE FROM audit_logs','TRUNCATE audit_logs']){let denied=false;try{await proof.$executeRawUnsafe(sql)}catch{denied=true}assert.ok(denied);}report.runtime={role,superuser:false,bypassRls:false,auditMutationsDenied:3};}finally{await proof.$disconnect();}
 process.env.DATABASE_URL=runtime.toString();process.env.JWT_SECRET=randomBytes(32).toString('hex');process.env.HMS_PUBLIC_DEMO='true';process.env.HMS_QUALIFICATION_MODE='false';process.env.HMS_RATE_LIMIT_IDENTITY='';
 app=await require('../dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1';
 const call=async(path,token,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const boot=await call('/demo/start',null,{});assert.equal(boot.status,201);const reception=boot.data.accessToken;
 const tokens={receptionist:reception};for(const role of ['admin','doctor','nurse','manager','pharmacist','lab_tech','billing_clerk']){const r=await call('/demo/role',reception,{role});assert.equal(r.status,201);tokens[role]=r.data.accessToken;}
 const admin=tokens.admin, deptBody={nameAr:'قسم تجريبي',nameEn:'Fictional Setup Department'};
 const makeDept=async()=>{const r=await call('/departments',admin,deptBody);assert.equal(r.status,201,JSON.stringify(r));return r.data;};
 const dept=await makeDept(),path='/departments/'+dept.id;
 const makeBed=async(label)=>{const r=await call(path+'/beds',admin,{bedNumber:label});assert.equal(r.status,201,JSON.stringify(r));return r.data;};
 const auditCount=async id=>(await owner.auditLog.count({where:{entityId:id}}));
 const endpoints=[['POST','/departments',deptBody],['PATCH',path,deptBody],['DELETE',path,null],['POST',path+'/beds',{bedNumber:'X'}],['PATCH',path+'/beds/00000000-0000-4000-a000-000000000099',{bedNumber:'X'}],['PATCH',path+'/beds/00000000-0000-4000-a000-000000000099/maintenance',{status:'maintenance'}],['DELETE',path+'/beds/00000000-0000-4000-a000-000000000099',null]];
 for(const[method,p,body]of endpoints){assert.equal((await call(p,null,body,method)).status,401);for(const role of Object.keys(tokens).filter(r=>r!=='admin'))assert.equal((await call(p,tokens[role],body,method)).status,403,role+' '+p);}
 for(const body of [{nameAr:null,nameEn:'x'},{nameAr:' ',nameEn:'x'},{nameAr:'x',nameEn:'x',extra:true},{}])assert.equal((await call('/departments',admin,body)).status,400);
 assert.equal((await call('/departments/not-a-uuid/beds',admin)).status,400);
 assert.equal((await call('/departments/not-a-uuid',admin,deptBody,'PATCH')).status,400);
 assert.equal((await call(path,admin,{...deptBody,nameEn:'Fictional Renamed'},'PATCH')).status,200);
 const bed=await makeBed('SETUP-1');assert.equal(await auditCount(bed.id),1);
 assert.equal((await call(path+'/beds',admin,{bedNumber:'SETUP-1'})).status,409);
 for(const status of ['occupied',null,'',4])assert.equal((await call(path+'/beds/'+bed.id+'/maintenance',admin,{status},'PATCH')).status,400);
 assert.equal((await call(path+'/beds/'+bed.id,admin,{bedNumber:'SETUP-RENAMED'},'PATCH')).status,200);
 assert.equal((await call(path+'/beds/'+bed.id+'/maintenance',admin,{status:'maintenance'},'PATCH')).status,200);
 assert.equal((await owner.bed.findUnique({where:{id:bed.id}})).status,'maintenance');
 const patient=(await call('/patients?search=Fictional',reception)).data[0];
 assert.equal((await call('/admissions',tokens.nurse,{patientId:patient.id,bedId:bed.id})).status,409);
 assert.equal((await call(path+'/beds/'+bed.id+'/maintenance',admin,{status:'available'},'PATCH')).status,200);
 const admission=await call('/admissions',tokens.nurse,{patientId:patient.id,bedId:bed.id});assert.equal(admission.status,201);
 assert.equal((await call(path+'/beds/'+bed.id+'/maintenance',admin,{status:'maintenance'},'PATCH')).status,409);
 assert.equal((await call(path+'/beds/'+bed.id,admin,null,'DELETE')).status,409);
 assert.equal((await call(path+'/beds/'+bed.id,admin,{bedNumber:'OCCUPIED-RELABEL'},'PATCH')).status,200);
 assert.equal((await owner.bed.findUnique({where:{id:bed.id}})).status,'occupied');
 assert.equal((await call('/admissions/'+admission.data.id+'/discharge',tokens.nurse,{})).status,201);
 assert.equal((await call(path+'/beds/'+bed.id,admin,null,'DELETE')).status,409);
 assert.equal((await call(path+'/beds/'+bed.id,admin,{bedNumber:'OCCUPIED-RELABEL'},'PATCH')).status,200);
 const other=await call('/demo/start',null,{}),otherAdmin=await call('/demo/role',other.data.accessToken,{role:'admin'});
 for(const [p,body,method]of [[path,deptBody,'PATCH'],[path,null,'DELETE'],[path+'/beds',{bedNumber:'x'},'POST'],[path+'/beds/'+bed.id+'/maintenance',{status:'maintenance'},'PATCH']])assert.equal((await call(p,otherAdmin.data.accessToken,body,method)).status,404);
 await owner.$executeRawUnsafe("CREATE FUNCTION hms_test_setup_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'BED_%' OR NEW.action LIKE 'DEPARTMENT_%' THEN RAISE EXCEPTION 'fictional setup audit failure'; END IF; RETURN NEW; END $$");await owner.$executeRawUnsafe('CREATE TRIGGER hms_test_setup_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_setup_audit_reject()');
 try{const n=await owner.bed.count({where:{departmentId:dept.id}}),cached=(await owner.department.findUnique({where:{id:dept.id}})).totalBeds;assert.equal((await call(path+'/beds',admin,{bedNumber:'ROLLBACK'})).status,503);assert.equal(await owner.bed.count({where:{departmentId:dept.id}}),n);assert.equal((await owner.department.findUnique({where:{id:dept.id}})).totalBeds,cached);}finally{await owner.$executeRawUnsafe('DROP TRIGGER hms_test_setup_audit_failure ON audit_logs');await owner.$executeRawUnsafe('DROP FUNCTION hms_test_setup_audit_reject()');}
 const parallel=await Promise.all([call(path+'/beds',admin,{bedNumber:'DUP-RACE'}),call(path+'/beds',admin,{bedNumber:'DUP-RACE'})]);assert.deepEqual(parallel.map(x=>x.status).sort(),[201,409]);
 const raceBed=await makeBed('RACE-MAINT');const race=await Promise.all([call(path+'/beds/'+raceBed.id+'/maintenance',admin,{status:'maintenance'},'PATCH'),call('/admissions',tokens.doctor,{patientId:patient.id,bedId:raceBed.id})]);assert.ok([[200,409],[409,201]].some(expected=>JSON.stringify(expected)===JSON.stringify(race.map(x=>x.status))),JSON.stringify(race));
 const deleteRaceBed=await makeBed('RACE-DELETE');const deleteRace=await Promise.all([call(path+'/beds/'+deleteRaceBed.id,admin,null,'DELETE'),call('/admissions',tokens.doctor,{patientId:patient.id,bedId:deleteRaceBed.id})]);assert.ok([[200,404],[200,409],[409,201]].some(expected=>JSON.stringify(expected)===JSON.stringify(deleteRace.map(x=>x.status))),JSON.stringify(deleteRace));
 const deleted=await owner.bed.findUnique({where:{id:deleteRaceBed.id}}),raceHistory=await owner.admission.count({where:{bedId:deleteRaceBed.id}});assert.ok(deleted||raceHistory===0);
 const actual=await owner.bed.count({where:{departmentId:dept.id}});assert.equal((await owner.department.findUnique({where:{id:dept.id}})).totalBeds,actual);
 const disposable=await makeBed('UNUSED');assert.equal((await call(path+'/beds/'+disposable.id,admin,null,'DELETE')).status,200);assert.equal(await owner.bed.findUnique({where:{id:disposable.id}}),null);assert.equal((await owner.auditLog.findFirst({where:{entityId:disposable.id,action:'BED_DELETED'}})).newValue.deleted,true);
 assert.equal((await call(path,admin,null,'DELETE')).status,409);
 const empty=await makeDept();assert.equal((await call('/departments/'+empty.id,admin,null,'DELETE')).status,200);
 const history=await makeDept(),options=(await call('/appointments/options',reception)).data;assert.equal((await call('/appointments',reception,{patientId:patient.id,doctorId:options.doctors[0].id,departmentId:history.id,scheduledAt:'2026-12-03T09:00:00Z'})).status,201);assert.equal((await call('/departments/'+history.id,admin,null,'DELETE')).status,409);
 const referenceDept=await makeDept();const referenceRace=await Promise.all([call('/departments/'+referenceDept.id,admin,null,'DELETE'),call('/appointments',reception,{patientId:patient.id,doctorId:options.doctors[0].id,departmentId:referenceDept.id,scheduledAt:'2026-12-03T10:00:00Z'})]);assert.ok([[200,404],[200,409],[409,201]].some(expected=>JSON.stringify(expected)===JSON.stringify(referenceRace.map(x=>x.status))),JSON.stringify(referenceRace));
 const audit=JSON.stringify(await owner.auditLog.findMany({where:{entityId:bed.id}}));assert.ok(!audit.includes('SETUP-RENAMED'));assert.ok(!audit.includes('SETUP-1'));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.HMS_BROWSER_EXECUTABLE??'/usr/bin/google-chrome'});
 try{for(const[lang,width]of[['en',1280],['ar',390]]){const page=await browser.newPage({viewport:{width,height:1000}});await page.goto(base.replace('/api/v1','')+'/login');await page.evaluate(({token,user,lang})=>{localStorage.setItem('hms_token',token);localStorage.setItem('hms_user',JSON.stringify({userId:user.id,username:user.username,role:'admin'}));localStorage.setItem('hms_demo','true');localStorage.setItem('hms_locale',lang);},{token:admin,user:boot.data.user,lang});await page.goto(base.replace('/api/v1','')+'/departments');await page.getByRole('button',{name:lang==='en'?'Create department':'إنشاء قسم',exact:true}).click();await page.getByLabel(lang==='en'?'Arabic department name':'اسم القسم بالعربية').fill('قسم من الواجهة');await page.getByLabel(lang==='en'?'English department name':'اسم القسم بالإنجليزية').fill('Fictional UI '+lang);await page.getByRole('button',{name:lang==='en'?'Confirm setup change':'تأكيد تغيير الإعداد'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[role=dialog] button.MuiButton-contained')?.disabled);await page.screenshot({path:artifacts+'/hms-setup-'+lang+'.png'});await page.getByRole('button',{name:lang==='en'?'Confirm setup change':'تأكيد تغيير الإعداد'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await owner.department.count({where:{nameEn:'Fictional UI '+lang}}),1);
 const select=page.getByRole('combobox').last();await select.click();await page.getByRole('option',{name:lang==='en'?'Fictional UI '+lang:'قسم من الواجهة',exact:true}).last().click();
 await page.getByRole('button',{name:lang==='en'?'Add bed':'إضافة سرير',exact:true}).click();await page.getByLabel(lang==='en'?'Bed label':'اسم السرير',{exact:true}).fill('UI-BED-'+lang);await page.getByRole('button',{name:lang==='en'?'Confirm setup change':'تأكيد تغيير الإعداد'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 const uiBed=await owner.bed.findFirst({where:{bedNumber:'UI-BED-'+lang}});assert.ok(uiBed);
 await page.getByRole('button',{name:lang==='en'?'Set maintenance':'وضع تحت الصيانة',exact:true}).click();await page.getByRole('button',{name:lang==='en'?'Confirm setup change':'تأكيد تغيير الإعداد'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await owner.bed.findUnique({where:{id:uiBed.id}})).status,'maintenance');
 await page.getByRole('button',{name:lang==='en'?'Delete unused bed':'حذف سرير غير مستخدم',exact:true}).click();await page.getByRole('button',{name:lang==='en'?'Cancel':'إلغاء',exact:true}).click();assert.ok(await owner.bed.findUnique({where:{id:uiBed.id}}));
 await page.screenshot({path:artifacts+'/hms-setup-beds-'+lang+'.png'});
 if(lang==='en'){
  await page.getByRole('button',{name:'Return to available',exact:true}).click();const current=await owner.bed.findUnique({where:{id:uiBed.id}});assert.equal(current.status,'maintenance');
  assert.equal((await call('/departments/'+uiBed.departmentId+'/beds/'+uiBed.id,admin,null,'DELETE')).status,200);
  await page.getByRole('button',{name:'Confirm setup change'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText(/This record changed, is occupied or has linked history/).waitFor();
  let posts=0;await page.route('**/api/v1/departments',async route=>{if(route.request().method()==='POST'){posts++;await route.abort();}else await route.continue();});
  await page.getByRole('button',{name:'Create department',exact:true}).click();assert.equal(await page.getByLabel('Arabic department name').inputValue(),'');assert.equal(await page.getByLabel('English department name').inputValue(),'');await page.getByLabel('Arabic department name').fill('قسم انقطاع وهمي');await page.getByLabel('English department name').fill('Fictional Unknown Write');await page.getByRole('button',{name:'Confirm setup change'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('The connection ended without a confirmed result. This write may have completed. Do not submit it again until you check the current records and audit log.',{exact:true}).waitFor();assert.equal(posts,1);assert.equal(await owner.department.count({where:{nameEn:'Fictional Unknown Write'}}),0);await page.unroute('**/api/v1/departments');
 let proxyPosts=0;await page.route('**/api/v1/departments',async route=>{if(route.request().method()==='POST'){proxyPosts++;await route.fulfill({status:502,contentType:'text/html',body:'<html>Temporary gateway failure</html>'});}else await route.continue();});
 await page.getByRole('button',{name:'Create department',exact:true}).click();await page.getByLabel('Arabic department name').fill('قسم بوابة وهمي');await page.getByLabel('English department name').fill('Fictional Proxy Write');await page.getByRole('button',{name:'Confirm setup change'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('The connection ended without a confirmed result. This write may have completed. Do not submit it again until you check the current records and audit log.',{exact:true}).waitFor();assert.equal(proxyPosts,1);await page.unroute('**/api/v1/departments');
 }
 await page.close();}}finally{await browser.close();}
 report.checks=['7setupendpoints401/all7forbiddenroles403','DTOmissing/null/extra/blank400, UUID400, crossworkspace404','Admincreate/rename/maintenance/unuseddelete with redactedatomic audit','Occupiedmaintenancedelete409, historicaladmissiondelete409, departmentappointmenthistory409','Actualauditfailure503rollbackbedandcachedcount','Concurrentduplicatelabel201+409, maintenance/admissionrace has onecommit','ActualcountmatchescachedtotalBeds; EN1280/AR390UIcreate+addbed+maintenance+deletecancel passed','Concurrentdelete/admission protects history','ActualUI404closesstaledialog/refetch, networkabortandproxy502unknownexactmessage/onlyonePOST','Occupiedrelabel200retainsoccupied; malformedbedGET400; createfieldsblank','Actualappointmentinsert/departmentdelete race safe404or409 not500'];report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1}
finally{report.finishedAt=new Date().toISOString();await app?.close();await owner.$disconnect();writeFileSync(process.env.HMS_SETUP_REPORT??'setup-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
