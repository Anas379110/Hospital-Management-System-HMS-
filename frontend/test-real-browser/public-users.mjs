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
 const patient=await prisma.patient.create({data:{mrn:'DEMO-0001',fullName:'Fictional Browser Patient',dateOfBirth:new Date('2000-01-01'),gender:'male',phone:'0000000000',createdBy:nurse.id}});
 const runtimePassword=randomBytes(24).toString('hex');await prisma.$executeRawUnsafe(`CREATE ROLE hms_runtime_users LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
 for(const sql of ['REVOKE CREATE ON SCHEMA public FROM PUBLIC','GRANT USAGE ON SCHEMA public TO hms_runtime_users','GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO hms_runtime_users','REVOKE ALL ON demo_workspaces FROM hms_runtime_users','GRANT SELECT ON demo_workspaces TO hms_runtime_users','REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs FROM hms_runtime_users','GRANT EXECUTE ON FUNCTION hms_create_demo_workspace(text),hms_touch_demo_workspace(text) TO hms_runtime_users'])await prisma.$executeRawUnsafe(sql);
 const runtimeUrl=new URL(url);runtimeUrl.username='hms_runtime_users';runtimeUrl.password=runtimePassword;runtimeUrl.searchParams.delete('options');process.env.DATABASE_URL=runtimeUrl.toString();process.env.HMS_PUBLIC_DEMO='true';
 const demoLogin=async(page,username,lang)=>{const actor=await prisma.user.findFirstOrThrow({where:{username}});const accessToken=await app.get(require(backend+'/node_modules/@nestjs/jwt').JwtService).signAsync({workspace:'00000000-0000-4000-a000-000000000001',kind:'fictional-demo',sub:actor.id},{expiresIn:'24h'});await page.evaluate(({accessToken,actor,lang})=>{localStorage.setItem('hms_token',accessToken);localStorage.setItem('hms_user',JSON.stringify({userId:actor.id,username:actor.username,role:actor.role}));localStorage.setItem('hms_demo','true');localStorage.setItem('hms_locale',lang)}, {accessToken,actor,lang});await page.goto('http://127.0.0.1:5197'+({pharmacist:'/pharmacy',lab_tech:'/lab',billing_clerk:'/billing'}[actor.role]||'/patients'));};
 app=await require(backend+'/dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const api=await app.getUrl();
 frontend=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5197','--strictPort'],{cwd:root+'/frontend',env:{...process.env,VITE_API_URL:api,VITE_PUBLIC_DEMO:'true'},stdio:'pipe'});
 frontend.stdout.on('data',data=>{viteOutput+=data.toString()});frontend.stderr.on('data',data=>{viteOutput+=data.toString()});
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(frontend.exitCode!==null)throw new Error('Vite exited before readiness; see vite-output.log');
  try{const response=await fetch('http://127.0.0.1:5197/login');if(response.ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error('Vite readiness timeout; see vite-output.log');
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.HMS_BROWSER_EXECUTABLE?{executablePath:process.env.HMS_BROWSER_EXECUTABLE}:{})});

 await prisma.user.create({data:{username:'fictional_admin',passwordHash:hash,fullName:'Fictional Admin',role:'admin'}});
 await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION hms_test_browser_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
 for(const lang of ['en','ar']) {
  const page=currentPage=await browser.newPage({timezoneId:'Europe/Istanbul',viewport:{width:lang==='ar'?390:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5197/login');await page.evaluate(lang=>localStorage.setItem('hms_locale',lang),lang);await page.reload();
  await demoLogin(page,'fictional_admin',lang);await page.goto('http://127.0.0.1:5197/users');
  const username='fictional_new_'+lang;const name='Fictional New '+lang;
  const fill=async()=>{await page.getByRole('textbox',{name:lang==='ar'?'اسم المستخدم':'Username',exact:true}).fill(username);await page.getByRole('textbox',{name:lang==='ar'?'الاسم الكامل':'Full name',exact:true}).fill(name);await page.getByLabel(lang==='ar'?'كلمة مرور للاختبار فقط':'Test-only password',{exact:true}).fill(password)};
  await page.getByRole('textbox',{name:lang==='ar'?'اسم المستخدم':'Username',exact:true}).focus();await page.keyboard.press('Tab');if(!await page.getByRole('textbox',{name:lang==='ar'?'الاسم الكامل':'Full name',exact:true}).evaluate(element=>element===document.activeElement))throw new Error('keyboard name focus');await page.keyboard.press('Tab');if(!await page.getByLabel(lang==='ar'?'كلمة مرور للاختبار فقط':'Test-only password',{exact:true}).evaluate(element=>element===document.activeElement))throw new Error('keyboard password focus');
  await fill();const before={users:await prisma.user.count(),audits:await prisma.auditLog.count()};
  const reject=()=>prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');const allow=()=>prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');
  const failure=()=>page.getByText(lang==='ar'?'لم تُنفذ العملية لتعذر حفظ سجلها. يمكنك إعادة المحاولة.':'Operation was not performed because its audit record could not be saved. You can retry.',{exact:true});
  await reject();await page.getByRole('button',{name:lang==='ar'?'إنشاء مستخدم تجريبي':'Create test user',exact:true}).click();await failure().waitFor();if(await prisma.user.count()!==before.users||await prisma.auditLog.count()!==before.audits)throw new Error('user audit failure mutated state');
  if(await page.getByLabel(lang==='ar'?'كلمة مرور للاختبار فقط':'Test-only password',{exact:true}).inputValue())throw new Error('password retained after failure');
  await allow();await fill();await page.getByRole('button',{name:lang==='ar'?'إنشاء مستخدم تجريبي':'Create test user',exact:true}).click();await page.getByText(lang==='ar'?'أُنشئ المستخدم التجريبي.':'Test user created.',{exact:true}).waitFor();
  const card=page.getByRole('region',{name:username,exact:true});await card.getByText(name,{exact:true}).waitFor();const created=await prisma.user.findFirstOrThrow({where:{username}});if(await prisma.user.count()!==before.users+1||await prisma.auditLog.count()!==before.audits+1)throw new Error('user retry count');
  const normalized=await page.evaluate(async ({password,lang})=>{const post=async body=>{const response=await fetch('/api/v1/users',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('hms_token'),'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}};return {saved:await post({username:'  normalized_'+lang+'  ',fullName:'  Fictional Trimmed  ',role:'nurse',password}),oversize:await post({username:'too_long_'+lang,fullName:'Too Long',role:'nurse',password:'x'.repeat(73)})}},{password,lang});
  const normalizedStored=await prisma.user.findFirstOrThrow({where:{username:'normalized_'+lang}});if(normalized.saved.status!==201||normalized.saved.body.username!=='normalized_'+lang||normalizedStored.username!=='normalized_'+lang||normalizedStored.fullName!=='Fictional Trimmed'||normalized.oversize.status!==400||await prisma.user.findFirst({where:{username:'too_long_'+lang}}))throw new Error('actual DTO transform/byte boundary');
  const multibyte=await page.evaluate(async lang=>{const statuses=[];for(const [suffix,password] of [['allowed','é'.repeat(36)],['rejected','é'.repeat(37)]]){const response=await fetch('/api/v1/users',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('hms_token'),'Content-Type':'application/json'},body:JSON.stringify({username:'bytes_'+suffix+'_'+lang,fullName:'Fictional Bytes',role:'nurse',password})});statuses.push(response.status)}return statuses},lang);if(multibyte[0]!==201||multibyte[1]!==400||!await prisma.user.findFirst({where:{username:'bytes_allowed_'+lang}})||await prisma.user.findFirst({where:{username:'bytes_rejected_'+lang}}))throw new Error('UTF8 byte count not enforced');
  const response=await page.evaluate(async search=>{const response=await fetch('/api/v1/users?search='+encodeURIComponent(search),{headers:{Authorization:'Bearer '+localStorage.getItem('hms_token')}});return {status:response.status,body:await response.json()}},username);
  if(response.status!==200||response.body.length!==1||Object.keys(response.body[0]).sort().join(',')!=='fullName,id,isActive,role,username')throw new Error('user search unsafe projection');
  const oldToken=await app.get(require(backend+'/node_modules/@nestjs/jwt').JwtService).signAsync({workspace:'00000000-0000-4000-a000-000000000001',kind:'fictional-demo',sub:created.id,username:created.username,role:created.role});
  await reject();const disable=card.getByRole('button',{name:lang==='ar'?'تعطيل الحساب':'Disable account',exact:true});await disable.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').getByText(username,{exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});if(!await disable.evaluate(element=>element===document.activeElement))throw new Error('dialog focus not restored');await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:lang==='ar'?'تأكيد التغيير':'Confirm change',exact:true}).focus();await page.keyboard.press('Enter');await failure().waitFor();if(!(await prisma.user.findUniqueOrThrow({where:{id:created.id}})).isActive)throw new Error('status failure mutated');
  const statusAudits=await prisma.auditLog.count();
  await allow();await card.getByRole('button',{name:lang==='ar'?'تعطيل الحساب':'Disable account',exact:true}).click();await page.getByRole('button',{name:lang==='ar'?'تأكيد التغيير':'Confirm change',exact:true}).click();await card.getByText(lang==='ar'?/معطل/:/Disabled/).waitFor();
  if((await prisma.user.findUniqueOrThrow({where:{id:created.id}})).isActive)throw new Error('status retry failed');
  if(await prisma.auditLog.count()!==statusAudits+1)throw new Error('status retry audit count');
  const disabledLogin=await fetch(api+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});if(disabledLogin.status!==401)throw new Error('disabled user logged in');
  const oldTokenRead=await fetch(api+'/api/v1/patients?search=fictional',{headers:{Authorization:'Bearer '+oldToken}});if(oldTokenRead.status!==401)throw new Error('old disabled token allowed');
  await page.screenshot({path:artifacts+'/users-disabled-'+lang+'.png',fullPage:true});
  await card.getByRole('button',{name:lang==='ar'?'تفعيل الحساب':'Enable account',exact:true}).click();await page.getByRole('button',{name:lang==='ar'?'تأكيد التغيير':'Confirm change',exact:true}).click();await card.getByRole('button',{name:lang==='ar'?'تعطيل الحساب':'Disable account',exact:true}).waitFor();
  const token=(await app.get(require(backend+'/node_modules/@nestjs/jwt').JwtService).signAsync({workspace:'00000000-0000-4000-a000-000000000001',kind:'fictional-demo',sub:created.id,username:created.username,role:created.role}));
  for(const method of ['GET','POST','PATCH']) {const res=await fetch(api+'/api/v1/users'+(method==='GET'?'?search=fictional':method==='PATCH'?'/'+created.id+'/status':''),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(method==='PATCH'?{isActive:false}:{username:'denied',fullName:'Denied',password,role:'doctor'})})});if(res.status!==403)throw new Error('nonadmin '+method+' not403')}
  const admin=await prisma.user.findFirstOrThrow({where:{username:'fictional_admin'}});const selfStatus=await page.evaluate(async id=>{const result=await fetch('/api/v1/users/'+id+'/status',{method:'PATCH',headers:{Authorization:'Bearer '+localStorage.getItem('hms_token'),'Content-Type':'application/json'},body:JSON.stringify({isActive:false})});return result.status},admin.id);if(selfStatus!==409)throw new Error('self disable allowed');
  const validation=await page.evaluate(async()=>{const statuses=[];for(const search of ['', 'x', '   ', 'x'.repeat(101)]){const response=await fetch('/api/v1/users?search='+search,{headers:{Authorization:'Bearer '+localStorage.getItem('hms_token')}});statuses.push(response.status)}return statuses});if(validation.some(status=>status!==400))throw new Error('search bounds not400');
  const anonymous=await fetch(api+'/api/v1/users?search=fictional');if(anonymous.status!==401)throw new Error('anonymous search allowed');
  for(const role of ['receptionist','doctor','nurse','manager','pharmacist','lab_tech','billing_clerk']){const actor=await prisma.user.create({data:{username:'denied_'+role+'_'+lang,fullName:'Fictional denied actor',role,passwordHash:'not-a-login'}});const deniedToken=await app.get(require(backend+'/node_modules/@nestjs/jwt').JwtService).signAsync({workspace:'00000000-0000-4000-a000-000000000001',kind:'fictional-demo',sub:actor.id,role,username:actor.username});const denied=await fetch(api+'/api/v1/users?search=fictional',{headers:{Authorization:'Bearer '+deniedToken}});if(denied.status!==403)throw new Error('search role allowed '+role)}
  await page.getByRole('textbox',{name:lang==='ar'?'البحث باسم المستخدم أو الاسم':'Find user by username or name',exact:true}).fill('fictional_admin');const selfCard=page.getByRole('region',{name:'fictional_admin',exact:true});await selfCard.waitFor();if(!await selfCard.getByRole('button',{name:lang==='ar'?'تعطيل الحساب':'Disable account',exact:true}).isDisabled())throw new Error('self disable enabled');
  if(errors.length||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('users runtime/overflow');results.checks.push({lang,createAuditFailureRollbackRetry:true,statusFailureRollbackRetry:true,disableEnable:true,safeBoundedSearch:true,nonAdmin403:true,selfDisable409:true,searchBounds400:true,searchSevenNonAdmin403:true,anonymous401:true,disabledLogin401:true,preDisableTokenRejected401:true,actualTransformStorage:true,exact73BytePassword400:true,multibyte72Accepted74Rejected:true,keyboardTabFocus:true,keyboardDialogOpenEscapeRestoreConfirm:true,runtimeErrors:0,overflow:false});await page.close();
 }
 results.assertionsPassed=true;console.log(JSON.stringify(results,null,2));
}catch(e){if(currentPage)await currentPage.screenshot({path:artifacts+'/users-unexpected-failure.png',fullPage:true}).catch(()=>{});results.error=String(e?.stack??e).replaceAll(password,'[REDACTED]');console.error(results.error);process.exitCode=1}
finally{writeFileSync(artifacts+'/users-results.json',JSON.stringify(results,null,2));if(browser)await browser.close();if(frontend)frontend.kill();if(app)await app.close();if(prisma)await prisma.$disconnect()}
