// Fictional disposable local-only PostgreSQL qualification. Never use a live DB.
// npm ci --ignore-scripts; prisma generate; npm run build, then set HMS_PERFORMANCE_DATABASE_URL.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync,realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), backend=fileURLToPath(new URL('../',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const url=process.env.HMS_PERFORMANCE_DATABASE_URL;
if(!url)throw Error('Set HMS_PERFORMANCE_DATABASE_URL');
const parsed=new URL(url);
if(!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||!/^\/hms_test_perf_[a-z0-9_]+$/.test(parsed.pathname))throw Error('Only loopback hms_test_perf_* disposable databases are allowed');
const expectedData=process.env.HMS_TEST_PG_DATA;
if(!parsed.port)throw Error('Explicit disposable PostgreSQL port is required');
if(!expectedData||!/^\/tmp\/hms_test_perf_[a-zA-Z0-9_]+$/.test(realpathSync(expectedData)))throw Error('HMS_TEST_PG_DATA must identify an actual disposable /tmp/hms_test_perf_* cluster');
const output=process.env.HMS_PERFORMANCE_REPORT ?? backend+'performance-report.json';
const report={scope:'local loopback HTTP, actual compiled public-demo app, nonowner RLS runtime,10,000 fictional patients in one workspace, no hosted performance claim',source:spawnSync('git',['rev-parse','HEAD'],{cwd:backend,encoding:'utf8'}).stdout.trim(),environment:{node:process.version,platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,ramBytes:os.totalmem(),loadBefore:os.loadavg()},criteria:{latencyMs:300,interpretation:'Report every sample plus p50/p95/p99/max; <300ms for every measured operation is the strict local comparison, not a definition of unspecified normal load or medium server.',concurrency:[1,4],samplesPerReadPerConcurrency:40,warmup:4},checks:[],workloads:[]};
let owner,app;
try{
 owner=new PrismaClient({datasources:{db:{url}}});
 const actualData=(await owner.$queryRawUnsafe('SHOW data_directory'))[0].data_directory;assert.equal(realpathSync(actualData),realpathSync(expectedData),'Refuse shared/tunneled or different PostgreSQL cluster before any migration/role/grant effect');
 report.environment.disposableCluster={actualDataDirectory:realpathSync(actualData),explicitPort:Number(parsed.port),identityMatchedBeforeWrites:true};
 const existing=await owner.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'");assert.equal(existing.length,0,'Require an empty fresh database');
 const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:backend,env:{...process.env,DATABASE_URL:url},encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);report.checks.push('All migrations applied to empty disposable DB');
 const password=randomBytes(24).toString('hex');
 await owner.$executeRawUnsafe(`CREATE ROLE hms_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`);
 await owner.$executeRawUnsafe('CREATE ROLE hms_cleanup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT');
 // SQL is repository-controlled, fixed local-only grants. No external input is interpolated.
  // Prisma raw accepts only one statement. Use the PostgreSQL client's fixed SQL-file support.
 const psql=spawnSync('psql',['-v','ON_ERROR_STOP=1','-f',backend+'prisma/demo/grants.sql'],{encoding:'utf8',env:{...process.env,PGHOST:parsed.hostname,PGPORT:parsed.port,PGDATABASE:parsed.pathname.slice(1),PGUSER:decodeURIComponent(parsed.username),PGPASSWORD:decodeURIComponent(parsed.password)}});assert.equal(psql.status,0,psql.stderr);
 await owner.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');
 const runtime=new URL(url);runtime.username='hms_runtime';runtime.password=password;runtime.searchParams.set('connection_limit','8');
 const port=Number(process.env.HMS_PERFORMANCE_PORT??4389);assert.ok(port>=1024&&port<=65535);
 let logs='';app=spawn(process.execPath,['dist/src/main.js'],{cwd:backend,env:{...process.env,DATABASE_URL:runtime.toString(),JWT_SECRET:randomBytes(32).toString('hex'),HMS_PUBLIC_DEMO:'true',HMS_QUALIFICATION_MODE:'false',HMS_RATE_LIMIT_IDENTITY:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});app.stdout.on('data',x=>{logs+=x});app.stderr.on('data',x=>{logs+=x});
 const base='http://127.0.0.1:'+port+'/api/v1';
 for(let i=0;i<150;i++){if(app.exitCode!==null)throw Error('App exited during startup');try{if((await fetch(base+'/health')).status===200)break}catch{}if(i===149)throw Error('App startup timeout');await new Promise(r=>setTimeout(r,200))}
 async function call(path,token,method='GET',body){const start=performance.now();const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw Error('NonJSON response '+r.status)}return{ms:performance.now()-start,status:r.status,data}}
 const boot=await call('/demo/start',null,'POST');assert.equal(boot.status,201);const receptionist=boot.data.accessToken;
 const switched=await call('/demo/role',receptionist,'POST',{role:'admin'});assert.equal(switched.status,201);const admin=switched.data.accessToken;
 const workspaces=await owner.$queryRawUnsafe('SELECT id FROM demo_workspaces');assert.equal(workspaces.length,1);const workspace=workspaces[0].id;
 const rows=await owner.$queryRawUnsafe('SELECT id FROM users WHERE workspace_id=$1 AND role=\'receptionist\'::"Role"',workspace);const actor=rows[0].id;
 const count=await owner.$queryRawUnsafe('SELECT count(*)::int AS n FROM patients WHERE workspace_id=$1',workspace);assert.equal(count[0].n,1);
 await owner.$executeRawUnsafe(`INSERT INTO patients(id,mrn,full_name,date_of_birth,gender,phone,created_by,updated_at,workspace_id) SELECT gen_random_uuid()::text,'HMS-'||lpad(i::text,6,'0'),'Fictional Performance Patient '||lpad(i::text,6,'0'),'2000-01-01'::timestamp,'male'::"Gender",'000000'||lpad(i::text,4,'0'),$1,clock_timestamp(),$2 FROM generate_series(2,10000) i`,actor,workspace);
 await owner.$executeRawUnsafe('ANALYZE');
 const seeded=await owner.$queryRawUnsafe('SELECT count(*)::int AS n FROM patients WHERE workspace_id=$1',workspace);assert.equal(seeded[0].n,10000);report.seed={patients:10000,workspaceCount:1,otherTables:'ordinary demo seed, not10k rich longitudinal medical histories',method:'bulk fixture insert excluding timed requests; each measured write uses full HTTP business workflow/audit'};
 report.environment.postgres=(await owner.$queryRawUnsafe('SELECT version() AS version'))[0].version;
 report.environment.databaseSettings=await owner.$queryRawUnsafe("SELECT name,setting,unit FROM pg_settings WHERE name IN ('shared_buffers','max_connections','fsync','synchronous_commit','full_page_writes') ORDER BY name");
 const samplePatient=(await owner.$queryRawUnsafe("SELECT id FROM patients WHERE workspace_id=$1 AND mrn='HMS-010000'",workspace))[0].id;
 const checks=await call('/patients?search=HMS-010000',admin);assert.equal(checks.status,200);assert.ok(checks.data.some(p=>p.id===samplePatient));
 const department=(await call('/departments',admin)).data[0].id;
 const definitions=[{name:'patient-search',path:i=>'/patients?search='+encodeURIComponent(['HMS-010000','Fictional Performance Patient 0099','0000009999','no-such-fictional-person'][i%4]),token:admin},{name:'patient-detail',path:()=>'/patients/'+samplePatient,token:admin},{name:'patient-medical-records-empty',path:()=>'/patients/'+samplePatient+'/records',token:admin},{name:'appointment-options',path:()=>'/appointments/options',token:admin},{name:'appointments-current-day',path:()=>'/appointments?page=1',token:admin},{name:'departments',path:()=>'/departments',token:admin},{name:'bed-summary',path:()=>'/departments/'+department+'/beds/summary',token:admin}];
 const summarize=(times)=>{const v=[...times].sort((a,b)=>a-b),q=p=>v[Math.ceil(p*v.length)-1];return{min:v[0],p50:q(.5),p95:q(.95),p99:q(.99),max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length,over300:v.filter(t=>t>=300).length}};
 for(const d of definitions){for(let i=0;i<4;i++)assert.equal((await call(d.path(i),d.token)).status,200);for(const concurrency of [1,4]){let index=0;const values=[],statuses={};const start=performance.now();await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const i=index++;if(i>=40)return;const r=await call(d.path(i),d.token);values.push(r.ms);statuses[r.status]=(statuses[r.status]??0)+1;assert.equal(r.status,200,d.name+' failed')}}));report.workloads.push({name:d.name,concurrency,count:values.length,statuses,durationMs:performance.now()-start,latencyMs:summarize(values),samplesMs:values});}}
 //40 total full audited writes, retaining global route throttles unchanged.
 const auditsBefore=(await owner.$queryRawUnsafe('SELECT count(*)::int AS n FROM audit_logs WHERE workspace_id=$1',workspace))[0].n;
 let created=0;
 for(const concurrency of [1,4]){let index=0;const values=[],statuses={};const start=performance.now();await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const i=index++;if(i>=20)return;const n=++created;const r=await call('/patients',receptionist,'POST',{fullName:'Fictional measured patient '+n,dateOfBirth:'2000-01-01',gender:'male',phone:'0000000000'});values.push(r.ms);statuses[r.status]=(statuses[r.status]??0)+1;assert.equal(r.status,201,'patient-create failed')}}));report.workloads.push({name:'patient-create-audited',concurrency,count:values.length,statuses,durationMs:performance.now()-start,latencyMs:summarize(values),samplesMs:values});}
 const totals=await owner.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM patients WHERE workspace_id=$1) AS patients,(SELECT count(*)::int FROM audit_logs WHERE workspace_id=$1) AS audits,(SELECT count(DISTINCT mrn)::int FROM patients WHERE workspace_id=$1) AS unique_mrns',workspace);assert.equal(totals[0].patients,10040);assert.equal(totals[0].audits-auditsBefore,40);assert.equal(totals[0].unique_mrns,10040);report.integrity={...totals[0],newAudits:40,expectedNewPatients:40};report.checks.push('No timed HTTP errors;40creates committed once with40audits and unique MRNs');
 report.measuredLocalTarget=report.workloads.every(x=>x.latencyMs.over300===0)?'All measured samples <300ms in this local environment':'One or more measured samples >=300ms, local strict comparison not met';
 report.limitations=['No network/TLS/Free provider resource contention/cold-start measurement','Client/app/database share one machine; hardware is measured, not a calibrated medium server','Concurrency1and4 are explicit scenarios, not a user-approved definition of normal load','10kpatients only; related tables carry ordinary demo seed and medical-record detail is empty','No backup/restore, power-cut, sustained soak, end-user timing or clinical certification','Public demo rate limits/capacity/RLS/readiness remain enabled; total per route remains below100/minute'];report.complete=true;
}catch(e){report.complete=false;report.error=e.stack;process.exitCode=1}
finally{if(app){app.kill('SIGTERM');if(app.exitCode===null)await new Promise(r=>app.once('exit',r));}await owner?.$disconnect();report.finishedAt=new Date().toISOString();report.environment.loadAfter=os.loadavg();writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,complete:report.complete,error:report.error,measuredLocalTarget:report.measuredLocalTarget,workloads:report.workloads.map(({samplesMs,...r})=>r),integrity:report.integrity},null,2));}
