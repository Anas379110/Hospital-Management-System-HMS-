// Local disposable PostgreSQL process-crash drill, not physical power-loss proof.
// Run only after performance.mjs in an isolated test cluster. Never against hosted DB.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {writeFileSync,realpathSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
const url=process.env.HMS_PERFORMANCE_DATABASE_URL,ctl=process.env.HMS_TEST_PG_CTL,data=process.env.HMS_TEST_PG_DATA;
if(!url||!ctl||!data)throw Error('Set disposable loopback URL, HMS_TEST_PG_CTL and HMS_TEST_PG_DATA');
const u=new URL(url);if(!u.port)throw Error('Explicit disposable PostgreSQL port is required');assert.ok(['localhost','127.0.0.1','[::1]'].includes(u.hostname));assert.match(u.pathname,/^\/hms_test_perf_[a-z0-9_]+$/);assert.match(realpathSync(data),/^\/tmp\/hms_test_perf_[a-zA-Z0-9_]+$/);
let db=new PrismaClient({datasources:{db:{url}}});
const report={scope:'actual local PostgreSQL immediate process shutdown/restart with observed row/audit retention, not physical hardware power failure',source:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),startedAt:new Date().toISOString(),pgCtlVersion:spawnSync(ctl,['--version'],{encoding:'utf8'}).stdout.trim(),checks:[],complete:false};
const run=(args)=>{const r=spawnSync(ctl,args,{encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr);return r.stdout};
try{
 const actual=(await db.$queryRawUnsafe('SHOW data_directory'))[0].data_directory;assert.equal(realpathSync(actual),realpathSync(data),'Refuse another cluster');
 report.postgres=(await db.$queryRawUnsafe('SELECT version() AS version'))[0].version;report.disposableDataDirectory=realpathSync(actual);report.explicitPort=Number(u.port);
 const before=(await db.$queryRawUnsafe('SELECT count(*)::int AS patients,count(DISTINCT mrn)::int AS unique_mrns FROM patients'))[0];const audits=(await db.$queryRawUnsafe('SELECT count(*)::int AS audits FROM audit_logs'))[0];assert.equal(before.patients,10040);assert.equal(audits.audits,40);
 const fixture=(await db.$queryRawUnsafe('SELECT id,workspace_id FROM users LIMIT 1'))[0];
 const settings=await db.$queryRawUnsafe("SELECT name,setting FROM pg_settings WHERE name IN ('fsync','synchronous_commit','full_page_writes') ORDER BY name");assert.ok(settings.every(x=>x.setting==='on'));report.settings=settings;report.before={...before,...audits};
 // Hold a real transaction open, then stop the DB before this transaction commits.
 let written;const ready=new Promise(r=>written=r);let release;const continueTx=new Promise(r=>release=r);
 const transaction=db.$transaction(async tx=>{await tx.$executeRawUnsafe("INSERT INTO patients(id,mrn,full_name,date_of_birth,gender,phone,created_by,updated_at,workspace_id) VALUES('fictional-uncommitted-crash-sentinel','HMS-999999','Fictional uncommitted crash sentinel','2000-01-01','male','0000000000',$1,clock_timestamp(),$2)",fixture.id,fixture.workspace_id);written();await continueTx;},{timeout:30000}).then(()=>({committed:true}),()=>({committed:false}));
 await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Uncommitted fixture timeout')),10000).unref())]);
 report.immediateStopRequestedAt=new Date().toISOString();const start=Date.now();run(['-D',data,'-m','immediate','-w','stop']);release();assert.equal((await transaction).committed,false);await db.$disconnect();
 run(['-D',data,'-l',data+'/crash-restart.log','-o','-p '+u.port+' -h 127.0.0.1','-w','start']);
 report.restartCompletedAt=new Date().toISOString();db=new PrismaClient({datasources:{db:{url}}});
 const after=(await db.$queryRawUnsafe("SELECT count(*)::int AS patients,count(DISTINCT mrn)::int AS unique_mrns,count(*)FILTER(WHERE id='fictional-uncommitted-crash-sentinel')::int AS uncommitted_sentinel FROM patients"))[0];const afterAudits=(await db.$queryRawUnsafe('SELECT count(*)::int AS audits FROM audit_logs'))[0];assert.equal(after.patients,before.patients);assert.equal(after.unique_mrns,before.unique_mrns);assert.equal(after.uncommitted_sentinel,0);assert.equal(afterAudits.audits,audits.audits);
 report.after={...after,...afterAudits};report.recoveryToQueryMs=Date.now()-start;report.checks=['Committed10040fictionalpatients/uniqueMRNs survived immediate process stop+restart','Committed40audits survived','Actual open uncommitted transaction did not persist its sentinel'];report.complete=true;report.limitations=['Not a physical power cut or storage/controller failure','No claim about hosted provider crash/resume or hidden-resume heartbeat semantics','No app availability/auto-restart measurement: API process was stopped after the benchmark','No backup/restore/RPO/RTO/SLA certification; measured recovery is this local drill only'];
}catch(e){report.error=e.stack;process.exitCode=1}
finally{await db.$disconnect();report.finishedAt=new Date().toISOString();const path=process.env.HMS_CRASH_REPORT??'crash-recovery-report.json';writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
