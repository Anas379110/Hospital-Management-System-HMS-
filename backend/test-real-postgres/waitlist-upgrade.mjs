// Verified disposable local old-install upgrade and logical backup/restore only.
import assert from 'node:assert/strict';
import {applyValidatedWaitlistUpgrade} from '../prisma/demo/waitlist-upgrade-transaction.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,writeFileSync,realpathSync,mkdtempSync,chmodSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{Client}=require('../../frontend/node_modules/pg');
const root=fileURLToPath(new URL('../',import.meta.url));
const u=new URL(process.env.HMS_WAITLIST_UPGRADE_URL??''),target=new URL(process.env.HMS_WAITLIST_RESTORE_URL??'');
const ci=process.env.HMS_WAITLIST_UPGRADE_CI==='true';
for(const url of [u,target]){assert.equal(url.hostname,'127.0.0.1');assert.ok(url.port);assert.match(url.pathname,/^\/hms_test_(perf_)?waitlist_(upgrade|restore)$/);}
assert.equal(u.host,target.host);assert.notEqual(u.pathname,target.pathname);assert.equal(u.username,target.username);
if(ci){assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(u.port,'5432');assert.equal(u.username,'hms_test');}
const c=new Client({connectionString:u.toString()}),b=new Client({connectionString:target.toString()});await c.connect();await b.connect();
const sql=p=>readFileSync(root+p,'utf8'),hash=x=>createHash('sha256').update(x).digest('hex');
const migration='prisma/migrations/20261128005000_department_waitlist/migration.sql',checks=[];
const report={scope:'Same-disposable-cluster logical backup/restore and old-install additive upgrade. Not hosted backup or provider PITR.',complete:false,startedAt:new Date().toISOString(),checks,scriptSha256:hash(readFileSync(new URL(import.meta.url))),migrationSha256:hash(sql(migration))};
const roles=['postgres','hms_runtime','hms_cleanup','hms_migration','anon','authenticated','service_role'];
async function snapshot(client){
 const result={};
 for(const t of (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows){assert.match(t.tablename,/^[a-z_][a-z0-9_]*$/);const rows=(await client.query(`SELECT row_to_json(t)::text row FROM public."${t.tablename}" t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows;result[t.tablename]={count:rows.length,sha:hash(rows.map(x=>x.row).join('\n'))};}
 return result;
}
async function catalog(client){const queries={relations:`SELECT relname,relrowsecurity,relforcerowsecurity,coalesce(relacl,acldefault(CASE WHEN relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,relowner))::text relacl,pg_get_userbyid(relowner) owner FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname`,policies:"SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",constraints:"SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname",indexes:"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",functions:"SELECT proname,prosrc,proacl::text,pg_get_userbyid(proowner) owner FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname"};const out={};for(const[k,v]of Object.entries(queries))out[k]=(await client.query(v)).rows;return out;}
function run(binary,args,url){
 const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('PG'))delete env[k];const pgEnv={PGHOST:url.hostname,PGPORT:url.port,PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1),PGPASSFILE:'/nonexistent'};Object.assign(env,pgEnv);
 let cmd=binary,actual=args,input;const container=process.env.HMS_WAITLIST_PG_CONTAINER;
 if(container){assert.equal(ci,true);assert.match(container,/^[a-zA-Z0-9_-]+$/);cmd='docker';actual=['exec',...(binary==='pg_restore'?['-i']:[]),...Object.entries(pgEnv).flatMap(([k,v])=>['-e',k+'='+v]),container,binary];const file=args.find(arg=>arg.startsWith('--file='));actual.push(...args.filter(arg=>!arg.startsWith('--file=')));
  if(binary==='pg_restore'&&!args.includes('--version')){input=readFileSync(args.at(-1));actual.pop();}
  const r=spawnSync(cmd,actual,{env,input,timeout:120000,maxBuffer:64*1024*1024});assert.equal(r.status,0,'Container matching-version dump/restore failed');if(file)writeFileSync(file.slice(7),r.stdout);return args.includes('--version')?r.stdout.toString().trim():'';
 }
 const r=spawnSync(cmd,actual,{encoding:'utf8',env,timeout:120000});assert.equal(r.status,0,'Local dump/restore failed, inspect private tool log');return r.stdout.trim();
}
let stage='identity';
const inputPaths=['prisma/demo/waitlist-upgrade-transaction.mjs','prisma/demo/supabase-normalize.sql','prisma/schema.prisma','prisma/migrations/20261128005000_department_waitlist/migration.sql','prisma/demo/waitlist-grants.sql','prisma/demo/grants.sql','prisma/demo/supabase-audit.sql','src/modules/waitlist/waitlist.service.ts','src/modules/waitlist/waitlist.controller.ts','src/modules/admissions/admissions.service.ts','src/modules/departments/department-setup.service.ts','src/common/transaction-audit.ts','../frontend/src/components/DepartmentWaitlist.tsx','../frontend/src/hooks/useWaitlist.ts'];
report.inputSha256=Object.fromEntries(inputPaths.map(path=>[path,createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
try{
 for(const client of [c,b]){assert.equal((await client.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);if(!ci)assert.equal(realpathSync((await client.query('SHOW data_directory')).rows[0].data_directory),realpathSync(process.env.HMS_TEST_PG_DATA));}
 assert.deepEqual((await c.query('SELECT system_identifier::text FROM pg_control_system()')).rows,(await b.query('SELECT system_identifier::text FROM pg_control_system()')).rows);
 report.postgres=(await c.query('SELECT version() version')).rows[0].version;
 assert.equal((await c.query('SELECT count(*)::int n FROM pg_roles WHERE rolname=ANY($1)',[roles])).rows[0].n,0);
 await c.query('CREATE ROLE postgres NOLOGIN NOSUPERUSER CREATEROLE NOCREATEDB BYPASSRLS; CREATE ROLE hms_runtime NOLOGIN; CREATE ROLE hms_cleanup NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; GRANT USAGE,CREATE ON SCHEMA public TO postgres;');
 await c.query('SET ROLE postgres');
 for(const dir of readdirSync(root+'prisma/migrations').filter(x=>/^\d/.test(x)&&x<'20261128005000_department_waitlist').sort())await c.query(sql('prisma/migrations/'+dir+'/migration.sql'));
 await c.query('CREATE TABLE _prisma_migrations(id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)');for(const dir of readdirSync(root+'prisma/migrations').filter(x=>/^\d/.test(x)&&x<'20261128005000_department_waitlist').sort())await c.query('INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,applied_steps_count) VALUES($1,$2,clock_timestamp(),$3,1)',[randomUUID(),hash(sql('prisma/migrations/'+dir+'/migration.sql')),dir]);
 await c.query('RESET ROLE');
 const oldGrants=sql('prisma/demo/grants.sql').replace('REVOKE DELETE,TRUNCATE,REFERENCES,TRIGGER ON waitlist_requests FROM hms_runtime;\n','');
 await c.query(oldGrants.replace('GRANT USAGE,CREATE ON SCHEMA public TO hms_migration;','GRANT hms_migration TO postgres WITH INHERIT TRUE, SET TRUE; GRANT USAGE,CREATE ON SCHEMA public TO hms_migration;'));
 await c.query('CREATE SCHEMA cron AUTHORIZATION postgres; CREATE SCHEMA extensions AUTHORIZATION postgres;');await c.query('SET ROLE postgres');await c.query(sql('prisma/demo/supabase-normalize.sql'));
 await c.query('RESET ROLE');await c.query('CREATE TABLE cron.job(jobname text,schedule text,command text,username text,active boolean)');
 const audit=sql('prisma/demo/supabase-audit.sql'),command=audit.match(/command<>\$cleanup\$([\s\S]*?)\$cleanup\$/)[1];
 await c.query('INSERT INTO cron.job VALUES($1,$2,$3,$4,true),($5,$6,$7,$4,true)',['hms-hourly-expiry-cleanup','0 * * * *',command,'postgres','hms-cron-history-prune','15 0 * * *',"DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours';"]);await c.query('GRANT SELECT ON cron.job TO postgres');
 await c.query('SELECT hms_cleanup_expired_workspaces()');const workspace=randomUUID();await c.query('SELECT hms_create_demo_workspace($1)',[workspace]);
 const before=await snapshot(c),oldCatalog=await catalog(c);checks.push('Exact old migrations, non-super postgres executor with existing migration membership and fictional workspace before upgrade');
 stage='additive-upgrade';await c.query('SET ROLE postgres');
 const localAudit=audit.replace(" OR NOT coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false)",'');assert.notEqual(localAudit,audit);
 // Inject a post-ledger audit failure: no partial DDL, grants or success ledger.
 await assert.rejects(applyValidatedWaitlistUpgrade(c,root,localAudit+"; SELECT 1/0"));
 assert.deepEqual(await snapshot(c),before);assert.deepEqual(await catalog(c),oldCatalog);
 checks.push('Injected post-ledger audit failure rolls back table, grants and ledger; all old rows/catalog unchanged');
 report.ledger=await applyValidatedWaitlistUpgrade(c,root,localAudit);
 const after=await snapshot(c);assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([name])=>!['waitlist_requests','_prisma_migrations'].includes(name))),Object.fromEntries(Object.entries(before).filter(([name])=>name!=='_prisma_migrations')));assert.equal(after._prisma_migrations.count,before._prisma_migrations.count+1);assert.equal(after.waitlist_requests.count,0);
 const postCatalog=await catalog(c);assert.deepEqual(postCatalog.functions,oldCatalog.functions);checks.push('Exact additive migration, grants and Prisma ledger commit atomically as NOSUPER postgres; all prior business rows/function bodies/ACL unchanged');
 checks.push('Full new18-table structural audit passes in transaction, only local TLS probe omitted; cron catalog is fixture not scheduler proof');
 for(const grant of ['GRANT DELETE ON waitlist_requests TO hms_runtime','GRANT SELECT ON waitlist_requests TO hms_cleanup','GRANT SELECT ON waitlist_requests TO anon']){await c.query('BEGIN');await c.query(grant);await assert.rejects(c.query(localAudit));await c.query('ROLLBACK');}checks.push('New waitlistDELETE/cleanup/anon grant drift rejected');
 await c.query('RESET ROLE');const actor=(await c.query("SELECT id FROM users WHERE workspace_id=$1 AND role='nurse'",[workspace])).rows[0].id,patient=(await c.query('SELECT id FROM patients WHERE workspace_id=$1',[workspace])).rows[0].id,dept=(await c.query('SELECT id FROM departments WHERE workspace_id=$1',[workspace])).rows[0].id;
 await c.query('INSERT INTO waitlist_requests(workspace_id,id,patient_id,department_id,requested_by) VALUES($1,$2,$3,$4,$5)',[workspace,randomUUID(),patient,dept,actor]);
 stage='logical-backup';const folder=mkdtempSync('/tmp/hms_test_perf_waitlist_backup_');chmodSync(folder,0o700);const archive=folder+'/fictional.dump';
 const snapshotBefore=await snapshot(c),catalogBefore=await catalog(c);report.dumpVersion=run(process.env.HMS_TEST_PG_DUMP??'pg_dump',['--version'],u);report.restoreVersion=run(process.env.HMS_TEST_PG_RESTORE??'pg_restore',['--version'],target);run(process.env.HMS_TEST_PG_DUMP??'pg_dump',['--format=custom','--file='+archive],u);chmodSync(archive,0o600);report.archive={bytes:readFileSync(archive).length,sha256:hash(readFileSync(archive)),retained:true};
 stage='restore';run(process.env.HMS_TEST_PG_RESTORE??'pg_restore',['--exit-on-error','--single-transaction','--dbname='+target.pathname.slice(1),archive],target);
 assert.deepEqual(await snapshot(b),snapshotBefore);assert.deepEqual(await catalog(b),catalogBefore);assert.deepEqual(await snapshot(c),snapshotBefore);
 for(const client of [c,b]){await client.query('BEGIN; SET LOCAL ROLE hms_runtime');await client.query("SELECT set_config('hms.workspace_id',$1,true)",[workspace]);assert.equal((await client.query('SELECT count(*)::int n FROM waitlist_requests')).rows[0].n,1);await assert.rejects(client.query('DELETE FROM waitlist_requests'));await client.query('ROLLBACK');}
 stage='historical-migration-status';
 // This fixture deliberately stops at the waitlist release, not later index migrations.
 const historical=mkdtempSync('/tmp/hms_test_perf_waitlist_history_');chmodSync(historical,0o700);mkdirSync(historical+'/migrations');copyFileSync(root+'prisma/schema.prisma',historical+'/schema.prisma');copyFileSync(root+'prisma/migrations/migration_lock.toml',historical+'/migrations/migration_lock.toml');
 const historicalNames=readdirSync(root+'prisma/migrations').filter(x=>/^\d/.test(x)&&x<='20261128005000_department_waitlist').sort();
 const historyRows=(await c.query('SELECT migration_name,checksum,finished_at IS NOT NULL finished,rolled_back_at IS NOT NULL rolled_back FROM _prisma_migrations ORDER BY migration_name')).rows;assert.deepEqual(historyRows.map(r=>r.migration_name),historicalNames);
 for(const name of historicalNames){assert.ok(historyRows.find(r=>r.migration_name===name&&r.finished&&!r.rolled_back&&r.checksum===hash(sql('prisma/migrations/'+name+'/migration.sql'))));mkdirSync(historical+'/migrations/'+name);copyFileSync(root+'prisma/migrations/'+name+'/migration.sql',historical+'/migrations/'+name+'/migration.sql');}
 const status=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','status','--schema',historical+'/schema.prisma'],{cwd:root,env:{...process.env,DATABASE_URL:u.toString()},encoding:'utf8',timeout:30000});assert.equal(status.status,0,status.stderr);assert.ok(status.stdout.includes('Database schema is up to date'));report.historicalMigrationNames=historicalNames;checks.push('Prisma migrate status independently recognizes exact historical waitlist migration slice; later release migrations excluded by explicit fixture scope');
 checks.push('Matching-version custom-format dump/empty distinct restore match all rows+catalog; source unchanged, restored runtime scoped read works andDELETE denied');report.complete=true;
}catch(error){report.error=error.message;report.failedStage=stage;process.exitCode=1}
finally{report.finishedAt=new Date().toISOString();await c.query('ROLLBACK');await c.query('RESET ROLE');if(ci){for(const client of [c,b]){for(const role of roles){await client.query('REASSIGN OWNED BY '+role+' TO CURRENT_USER');await client.query('DROP OWNED BY '+role);}}for(const role of roles)await c.query('DROP ROLE '+role);}
 await b.end();await c.end();writeFileSync(process.env.HMS_WAITLIST_UPGRADE_REPORT??'waitlist-upgrade-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
