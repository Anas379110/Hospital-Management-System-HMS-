// Logical backup/restore drill for two disposable databases in the SAME local cluster.
// No live DB, external storage, PITR, independent-cluster role recovery or RPO/RTO claim.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {realpathSync,readFileSync,writeFileSync,mkdtempSync,chmodSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
const data=process.env.HMS_TEST_PG_DATA;
if(!data)throw Error('Set HMS_TEST_PG_DATA to dedicated /tmp/hms_test_perf_* cluster');
assert.match(realpathSync(data),/^\/tmp\/hms_test_perf_[a-zA-Z0-9_]+$/);
function parse(name){const u=new URL(process.env[name]??'');assert.ok(['127.0.0.1','localhost','[::1]'].includes(u.hostname));assert.ok(u.port,'Explicit disposable port required');assert.match(u.pathname,/^\/hms_test_perf_[a-z0-9_]+$/);return u;}
const source=parse('HMS_BACKUP_SOURCE_URL'),target=parse('HMS_BACKUP_TARGET_URL');
assert.notEqual(source.pathname,target.pathname,'Never restore over source DB');
assert.equal(source.hostname,target.hostname);assert.equal(source.port,target.port);
const dumpBin=process.env.HMS_TEST_PG_DUMP??'pg_dump',restoreBin=process.env.HMS_TEST_PG_RESTORE??'pg_restore';
const scriptSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const report={scriptSha256,workingTreeDirty:spawnSync('git',['status','--porcelain'],{encoding:'utf8'}).stdout.length>0,scope:'Local logical custom-format backup/restore of fictional data to an empty distinct database in same verified disposable cluster',sourceCommit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),startedAt:new Date().toISOString(),complete:false,checks:[]};
const db=u=>new PrismaClient({datasources:{db:{url:u.toString()}}});
const a=db(source),b=db(target);let stage='identity';
function env(u){const safe={...process.env};for(const key of Object.keys(safe))if(key.startsWith('PG'))delete safe[key];return {...safe,PGHOST:u.hostname.replace(/^\[|\]$/g,''),PGPORT:u.port,PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGPASSFILE:'/nonexistent'};}
function run(binary,args,u){const r=spawnSync(binary,args,{env:env(u),encoding:'utf8',timeout:120000});if(r.status!==0){const folder=mkdtempSync('/tmp/hms_test_perf_tool_error_');chmodSync(folder,0o700);writeFileSync(folder+'/stderr.log',r.stderr??'',{mode:0o600});}assert.equal(r.status,0,binary+' failed at '+stage+' (exit '+r.status+'); inspect local stderr securely');return r.stdout.trim();}
const hash=x=>createHash('sha256').update(x).digest('hex');
async function snapshot(client){
 const tables=await client.$queryRawUnsafe("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename");const rows=[];
 for(const t of tables){assert.match(t.tablename,/^[a-zA-Z_][a-zA-Z0-9_]*$/);const all=await client.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM public.\"${t.tablename}\" t ORDER BY row_to_json(t)::text COLLATE \"C\"`);rows.push({table:t.tablename,rls:t.rowsecurity,count:all.length,sha256:hash(all.map(x=>x.row).join('\n'))});}
 const policies=await client.$queryRawUnsafe("SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname");
 const grants=await client.$queryRawUnsafe("SELECT table_name,grantee,privilege_type,is_grantable FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type");
 const constraints=await client.$queryRawUnsafe("SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname");
 const functions=await client.$queryRawUnsafe("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)");
 const sequences=await client.$queryRawUnsafe("SELECT sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,last_value::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename");
 const catalog={};
 for(const [name,sql] of Object.entries({
  indexes:"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  triggers:"SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
  columns:"SELECT table_name,column_name,ordinal_position,data_type,udt_name,column_default,is_nullable,is_identity,is_generated FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
  enums:"SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
  relationSecurity:"SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname",
  schemaAcl:"SELECT nspname,nspacl::text,pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='public'",
  functionAcl:"SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.proacl::text,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,args"
 }))catalog[name]=await client.$queryRawUnsafe(sql);
 return {rows,policies,grants,constraints,functions,sequences,catalog};
}
try{
 // Both actual identities are verified before dump/restore or any target effect.
 for(const client of [a,b])assert.equal(realpathSync((await client.$queryRawUnsafe('SHOW data_directory'))[0].data_directory),realpathSync(data),'Different/shared/tunneled cluster refused');
 const systems=await Promise.all([a,b].map(client=>client.$queryRawUnsafe('SELECT system_identifier::text FROM pg_control_system()')));assert.deepEqual(systems[0],systems[1]);const postmasterPid=Number(readFileSync(data+'/postmaster.pid','utf8').split('\n')[0]);process.kill(postmasterPid,0);report.localPostmaster={pid:postmasterPid,systemIdentifier:systems[0][0].system_identifier};
 assert.deepEqual(await b.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'"),[],'Restore target must be fresh empty database');
 const targetObjects=await b.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'");assert.equal(targetObjects[0].n,0,'Target must have no public functions');
 report.identity={actualDataDirectory:realpathSync(data),explicitPort:Number(source.port),sourceDatabase:source.pathname.slice(1),targetDatabase:target.pathname.slice(1),verifiedBeforeEffects:true};
 report.postgres=(await a.$queryRawUnsafe('SELECT version() AS version'))[0].version;
 stage='snapshot-before';const before=await snapshot(a);assert.ok(before.rows.length>10);assert.equal(before.rows.find(x=>x.table==='patients')?.count,10040);assert.equal(before.rows.find(x=>x.table==='audit_logs')?.count,40);
 const folder=mkdtempSync('/tmp/hms_test_perf_backup_');chmodSync(folder,0o700);const archive=folder+'/fictional.dump';stage='dump';report.dumpVersion=run(dumpBin,['--version'],source);report.restoreVersion=run(restoreBin,['--version'],target);const begin=Date.now();run(dumpBin,['--format=custom','--file='+archive],source);chmodSync(archive,0o600);report.dumpMs=Date.now()-begin;report.archive={bytes:readFileSync(archive).length,sha256:hash(readFileSync(archive)),localPath:archive,retainedFictionalOnly:true};
 stage='restore';const restoreStart=Date.now();run(restoreBin,['--exit-on-error','--single-transaction','--dbname='+target.pathname.slice(1),archive],target);report.restoreMs=Date.now()-restoreStart;
 stage='verify';const after=await snapshot(b);assert.deepEqual(after,before,'Rows/policies/grants/constraints/functions/sequences must exactly match');assert.deepEqual(await snapshot(a),before,'Source must remain unchanged throughout drill');
 stage='restricted-runtime';const workspace=(await b.$queryRawUnsafe('SELECT id FROM demo_workspaces ORDER BY id LIMIT 1'))[0].id;
 const runtimeRows=await b.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_runtime');await tx.$queryRawUnsafe("SELECT set_config('hms.workspace_id',$1,true)",workspace);return tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM patients');});assert.equal(runtimeRows[0].n,10040);
 const isolatedRows=await b.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_runtime');await tx.$queryRawUnsafe("SELECT set_config('hms.workspace_id','fictional-absent-workspace',true)");return tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM patients');});assert.equal(isolatedRows[0].n,0);
 let auditDenied=false;try{await b.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_runtime');await tx.$executeRawUnsafe('UPDATE audit_logs SET action=action WHERE false');});}catch(error){auditDenied=String(error.message).includes('permission denied');}assert.ok(auditDenied,'Restricted role must still be denied UPDATE audit_logs');
 const role=(await b.$queryRawUnsafe("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='hms_runtime'"))[0];assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);assert.ok(after.catalog.relationSecurity.every(x=>x.owner!=='hms_runtime'));
 for(const sql of ['DELETE FROM audit_logs WHERE false','TRUNCATE audit_logs']){let denied=false;try{await b.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_runtime');await tx.$executeRawUnsafe(sql);throw Error('Unexpected permission allowed');});}catch(error){denied=String(error.message).includes('permission denied');}assert.ok(denied,'Audit deletion/truncation must be denied');}
 const originalWorkspace=(await b.$queryRawUnsafe('SELECT id FROM demo_workspaces LIMIT 1'))[0].id,otherWorkspace=randomUUID();
 await b.$executeRawUnsafe('SELECT hms_create_demo_workspace($1)',otherWorkspace);
 const tenantChecks=[];
 for(const [workspace,expected] of [[originalWorkspace,{patients:10040,users:8,departments:1}],[otherWorkspace,{patients:1,users:8,departments:1}]]){
  for(const table of ['patients','users','departments']){const result=await b.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_runtime');await tx.$queryRawUnsafe("SELECT set_config('hms.workspace_id',$1,true)",workspace);return tx.$queryRawUnsafe(`SELECT count(*)::int AS rows,count(*) FILTER(WHERE workspace_id<>current_setting('hms.workspace_id'))::int AS foreign_rows FROM ${table}`);});assert.equal(result[0].rows,expected[table]);assert.equal(result[0].foreign_rows,0);tenantChecks.push({workspace,table,...result[0]});}
 }
 report.twoWorkspaceChecks={createdAfterImmutableRestoreComparison:true,checks:tenantChecks};
 report.restrictedRuntime={roleAttributes:role,nonOwnerVerified:true,auditDeleteTruncateDenied:true,role:'hms_runtime',workspaceRows:10040,absentWorkspaceRows:0,auditUpdateDenied:true};
 report.rowDigests=after.rows;report.catalogCounts={policies:after.policies.length,grants:after.grants.length,constraints:after.constraints.length,functions:after.functions.length,sequences:after.sequences.length};report.additionalCatalogCounts=Object.fromEntries(Object.entries(after.catalog).map(([k,v])=>[k,v.length]));report.additionalCatalogSha256=hash(JSON.stringify(after.catalog));report.catalogSha256=hash(JSON.stringify({policies:after.policies,grants:after.grants,constraints:after.constraints,functions:after.functions,sequences:after.sequences}));report.checks=['Both actual cluster identities verified before any restore effect','Distinct empty target, no overwrite/clean/drop option','Full row counts and ordered JSON digests match all public tables including10040patients and40audits','RLS flags/policies/tablegrants/constraints/functions/sequences match','Source unchanged after restore','Restored restricted runtime sees10040onlyinownworkspace/zeroabsentworkspace andcannotupdateauditlogs'];report.complete=true;
}catch(error){report.failedStage=stage;report.error=error.message;process.exitCode=1}
finally{await Promise.all([a.$disconnect(),b.$disconnect()]);report.finishedAt=new Date().toISOString();report.limitations=['Logical whole-database restore within same local cluster, not separate host/storage or role reconstruction','No scheduled daily backup, retention policy, encryption/key custody, external copy, PITR or recovery objective accepted','No live/provider database read or write, no real patient data','No power-cut/disk-failure, hosted availability or full application-after-restore certification','Dump/restore milliseconds are observations, not RPO/RTO guarantees'];const output=process.env.HMS_BACKUP_REPORT??'backup-restore-report.json';writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,complete:report.complete,failedStage:report.failedStage,error:report.error,checks:report.checks,catalogCounts:report.catalogCounts},null,2));}
