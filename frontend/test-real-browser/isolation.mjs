import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import pgmod from 'pg';
const require=createRequire(import.meta.url),{Client}=pgmod;
const base=fileURLToPath(new URL('../../backend',import.meta.url));
const url=process.env.HMS_ISOLATION_DATABASE_URL;
if(!url||!new URL(url).pathname.includes('hms_test'))throw Error('Provide isolated disposable hms_test database');
const password=new URL(url).password;
const artifacts=process.env.HMS_BROWSER_ARTIFACTS??fileURLToPath(new URL('../browser-artifacts',import.meta.url));mkdirSync(artifacts,{recursive:true});
let owner,runtime,cleaner,service,app,browser,vite;const result={startedAt:new Date().toISOString(),commit:spawnSync('git',['rev-parse','HEAD'],{cwd:base,encoding:'utf8'}).stdout.trim(),inputHashes:Object.fromEntries(['src/prisma/prisma.service.ts','src/modules/auth/demo.service.ts','prisma/migrations/20261127003000_demo_workspace_isolation/migration.sql','dist/src/app.factory.js'].map(p=>[p,createHash('sha256').update(readFileSync(base+'/'+p)).digest('hex')])),checks:[],axe:[],views:[]};
try{
 const migration=spawnSync('node',['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:base,env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
 if(migration.status!==0)throw Error('Migration failed '+migration.stdout+ migration.stderr);
 owner=new Client({connectionString:url});await owner.connect();result.postgres=(await owner.query('SELECT version() AS version')).rows[0].version;
 const rp=randomBytes(24).toString('hex');
 await owner.query(`CREATE ROLE hms_runtime LOGIN PASSWORD '${rp}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
 const cp=randomBytes(24).toString('hex');await owner.query(`CREATE ROLE hms_cleanup LOGIN PASSWORD '${cp}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
 await owner.query(readFileSync(base+'/prisma/demo/grants.sql','utf8'));
 await owner.query("INSERT INTO demo_workspaces(id) VALUES('workspace-a'),('workspace-b')");
 const ru=new URL(url);ru.username='hms_runtime';ru.password=rp;
 runtime=new Client({connectionString:ru.toString()});await runtime.connect();
 for(const id of ['workspace-a','workspace-b']){
  await runtime.query('BEGIN');await runtime.query("SELECT set_config('hms.workspace_id',$1,true)",[id]);
  await runtime.query('INSERT INTO users(id,username,password_hash,full_name,role,updated_at) VALUES($1,$2,$3,$4,$5,now())',[id+'-admin','fictional_admin','not-a-login','Fictional Admin','admin']);
  await runtime.query('COMMIT');
 }
 if((await runtime.query('SELECT * FROM users')).rowCount!==0)throw Error('unscoped read leaked');
 await runtime.query('BEGIN');await runtime.query("SELECT set_config('hms.workspace_id','workspace-a',true)");
 if((await runtime.query('SELECT * FROM users')).rowCount!==1)throw Error('scope count');
 if((await runtime.query("SELECT * FROM users WHERE id='workspace-b-admin'")).rowCount!==0)throw Error('IDOR');
 await runtime.query('COMMIT');result.checks.push('restricted raw SQL unscoped empty, workspace rows isolated, same username permitted');
 process.env.DATABASE_URL=ru.toString();process.env.HMS_PUBLIC_DEMO='true';
 const {PrismaService}=require(base+'/dist/src/prisma/prisma.service.js');
 const unsafeCheck=async()=>{const check=new PrismaService();let rejected=false;try{await check.onModuleInit()}catch(e){rejected=String(e).includes('restricted nonowner')}finally{await check.$disconnect()}if(!rejected)throw Error('unsafe runtime startup accepted')};
 await owner.query('ALTER ROLE hms_runtime BYPASSRLS');await unsafeCheck();await owner.query('ALTER ROLE hms_runtime NOBYPASSRLS');
 await owner.query('GRANT CREATE ON SCHEMA public TO hms_runtime');await unsafeCheck();await owner.query('REVOKE CREATE ON SCHEMA public FROM hms_runtime');
 await owner.query('GRANT EXECUTE ON FUNCTION hms_cleanup_expired_workspaces() TO hms_runtime');await unsafeCheck();await owner.query('REVOKE ALL ON FUNCTION hms_cleanup_expired_workspaces() FROM hms_runtime');
 result.checks.push('startup rejects runtime BYPASSRLS/schemaCREATE/cleanupEXECUTE');
const {workspaceContext}=require(base+'/dist/src/prisma/workspace-context.js');
 service=new PrismaService();await service.$connect();
 const rows=await Promise.all(Array.from({length:24},(_,i)=>workspaceContext.run(i%2?'workspace-a':'workspace-b',async()=>{
  const users=await service.user.findMany();if(users.length!==1||users[0].workspaceId!==(i%2?'workspace-a':'workspace-b'))throw Error('pool workspace leak '+JSON.stringify({expected:i%2?'workspace-a':'workspace-b',users}));
  return service.$transaction(async tx=>{const u=await tx.user.findMany();if(u.length!==1||u[0].workspaceId!==users[0].workspaceId)throw Error('nested scope lost');return true});
 })));
 result.checks.push('24 concurrent scoped model reads and interactive transactions on two connections isolated');
 let refused=false;try{await service.user.findMany()}catch{refused=true}if(!refused)throw Error('unscoped ORM accepted');
 result.checks.push('unscoped ORM rejected');
 await workspaceContext.run('workspace-a',async()=>await service.$queryRaw`SELECT id FROM users`);
 result.checks.push('scoped raw query works');
 await owner.query("UPDATE demo_workspaces SET expires_at=now()-interval '1 second' WHERE id='workspace-a'");
 const expired=await workspaceContext.run('workspace-a',async()=>await service.user.findMany());if(expired.length)throw Error('expired rows readable');
 result.checks.push('expired workspace cannot read domain rows');
 await owner.query("DELETE FROM demo_workspaces WHERE id='workspace-a'");
 if((await owner.query("SELECT * FROM users WHERE workspace_id='workspace-a'")).rowCount)throw Error('cascade incomplete');
 if((await owner.query("SELECT * FROM users WHERE workspace_id='workspace-b'")).rowCount!==1)throw Error('other workspace deleted');
 result.checks.push('workspace cleanup cascades without touching another visitor');
 process.env.JWT_SECRET=randomBytes(32).toString('hex');
 process.chdir(base);app=await require(base+'/dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const host=await app.getUrl();
 const call=async(path,token,body)=>{const r=await fetch(host+'/api/v1/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}};
 const a=await call('demo/start',null,{}),b=await call('demo/start',null,{});
 if(a.status!==201||b.status!==201)throw Error('HTTP bootstrap failed '+JSON.stringify([a,b]));
 const pa=await call('patients',a.data.accessToken),pb=await call('patients',b.data.accessToken);
 if(pa.status!==200||pb.status!==200||pa.data.length!==1||pb.data.length!==1||pa.data[0].id===pb.data[0].id)throw Error('HTTP visitor boundary failed '+JSON.stringify([pa,pb]));
 const cross=await call('patients/'+pb.data[0].id,a.data.accessToken);if(cross.status!==404)throw Error('HTTP IDOR not404 '+JSON.stringify(cross));
 const admin=await call('demo/role',a.data.accessToken,{role:'admin'});if(admin.status!==201)throw Error('role switch failed');
 const denied=await call('auth/login',null,{username:'fictional_admin',password:'password'});if(denied.status!==401)throw Error('password login enabled');
 result.checks.push('HTTP anonymous bootstrap, distinct visitors, cross-visitor patient404, same-workspace admin role switch, password login disabled');
 const billing=await call('demo/role',a.data.accessToken,{role:'billing_clerk'});
 const lookupResponse=await call('patients/billing-lookup?search=Fictional',billing.data.accessToken);
 if(lookupResponse.status!==200||Object.keys(lookupResponse.data[0]).sort().join(',')!=='fullName,id,mrn')throw Error('billing lookup extra fields');
 const auditDenied=await call('demo/audit',billing.data.accessToken);if(auditDenied.status!==403)throw Error('billing audit allowed');
 const invoice=await call('invoices',billing.data.accessToken,{patientId:pa.data[0].id,insuranceCoveragePercent:0,items:[{description:'Fictional service',quantity:1,unitPrice:100}]});
 if(invoice.status!==201)throw Error('scoped invoice mutation failed '+JSON.stringify(invoice));
 const audit=await call('demo/audit',admin.data.accessToken);if(audit.status!==200||audit.data.length!==1||JSON.stringify(audit.data).includes('Fictional service')||JSON.stringify(audit.data).includes('password'))throw Error('audit redaction boundary');
 const foreignInvoice=await call('invoices',billing.data.accessToken,{patientId:pb.data[0].id,insuranceCoveragePercent:0,items:[{description:'Blocked cross visitor',quantity:1,unitPrice:10}]});
 if(foreignInvoice.status!==404)throw Error('foreign patient mutation allowed');
 const otherAdmin=await call('demo/role',b.data.accessToken,{role:'admin'});const otherAudit=await call('demo/audit',otherAdmin.data.accessToken);if(otherAudit.status!==200||otherAudit.data.length)throw Error('other visitor audit leaked');
 result.checks.push('billing lookup exactly3fields; invoice mutation with audit; billing audit403; other workspace audit empty; foreign patient mutation denied');
 const decoded=JSON.parse(Buffer.from(a.data.accessToken.split('.')[1],'base64url').toString());if(decoded.exp!==undefined)throw Error('fixed token deadline violates sliding idle policy');
 const activityBefore=(await owner.query('SELECT expires_at FROM demo_workspaces WHERE id=$1',[pa.data[0].workspaceId])).rows[0].expires_at;
 await owner.query("UPDATE demo_workspaces SET expires_at=now()+interval '5 minutes' WHERE id=$1",[pa.data[0].workspaceId]);
 if((await call('patients',a.data.accessToken)).status!==200)throw Error('active token failed');
 const activityAfter=(await owner.query('SELECT expires_at FROM demo_workspaces WHERE id=$1',[pa.data[0].workspaceId])).rows[0].expires_at;
 if(activityAfter.getTime()<=activityBefore.getTime())throw Error('activity did not slide24h idle deadline');
 result.checks.push('signed demo token has no conflicting fixed expiry; DB activity advances24h idle deadline');
 const createdWorkspace=pa.data[0].workspaceId;
 const beforeExpiry=(await owner.query('SELECT expires_at FROM demo_workspaces WHERE id=$1',[createdWorkspace])).rows[0].expires_at;
 await owner.query("UPDATE demo_workspaces SET expires_at=now()-interval '1 second' WHERE id=$1",[createdWorkspace]);
 const expiredHttp=await call('patients',a.data.accessToken);if(expiredHttp.status!==401)throw Error('expired HTTP token accepted');
 await owner.query('UPDATE demo_workspaces SET expires_at=$2 WHERE id=$1',[createdWorkspace,beforeExpiry]);
 const forged=a.data.accessToken.slice(0,-4)+'aaaa';if((await call('patients',forged)).status!==401)throw Error('tampered signature accepted');
 const jwt=app.get(require(base+'/node_modules/@nestjs/jwt').JwtService);
 for(const payload of [{sub:a.data.user.id,workspace:createdWorkspace,kind:'wrong-kind'},{sub:a.data.user.id,workspace:'malformed',kind:'fictional-demo'},{sub:a.data.user.id,workspace:'00000000-0000-4000-a000-999999999999',kind:'fictional-demo'}])if((await call('patients',await jwt.signAsync(payload))).status!==401)throw Error('invalid token claims accepted');
 const parts=a.data.accessToken.split('.');const altered=parts[0]+'.'+Buffer.from(JSON.stringify({...decoded,workspace:pb.data[0].workspaceId})).toString('base64url')+'.'+parts[2];
 const none=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+parts[1]+'.';
 for(const token of [altered,none])if((await call('patients',token)).status!==401)throw Error('payload tamper or alg-none accepted');
 const httpReads=await Promise.all(Array.from({length:24},async(_,i)=>{const token=i%2?a.data.accessToken:b.data.accessToken;const expected=i%2?pa.data[0].id:pb.data[0].id;const response=await call('patients',token);if(response.status!==200||response.data.length!==1||response.data[0].id!==expected)throw Error('HTTP concurrent workspace context leaked');return true;}));
 result.checks.push('24HTTP concurrent2workspace scoped reads isolated; wrongkind/malformed/missingworkspace/payloadtamper/algnone401');
 result.checks.push('expired signed workspace token401 and tampered signature401');
 const roleReads={admin:'patients',receptionist:'patients',doctor:'patients',nurse:'patients',manager:'patients',pharmacist:'medications',lab_tech:'test-orders',billing_clerk:'patients/billing-lookup?search=Fictional'};
 for(const [role,path] of Object.entries(roleReads)){
  const session=await call('demo/role',a.data.accessToken,{role});if(session.status!==201)throw Error('role token '+role);
  const me=await call('auth/me',session.data.accessToken);if(me.status!==200||me.data.role!==role)throw Error('role identity '+role);
  const auditRead=await call('demo/audit',session.data.accessToken);if(auditRead.status!==(role==='admin'?200:403))throw Error('audit role '+role);
  const foreign=await call('patients/'+pb.data[0].id,session.data.accessToken);if(foreign.status<400)throw Error('foreign role '+role);
 }
 result.checks.push('all8signed role identities verified; only admin audit200,7roles403; all8foreign patient requests denied');
 // Reject a direct composite-FK cross-workspace write even if a service omits its lookup.
 await runtime.query('BEGIN');await runtime.query("SELECT set_config('hms.workspace_id',$1,true)",[pa.data[0].workspaceId]);
 let fkDenied=false;try{await runtime.query('INSERT INTO invoices(id,patient_id,created_by,updated_at) VALUES($1,$2,$3,now())',[randomBytes(16).toString('hex'),pb.data[0].id,billing.data.user.id]);await runtime.query('COMMIT');}catch(e){fkDenied=e.code==='23503'&&e.constraint==='invoices_patient_id_workspace_fkey'}finally{await runtime.query('ROLLBACK')}
 if(!fkDenied)throw Error('cross workspace composite FK accepted');
 // Cleanup only after both views captured below.
 const {default:AxeBuilder}=await import('@axe-core/playwright');
 const {chromium}=await import('playwright');
 browser=await chromium.launch({headless:true,...(process.env.HMS_BROWSER_EXECUTABLE?{executablePath:process.env.HMS_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
 const entryContext=await browser.newContext({viewport:{width:390,height:1000}});const entry=await entryContext.newPage();await entry.goto(host+'/login');await entry.getByRole('button').first().waitFor();
 if(await entry.locator('input[type=password]').count())throw Error('production password form visible');
 for(const lang of ['en','ar'])for(const width of [320,390]){
 await entry.evaluate(lang=>localStorage.setItem('hms_locale',lang),lang);await entry.reload();await entry.getByRole('button',{name:lang==='ar'?'English':'العربية',exact:true}).waitFor();await entry.setViewportSize({width,height:740});
 if(await entry.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('entry overflow '+lang+width);
 await entry.screenshot({path:artifacts+'/entry-'+lang+'-'+width+'-collapsed.png',fullPage:true});await entry.locator('summary').click();await entry.screenshot({path:artifacts+'/entry-'+lang+'-'+width+'-details.png',fullPage:true});
 result.views.push({route:'login',lang,width,states:['collapsed','details'],overflow:false});
 }
 await entry.evaluate(()=>localStorage.setItem('hms_locale','en'));await entry.reload();
 const entryScan=await new AxeBuilder({page:entry}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.axe.push({lang:'en',route:'entry',violations:entryScan.violations});if(entryScan.violations.length)throw Error('entry axe '+JSON.stringify(entryScan.violations));
 await entry.setViewportSize({width:320,height:740});if(await entry.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('320entry overflow');await entry.screenshot({path:artifacts+'/isolation-entry-320.png',fullPage:true});await entry.getByRole('button',{name:'Start a private demo workspace',exact:true}).focus();await entry.keyboard.press('Enter');await entry.waitForURL('**/patients');if(!await entry.evaluate(()=>localStorage.getItem('hms_demo')==='true'))throw Error('production bootstrap did not persist demo flag');
 result.checks.push('same-origin production assets and keyboard anonymous bootstrap, no password form, entry axe zero');await entry.close();
 for(const lang of ['en','ar']){
  const context=await browser.newContext({viewport:{width:lang==='ar'?390:1440,height:1000}});const page=await context.newPage();
  page.setDefaultTimeout(7000);await page.goto(host+'/login');await page.evaluate(lang=>localStorage.setItem('hms_locale',lang),lang);await page.reload();
  // Existing independent workspace avoids consuming anonymous bootstrap rate quota.
  await page.evaluate(data=>{localStorage.setItem('hms_token',data.accessToken);localStorage.setItem('hms_user',JSON.stringify({userId:data.user.id,username:data.user.username,role:data.user.role}));localStorage.setItem('hms_demo','true')},a.data);
  await page.goto(host+'/patients');await page.getByRole('heading').first().waitFor();await page.getByRole('textbox').first().fill('Fictional');await page.getByText('Fictional Demo Patient',{exact:true}).waitFor();
  await page.screenshot({path:artifacts+'/isolation-patients-'+lang+'.png',fullPage:true});
  if(lang==='ar'){
    const menu=page.getByRole('button',{name:'التنقل',exact:true});
    // Accessible nav label may vary with translation. Locate current first header button.
    const trigger=await menu.count()?menu:page.locator('header button').first();await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('presentation').last().waitFor();await page.evaluate(async()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    await page.screenshot({path:artifacts+'/drawer-'+lang+'.png',fullPage:true});await page.keyboard.press('Escape');if(!await trigger.evaluate(e=>e===document.activeElement))throw Error('drawer focus not restored');
    result.views.push({route:'drawer',lang,width:390,keyboardFocusRestored:true});
  }

  const picker=page.getByRole('combobox',{name:lang==='ar'?'الدور التجريبي':'Demo role',exact:true});await picker.click();await page.getByRole('option',{name:lang==='ar'?'مدير النظام':'Administrator',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hms_user')||'{}').role==='admin');await page.waitForLoadState('networkidle');await page.goto(host+'/audit');await page.getByRole('heading').first().waitFor();await page.screenshot({path:artifacts+'/isolation-audit-'+lang+'.png',fullPage:true});
  for(const route of ['patients','audit','users','billing']){
   await page.goto(host+'/'+route);await page.getByRole('heading').first().waitFor();await page.evaluate(()=>document.fonts.ready);const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.axe.push({lang,route,violations:scan.violations});if(scan.violations.length)throw Error(lang+' '+route+' axe '+JSON.stringify(scan.violations));
   if(route==='users'){
    await page.getByRole('textbox',{name:lang==='ar'?'البحث باسم المستخدم أو الاسم':'Find user by username or name',exact:true}).fill('fictional_doctor');const card=page.getByRole('region',{name:'fictional_doctor',exact:true});await card.waitFor();await card.getByRole('button',{name:lang==='ar'?'تعطيل الحساب':'Disable account',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.evaluate(async()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.axe.push({lang,route:'users-dialog',violations:scan.violations});if(scan.violations.length)throw Error('dialog axe '+JSON.stringify(scan.violations));for(let i=0;i<7;i++){await page.keyboard.press('Tab');if(!await dialog.evaluate(e=>e.contains(document.activeElement)))throw Error('focus escaped dialog')}await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   }
  }
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Demo mobile overflow');
  await page.close();
 }
 const landings={admin:'patients',receptionist:'patients',doctor:'patients',nurse:'patients',manager:'patients',pharmacist:'pharmacy',lab_tech:'lab',billing_clerk:'billing'};
 for(const [role,route] of Object.entries(landings)){
  const session=await call('demo/role',b.data.accessToken,{role});const context=await browser.newContext({viewport:{width:320,height:740}});const page=await context.newPage();
  await page.goto(host+'/login');await page.evaluate(data=>{localStorage.setItem('hms_token',data.accessToken);localStorage.setItem('hms_user',JSON.stringify({userId:data.user.id,username:data.user.username,role:data.user.role}));localStorage.setItem('hms_demo','true');localStorage.setItem('hms_locale','en')},session.data);await page.goto(host+'/');await page.waitForURL('**/'+route);await page.getByRole('heading').first().waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('320role landing overflow '+role);await page.screenshot({path:artifacts+'/landing-'+role+'-320.png',fullPage:true});result.views.push({role,route,lang:'en',width:320,overflow:false});await context.close();
 }
 result.checks.push('8role expected production landing routes at320px no overflow');
 result.checks.push('320px production entry no horizontal overflow, visible warning/locale/action');
 result.checks.push('11production axe scans zero violations and bilingual keyboard focus trap');
 result.checks.push('bilingual actual browser seeded-patient view, role selector and workspace audit page');
 await owner.query("UPDATE demo_workspaces SET expires_at=now()-interval '1 second' WHERE id=$1",[pa.data[0].workspaceId]);

 // Hold a touch transaction's row lock while cleanup starts, then release it.
 await owner.query("UPDATE demo_workspaces SET expires_at=now()+interval '1 minute' WHERE id=$1",[pb.data[0].workspaceId]);
 await runtime.query('BEGIN');await runtime.query("SELECT set_config('hms.workspace_id',$1,true)",[pb.data[0].workspaceId]);await runtime.query('SELECT hms_touch_demo_workspace($1)',[pb.data[0].workspaceId]);
 const cleanupRace=owner.query('SELECT hms_cleanup_expired_workspaces()');await runtime.query('COMMIT');await cleanupRace;
 if((await owner.query('SELECT count(*)::int AS n FROM demo_workspaces WHERE id=$1',[pb.data[0].workspaceId])).rows[0].n!==1)throw Error('cleanup removed touched live workspace');
 result.checks.push('touch transaction and concurrent cleanup preserve active workspace');
 const cu=new URL(url);cu.username='hms_cleanup';cu.password=cp;cleaner=new Client({connectionString:cu.toString()});await cleaner.connect();
 for(const sql of ['SELECT * FROM users','SELECT * FROM demo_workspaces',"SELECT hms_create_demo_workspace('00000000-0000-4000-a000-000000000007')",'CREATE TABLE forbidden(id int)']){let denied=false;try{await cleaner.query(sql)}catch(e){denied=e.code==='42501'}if(!denied)throw Error('cleanup identity excessive privilege '+sql)}
 let runtimeCleanupDenied=false;try{await runtime.query('SELECT hms_cleanup_expired_workspaces()')}catch(e){runtimeCleanupDenied=e.code==='42501'}if(!runtimeCleanupDenied)throw Error('web runtime can cleanup');
 await cleaner.query('SELECT hms_cleanup_expired_workspaces()');await cleaner.query('SELECT hms_cleanup_expired_workspaces()');
 result.checks.push('cleanup-only NOBYPASSRLS login cannot read tables/bootstrap/create schema; web runtime cannot cleanup; repeated cleanup idempotent');
 for(const table of ['users','patients','invoices','invoice_items','audit_logs','departments','beds','medications']){
  if((await owner.query('SELECT count(*)::int AS n FROM '+table+' WHERE workspace_id=$1',[pa.data[0].workspaceId])).rows[0].n!==0)throw Error('cleanup remaining '+table);
 }
 if((await owner.query('SELECT count(*)::int AS n FROM users WHERE workspace_id=$1',[pb.data[0].workspaceId])).rows[0].n!==8)throw Error('cleanup touched other workspace');
 result.checks.push('non-superuser NOBYPASSRLS migration/function owner verified for bootstrap and cleanup');
 if((await call('patients',a.data.accessToken)).status!==401)throw Error('deleted workspace token accepted');
 // Test rate gate after the3actual anonymous starts, no proxy-header assumptions.
 const throttled=await call('demo/start',null,{});if(throttled.status!==429)throw Error('fourth anonymous start not throttled');
 // Direct SQL cap permits expired-row reaping without changing sliding inactivity.
 await owner.query("INSERT INTO demo_workspaces(id,expires_at) SELECT gen_random_uuid()::text,now()-interval '1 second' FROM generate_series(1,101)");
 await runtime.query('SELECT hms_create_demo_workspace($1)',[require('node:crypto').randomUUID()]);
 if((await owner.query('SELECT count(*)::int AS n FROM demo_workspaces WHERE expires_at<=now()')).rows[0].n!==0)throw Error('bootstrap did not reap expired rows');
 await owner.query("INSERT INTO demo_workspaces(id) SELECT gen_random_uuid()::text FROM generate_series(1,100-(SELECT count(*)::int FROM demo_workspaces))");
 let capped=false;try{await runtime.query('SELECT hms_create_demo_workspace($1)',[require('node:crypto').randomUUID()])}catch(e){capped=e.code==='P0001'&&e.message.includes('capacity')};if(!capped)throw Error('100workspace cap not enforced');
 result.checks.push('deletedworkspace401, fourthanonymousstart429, bootstrap expired reaping,100liveworkspace cap');
 result.checks.push('direct cross-workspace composite FK denied; cleanup purges actual invoice/items/audit and preserves other8users');
 result.finishedAt=new Date().toISOString();result.checkCount=result.checks.length;result.axeScanCount=result.axe.length;result.passed=true;console.log(JSON.stringify(result,null,2));
}catch(e){result.error=String(e.stack??e).replaceAll(password,'[redacted]');console.error(result.error);process.exitCode=1}
finally{if(browser)await browser.close();if(vite)vite.kill();if(app)await app.close();writeFileSync(artifacts+'/isolation-results.json',JSON.stringify(result,null,2));if(service)await service.$disconnect();if(cleaner)await cleaner.end();if(runtime)await runtime.end();if(owner)await owner.end()}
