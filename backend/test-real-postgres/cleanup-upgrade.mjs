// Existing-install upgrade, local disposable database only. No external connection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{Client}=require('../../frontend/node_modules/pg');
const root=fileURLToPath(new URL('../',import.meta.url)),url=process.env.HMS_UPGRADE_TEST_DATABASE_URL,u=new URL(url);
if(!['127.0.0.1','localhost'].includes(u.hostname)||!u.pathname.includes('hms_test'))throw Error('Disposable local hms_test database required');
const c=new Client({connectionString:url}),checks=[];await c.connect();
const sql=p=>readFileSync(root+'/'+p,'utf8');
const migration='prisma/migrations/20261127190000_demo_cleanup_readiness/migration.sql';
try{
 assert.equal((await c.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN ('postgres','hms_runtime','hms_cleanup','hms_migration','anon','authenticated','service_role')")).rows[0].n,0,'isolated role set required');
 await c.query('CREATE ROLE postgres NOLOGIN NOSUPERUSER CREATEROLE NOCREATEDB BYPASSRLS; CREATE ROLE hms_runtime NOLOGIN; CREATE ROLE hms_cleanup NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
 await c.query('GRANT USAGE,CREATE ON SCHEMA public TO postgres');
 const baselineHashes={"prisma/migrations/20261127003000_demo_workspace_isolation/migration.sql": "40a134d838fbb0d58222e188d2232ba694bb112207e6f3a47280bdbe8f4a590d", "prisma/migrations/20261126185500_restrict_audit_actor_rewrite/migration.sql": "f765cb68f70121324e3e1a49c51e878a20daf99d17caa706901420d1706b882e", "prisma/migrations/20261126174000_enforce_active_allocations/migration.sql": "c4856d6335a809345e34c04938eb32f0185a75c3e9fd630f662da792bde75608", "prisma/migrations/20260830215751_init/migration.sql": "e175c1c52cad2edf7b1cc671b6a85e74aac10c9462faf47c087ecc64429fa9be"};
 for(const [path,hash] of Object.entries(baselineHashes))assert.equal(createHash('sha256').update(sql(path)).digest('hex'),hash,'9675180 baseline hash drift');
 await c.query('SET ROLE postgres');
 for(const dir of readdirSync(root+'/prisma/migrations').filter(x=>/^\d/.test(x)&&x<'20261127190000_demo_cleanup_readiness').sort())await c.query(sql('prisma/migrations/'+dir+'/migration.sql'));
 await c.query('CREATE TABLE _prisma_migrations(id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)');
 await c.query('RESET ROLE');
 // Baseline owner transfer needs SET membership, as the live project has.
 await c.query(sql('test-real-postgres/fixtures/grants-9675180.sql').replace('GRANT USAGE,CREATE ON SCHEMA public TO hms_migration;', 'GRANT hms_migration TO postgres WITH INHERIT TRUE, SET TRUE; GRANT USAGE,CREATE ON SCHEMA public TO hms_migration;'));
 await c.query('CREATE SCHEMA cron AUTHORIZATION postgres; CREATE SCHEMA extensions AUTHORIZATION postgres;');
 await c.query('SET ROLE postgres');
 await c.query(sql('prisma/demo/supabase-normalize.sql'));
 // Scheduler catalog is a local fixture, not evidence of pg_cron scheduling.
 await c.query('RESET ROLE');await c.query('CREATE TABLE cron.job(jobname text,schedule text,command text,username text,active boolean)');
 const audit=sql('prisma/demo/supabase-audit.sql');const command=audit.match(/command<>\$cleanup\$([\s\S]*?)\$cleanup\$/)[1];
 await c.query('INSERT INTO cron.job VALUES($1,$2,$3,$4,true),($5,$6,$7,$4,true)',['hms-hourly-expiry-cleanup','0 * * * *',command,'postgres','hms-cron-history-prune','15 0 * * *',"DELETE FROM cron.job_run_details WHERE end_time < now() - interval '24 hours';"]);
 await c.query('GRANT USAGE ON SCHEMA cron TO postgres; GRANT SELECT ON cron.job TO postgres;');
 await c.query('SET ROLE postgres');
 const before=(await c.query("SELECT proname,prosrc,proacl::text acl,pg_get_userbyid(proowner) owner FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname")).rows;
 assert.equal(before.length,3);assert(before.every(x=>x.owner==='hms_migration'));checks.push('9675180 old migrations and old grants, normalized baseline with three function bodies');
 await c.query('BEGIN');await c.query(sql(migration));await c.query(sql('prisma/demo/cleanup-readiness-upgrade.sql').replace('BEGIN;','').replace('COMMIT;',''));await c.query('COMMIT');
 const identity=(await c.query('SELECT current_user,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(identity.current_user,'postgres');assert.equal(identity.rolsuper,false);checks.push('exact postgres NOSUPERUSER CREATEROLE BYPASSRLS executor with existing migration membership');
 const after=(await c.query("SELECT proname,proacl::text acl FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows;for(const b of before)assert.equal(after.find(x=>x.proname===b.proname).acl,b.acl);checks.push('existing function ACL preserved; no fresh grants rerun');
 assert.equal((await c.query('SELECT hms_demo_cleanup_fresh() ready')).rows[0].ready,false);checks.push('upgrade closed before cleanup');
 await c.query('RESET ROLE; GRANT hms_cleanup TO postgres WITH INHERIT FALSE,SET TRUE; SET ROLE postgres; SET ROLE hms_cleanup;');
 await c.query('SELECT hms_cleanup_expired_workspaces()');await c.query('RESET ROLE; SET ROLE postgres;');
 assert.equal((await c.query('SELECT hms_demo_cleanup_fresh() ready')).rows[0].ready,true);checks.push('real cleanup identity run enables readiness');
 // All structural audit code is identical except TLS probe, because CI services lack TLS.
 const localAudit=audit.replace(" OR NOT coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false)",'');
 assert.notEqual(audit,localAudit);await c.query(localAudit);checks.push('full structural audit passes, only local TLS predicate omitted; production audit unchanged');
 for(const mutation of ['GRANT SELECT ON hms_cleanup_state TO hms_runtime','GRANT UPDATE ON hms_cleanup_state TO hms_cleanup','GRANT EXECUTE ON FUNCTION hms_demo_cleanup_fresh() TO anon','GRANT EXECUTE ON FUNCTION hms_demo_cleanup_fresh() TO hms_cleanup']){
  await c.query('BEGIN');await c.query(mutation);let denied=false;try{await c.query(localAudit)}catch{denied=true}await c.query('ROLLBACK');assert(denied,mutation);
 }checks.push('all new-object ACL drift negatives rejected');
 const report={postgres:(await c.query('SELECT version() version')).rows[0].version,identity,checks,limitations:['local cron.job is a catalog fixture, not pg_cron execution','local TLS identity predicate omitted; live TLS and catalog body comparison remain read-only preflight gates']};console.log(JSON.stringify(report,null,2));writeFileSync(process.env.HMS_UPGRADE_TEST_REPORT??root+'/cleanup-upgrade-report.json',JSON.stringify(report,null,2));
}catch(e){console.error('UPGRADE TEST:',e.message);throw e}finally{await c.query('ROLLBACK');await c.query('RESET ROLE');for(const role of ['hms_runtime','hms_cleanup','hms_migration','postgres','anon','authenticated','service_role']){await c.query('REASSIGN OWNED BY '+role+' TO CURRENT_USER');await c.query('DROP OWNED BY '+role);await c.query('DROP ROLE '+role)}await c.end()}
