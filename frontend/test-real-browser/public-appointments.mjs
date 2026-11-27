import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const backend=root+'/backend';
const {PrismaClient}=require(backend+'/node_modules/@prisma/client');
const password=randomBytes(24).toString('hex');
const url=process.env.HMS_BROWSER_DATABASE_URL;
if(!url||!new URL(url).pathname.includes('hms_test'))throw new Error('Set HMS_BROWSER_DATABASE_URL to an isolated disposable hms_test database');
const artifacts=process.env.HMS_BROWSER_ARTIFACTS??root+'/frontend/browser-artifacts';mkdirSync(artifacts,{recursive:true});
let prisma,app,browser,frontend;
let currentPage;
let viteOutput='';const results={scope:'PUBLIC-DEMO restricted runtime with explicit signed fixture workspace; bootstrap/role UI separately covered; real browser to Vite proxy to actual Nest AppModule/Prisma/PostgreSQL, isolated fictional data',checks:[]};
try{
 process.env.DATABASE_URL=url;
 process.env.JWT_SECRET=randomBytes(32).toString('hex');
 const migration=spawnSync('node',['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:backend,env:process.env,encoding:'utf8'});if(migration.status!==0)throw new Error('migration failed');
 prisma=new PrismaClient();await prisma.$executeRawUnsafe("INSERT INTO demo_workspaces(id) VALUES('00000000-0000-4000-a000-000000000001')");const hash=await require(backend+'/node_modules/bcrypt').hash(password,4);
 await prisma.user.create({data:{username:'fictional_reception',passwordHash:hash,fullName:'Fictional Reception',role:'receptionist'}});
 const nurse=await prisma.user.create({data:{username:'fictional_fixture_doctor',passwordHash:hash,fullName:'Fictional Doctor',role:'doctor'}});
 const department=await prisma.department.create({data:{nameAr:'قسم تجريبي',nameEn:'Fictional Department',totalBeds:1}});
 const bed=await prisma.bed.create({data:{departmentId:department.id,bedNumber:'DEMO-01'}});
 const secondDepartment=await prisma.department.create({data:{nameAr:'قسم متابعة تجريبي',nameEn:'Fictional Follow-up Department',totalBeds:1}});
 const patient=await prisma.patient.create({data:{mrn:'DEMO-0001',fullName:'Fictional Browser Patient',dateOfBirth:new Date('2000-01-01'),gender:'male',phone:'0000000000',createdBy:nurse.id}});
 const runtimePassword=randomBytes(24).toString('hex');await prisma.$executeRawUnsafe(`CREATE ROLE hms_runtime_appointments LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
 for(const sql of ['GRANT USAGE ON SCHEMA public TO hms_runtime_appointments','GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO hms_runtime_appointments','REVOKE ALL ON demo_workspaces FROM hms_runtime_appointments','GRANT SELECT ON demo_workspaces TO hms_runtime_appointments','REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs FROM hms_runtime_appointments','GRANT EXECUTE ON FUNCTION hms_create_demo_workspace(text),hms_touch_demo_workspace(text) TO hms_runtime_appointments'])await prisma.$executeRawUnsafe(sql);
 const runtimeUrl=new URL(url);runtimeUrl.username='hms_runtime_appointments';runtimeUrl.password=runtimePassword;runtimeUrl.searchParams.delete('options');process.env.DATABASE_URL=runtimeUrl.toString();process.env.HMS_PUBLIC_DEMO='true';
 const demoLogin=async(page,username,lang)=>{const actor=await prisma.user.findFirstOrThrow({where:{username}});const accessToken=await app.get(require(backend+'/node_modules/@nestjs/jwt').JwtService).signAsync({workspace:'00000000-0000-4000-a000-000000000001',kind:'fictional-demo',sub:actor.id},{expiresIn:'24h'});await page.evaluate(({accessToken,actor,lang})=>{localStorage.setItem('hms_token',accessToken);localStorage.setItem('hms_user',JSON.stringify({userId:actor.id,username:actor.username,role:actor.role}));localStorage.setItem('hms_demo','true');localStorage.setItem('hms_locale',lang)}, {accessToken,actor,lang});await page.goto('http://127.0.0.1:5195'+({pharmacist:'/pharmacy',lab_tech:'/lab',billing_clerk:'/billing'}[actor.role]||'/patients'));};
 app=await require(backend+'/dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const api=await app.getUrl();
 frontend=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5195','--strictPort'],{cwd:root+'/frontend',env:{...process.env,VITE_API_URL:api,VITE_PUBLIC_DEMO:'true'},stdio:'pipe'});
 frontend.stdout.on('data',data=>{viteOutput+=data.toString()});frontend.stderr.on('data',data=>{viteOutput+=data.toString()});
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(frontend.exitCode!==null)throw new Error('Vite exited before readiness; see vite-output.log');
  try{const response=await fetch('http://127.0.0.1:5195/login');if(response.ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error('Vite readiness timeout; see vite-output.log');
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.HMS_BROWSER_EXECUTABLE?{executablePath:process.env.HMS_BROWSER_EXECUTABLE}:{})});

 await prisma.user.create({data:{username:'fictional_doctor',passwordHash:hash,fullName:'Fictional Read Doctor',role:'doctor'}});
 await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION hms_test_browser_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
 for(const lang of ['en','ar']){
  const page=currentPage=await browser.newPage({timezoneId:'Europe/Istanbul',viewport:{width:lang==='ar'?390:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=async username=>{
   await page.goto('http://127.0.0.1:5195/login');await page.evaluate(lang=>{localStorage.clear();localStorage.setItem('hms_locale',lang)},lang);await page.reload();
   await demoLogin(page,username,lang);
   await page.goto('http://127.0.0.1:5195/appointments');
  };
  await login('fictional_reception');
  await page.getByRole('button',{name:lang==='ar'?'حجز موعد':'Book appointment',exact:true}).click();
  const fill=async (ar,en,value)=>page.getByRole('textbox',{name:lang==='ar'?ar:en,exact:true}).fill(value);
  await page.getByRole('combobox',{name:lang==='ar'?'المريض':'Patient',exact:true}).fill('Fictional Browser');await page.getByRole('option',{name:/Fictional Browser Patient/}).click();
  await page.getByRole('combobox',{name:lang==='ar'?'الطبيب':'Doctor',exact:true}).click();await page.getByRole('option',{name:'Fictional Doctor',exact:true}).click();
  await page.getByRole('combobox',{name:lang==='ar'?/^القسم/:/^Department/}).click();await page.getByRole('option',{name:lang==='ar'?'قسم تجريبي':'Fictional Department',exact:true}).click();
  const day='2026-12-26';await page.locator('input[type=date]').fill(day);const clock=lang==='ar'?'15:00':'14:00';await page.locator('input[type=datetime-local]').fill(day+'T'+clock);
  const before={appointments:await prisma.appointment.count(),audits:await prisma.auditLog.count()};
  await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const book=()=>page.getByRole('button',{name:lang==='ar'?'حجز':'Book',exact:true});
  const failure=()=>page.getByText(lang==='ar'?'لم تُنفذ العملية لتعذر حفظ سجلها. يمكنك إعادة المحاولة.':'Operation was not performed because its audit record could not be saved. You can retry.',{exact:true});
  await book().click();await failure().waitFor();
  if(await prisma.appointment.count()!==before.appointments||await prisma.auditLog.count()!==before.audits||!(await page.getByRole('combobox',{name:lang==='ar'?'المريض':'Patient',exact:true}).inputValue()).includes('DEMO-0001'))throw new Error('appointment failure state/input mismatch');
  await page.waitForTimeout(250);await page.screenshot({path:artifacts+'/appointment-create-failure-'+lang+'.png',fullPage:true});
  await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await book().click();await page.getByRole('dialog').waitFor({state:'hidden'});
  if(await prisma.appointment.count()!==before.appointments+1||await prisma.auditLog.count()!==before.audits+1)throw new Error('appointment retry audit/count mismatch');
  await page.waitForTimeout(200);await page.screenshot({path:artifacts+'/appointment-schedule-'+lang+'.png',fullPage:true});
  await page.getByRole('button',{name:lang==='ar'?'تعديل الموعد':'Edit appointment',exact:true}).last().click();
  const editBefore=await prisma.appointment.findFirstOrThrow({where:{patientId:patient.id,status:'scheduled'},orderBy:{createdAt:'desc'}});
  const editAudits=await prisma.auditLog.count();
  await page.getByRole('combobox',{name:lang==='ar'?/^القسم/:/^Department/}).click();await page.getByRole('option',{name:lang==='ar'?'قسم متابعة تجريبي':'Fictional Follow-up Department',exact:true}).click();
  await page.locator('input[type=datetime-local]').fill(day+'T'+(lang==='ar'?'17:00':'16:00'));
  await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const saveEdit=()=>page.getByRole('button',{name:lang==='ar'?'حفظ التعديل':'Save changes',exact:true});
  await saveEdit().click();await failure().waitFor();
  if((await prisma.appointment.findUniqueOrThrow({where:{id:editBefore.id}})).scheduledAt.getTime()!==editBefore.scheduledAt.getTime()||(await prisma.appointment.findUniqueOrThrow({where:{id:editBefore.id}})).departmentId!==department.id||await prisma.auditLog.count()!==editAudits)throw new Error('appointment edit failure mutated state');
  await page.screenshot({path:artifacts+'/appointment-edit-failure-'+lang+'.png',fullPage:true});
  await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await saveEdit().click();await page.getByRole('dialog').waitFor({state:'hidden'});
  if((await prisma.appointment.findUniqueOrThrow({where:{id:editBefore.id}})).scheduledAt.getTime()===editBefore.scheduledAt.getTime()||(await prisma.appointment.findUniqueOrThrow({where:{id:editBefore.id}})).departmentId!==secondDepartment.id||await prisma.auditLog.count()!==editAudits+1)throw new Error('appointment edit retry failed');
  const cancel=page.getByRole('button',{name:lang==='ar'?'إلغاء الموعد':'Cancel appointment',exact:true});await cancel.last().click();
  await fill('السبب، اختياري','Reason, optional','Fictional cancellation');
  const target=await prisma.appointment.findFirstOrThrow({where:{patientId:patient.id,status:'scheduled'},orderBy:{createdAt:'desc'}});
  const cancelAudits=await prisma.auditLog.count();await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const confirm=()=>page.getByRole('button',{name:lang==='ar'?'تأكيد الإلغاء':'Confirm cancellation',exact:true});
  await confirm().click();await failure().waitFor();if((await prisma.appointment.findUniqueOrThrow({where:{id:target.id}})).status!=='scheduled'||await prisma.auditLog.count()!==cancelAudits)throw new Error('cancel failure changed state');
  await page.waitForTimeout(250);await page.screenshot({path:artifacts+'/appointment-cancel-failure-'+lang+'.png',fullPage:true});
  await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await confirm().click();await page.getByRole('dialog').waitFor({state:'hidden'});
  if((await prisma.appointment.findUniqueOrThrow({where:{id:target.id}})).status!=='cancelled'||await prisma.auditLog.count()!==cancelAudits+1)throw new Error('cancel retry mismatch');
  const pagingDay=lang==='ar'?'2026-12-29':'2026-12-28';
  await prisma.appointment.createMany({data:Array.from({length:100},(_,index)=>({patientId:patient.id,doctorId:nurse.id,departmentId:department.id,scheduledAt:new Date(pagingDay+'T12:'+String(Math.floor(index/60)).padStart(2,'0')+':'+String(index%60).padStart(2,'0')+'Z')}))});
  await page.locator('input[type=date]').fill(pagingDay);
  const next=page.getByRole('button',{name:lang==='ar'?'التالي':'Next',exact:true});await next.waitFor();await page.waitForTimeout(300);if(await next.isDisabled())throw new Error('exact full page next incorrectly disabled');
  await next.click();await page.getByText(lang==='ar'?'لا توجد مواعيد في هذه الصفحة. غيّر اليوم أو عُد للصفحة السابقة.':'No appointments on this page. Change the day or return to the previous page.',{exact:true}).waitFor();
  if(!await next.isDisabled())throw new Error('empty final page next enabled');
  await page.getByRole('button',{name:lang==='ar'?'السابق':'Previous',exact:true}).click();await page.getByText('DEMO-0001',{exact:true}).first().waitFor();
  await login('fictional_doctor');if(await page.getByRole('button',{name:lang==='ar'?'حجز موعد':'Book appointment',exact:true}).count()||await page.getByRole('button',{name:lang==='ar'?'إلغاء الموعد':'Cancel appointment',exact:true}).count())throw new Error('doctor write controls visible');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(errors.length||overflow)throw new Error('appointment runtime/overflow');
  results.checks.push({lang,editAuditFailureRollback:true,editRetry:true,departmentEditRollbackAndRetry:true,timezoneId:'Europe/Istanbul',fixedFixtureDay:day,exactFullThenEmptyPageNavigation:true,createAuditFailureRollback:true,createRetry:true,cancelAuditFailureRollback:true,cancelRetry:true,doctorWriteControlsHidden:true,runtimeErrors:errors.length,overflow});await page.close();
 }
 results.assertionsPassed=true;console.log(JSON.stringify(results,null,2));
}catch(e){if(currentPage)await currentPage.screenshot({path:artifacts+'/unexpected-failure.png',fullPage:true}).catch(()=>{});results.error=String(e?.stack??e).replaceAll(password,'[REDACTED]');console.error(results.error);process.exitCode=1}
finally{writeFileSync(artifacts+'/appointment-vite-output.log',viteOutput.replaceAll(password,'[REDACTED]'));writeFileSync(artifacts+'/appointment-results.json',JSON.stringify(results,null,2));if(browser)await browser.close();if(frontend)frontend.kill();if(app)await app.close();if(prisma)await prisma.$disconnect()}
