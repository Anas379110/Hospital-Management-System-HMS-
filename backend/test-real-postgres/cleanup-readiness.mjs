// Disposable local/CI database only. Never accepts a hosted URL.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
const root=fileURLToPath(new URL('../',import.meta.url)),url=process.env.HMS_CLEANUP_TEST_DATABASE_URL,u=new URL(url);
if(!['127.0.0.1','localhost'].includes(u.hostname)||!u.pathname.includes('hms_test'))throw Error('Disposable local hms_test database required');
const migration=spawnSync('node',['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:url},encoding:'utf8'});if(migration.status!==0)throw Error(migration.stdout+migration.stderr);
const p=new PrismaClient({datasources:{db:{url}}}),checks=[];
const ready=async()=> (await p.$queryRawUnsafe('SELECT hms_demo_cleanup_fresh() AS ready'))[0].ready;
try{
 for(const name of ['hms_runtime','hms_cleanup'])await p.$executeRawUnsafe(`CREATE ROLE ${name} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT`);
 await p.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO hms_runtime,hms_cleanup');
 // pg driver supports the grant script's multiple SQL statements.
 const {Client}=require('../../frontend/node_modules/pg');const c=new Client({connectionString:url});await c.connect();await c.query(readFileSync(root+'/prisma/demo/grants.sql','utf8'));await c.end();
 assert.equal(await ready(),false);checks.push('null heartbeat denied');
 for(const expression of ["clock_timestamp()-interval '91 minutes'","clock_timestamp()+interval '1 minute'","pg_postmaster_start_time()-interval '1 second'"]){await p.$executeRawUnsafe('UPDATE hms_cleanup_state SET last_success_at='+expression);assert.equal(await ready(),false)}checks.push('stale, future, pre-start heartbeat denied');
 await p.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');assert.equal(await ready(),true);checks.push('actual committed cleanup enables readiness');
 const before=(await p.$queryRawUnsafe('SELECT last_success_at FROM hms_cleanup_state'))[0].last_success_at;
 await p.$executeRawUnsafe("INSERT INTO demo_workspaces(id,expires_at) VALUES('expired-check',clock_timestamp()-interval '1 hour')");
 try{await p.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');throw Error('rollback')})}catch{}
 assert.equal((await p.$queryRawUnsafe("SELECT count(*)::int n FROM demo_workspaces WHERE id='expired-check'"))[0].n,1);
 assert.equal((await p.$queryRawUnsafe('SELECT last_success_at FROM hms_cleanup_state'))[0].last_success_at.getTime(),before.getTime());checks.push('rollback preserves expired rows and old heartbeat');
 await p.$executeRawUnsafe('DELETE FROM hms_cleanup_state');assert.equal(await ready(),false);
 await assert.rejects(p.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()'));assert.equal((await p.$queryRawUnsafe("SELECT count(*)::int n FROM demo_workspaces WHERE id='expired-check'"))[0].n,1);checks.push('missing state fails cleanup and rolls back deletion');
 await p.$executeRawUnsafe('INSERT INTO hms_cleanup_state(id) VALUES(1)');
 await assert.rejects(p.$executeRawUnsafe('INSERT INTO hms_cleanup_state(id) VALUES(2)'));checks.push('singleton constraint');
 for(const role of ['hms_runtime','hms_cleanup']){
  const perms=(await p.$queryRawUnsafe(`SELECT has_table_privilege('${role}','hms_cleanup_state','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS direct,has_function_privilege('${role}','hms_demo_cleanup_fresh()','EXECUTE') AS readiness,has_function_privilege('${role}','hms_cleanup_expired_workspaces()','EXECUTE') AS cleanup`))[0];assert.equal(perms.direct,false);assert.equal(perms.readiness,role==='hms_runtime');assert.equal(perms.cleanup,role==='hms_cleanup');
 }checks.push('runtime and cleanup exact table/function ACL');
 await assert.rejects(p.$queryRawUnsafe("SELECT hms_create_demo_workspace('00000000-0000-4000-a000-000000000001')"));
 await assert.rejects(p.$queryRawUnsafe("SELECT hms_touch_demo_workspace('00000000-0000-4000-a000-000000000001')"));checks.push('database bootstrap and touch fail closed');
 await p.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');assert.equal(await ready(),true);
 await p.$executeRawUnsafe("SELECT hms_create_demo_workspace('00000000-0000-4000-a000-000000000001')");checks.push('cleanup recovery permits bootstrap');
 const report={postgres:(await p.$queryRawUnsafe('SELECT version() version'))[0].version,checks};writeFileSync(process.env.HMS_CLEANUP_TEST_REPORT??root+'/cleanup-readiness-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await p.$executeRawUnsafe('DROP OWNED BY hms_runtime,hms_cleanup');await p.$executeRawUnsafe('DROP ROLE hms_runtime,hms_cleanup');await p.$executeRawUnsafe('REASSIGN OWNED BY hms_migration TO CURRENT_USER');await p.$executeRawUnsafe('DROP OWNED BY hms_migration');await p.$executeRawUnsafe('DROP ROLE hms_migration');await p.$disconnect()}
