'use strict';
// Disposable same-repository Windows CI only. No remote URLs or caller-selected DB.
const assert = require('node:assert/strict');
const {spawnSync,fork} = require('node:child_process');
const {once}=require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = __dirname;
const home = process.env.HMS_PROBE_HOME;
const pg = path.join(base, 'pg', 'bin');
const appDir = path.join(base, 'deps');
let app;
let phase='preflight';
let appClosed=false;
const secrets=[];
function saveSecrets(){fs.writeFileSync(path.join(home,'roundtrip-secrets.json'),JSON.stringify(secrets.flatMap(v=>[v,encodeURIComponent(v)])));}
const timeout=setTimeout(()=>{if(app&&!appClosed)app.kill();process.exit(25);},240000);
function stage(token) { fs.appendFileSync(path.join(home, 'postgres-stages.txt'), token+'\n'); }
function run(exe, args, {input, env} = {}) {
  const r = spawnSync(exe, args, {cwd:appDir, input, encoding:'utf8', env:env || process.env,
    windowsHide:true, timeout:45000, maxBuffer:8*1024*1024});
  // Never put native output or arguments in an exception or console.
  assert.ok(!r.error && r.status === 0, 'Bounded local command failed');
  return r.stdout.trim();
}
function sql(text, db='hms_roundtrip') {
  return run(path.join(pg, 'psql.exe'), ['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-d',db], {input:text});
}
function dburl(db, user, password) {
  const u = new URL('postgresql://127.0.0.1:55773/'+db);
  u.username=user; u.password=password; return u.toString();
}
function snapshot(db) {
  const tables = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", db).split(/\r?\n/).filter(Boolean);
  assert.ok(tables.length > 10);
  return tables.map(table => {
    assert.match(table,/^[a-z_]+$/);
    // Hash every row, sorted by its digest. No time/state tables are excluded.
    const line=sql(`SELECT count(*)::text || ':' || md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5(row_to_json(t)::text) h FROM public."${table}" t) entries`, db);
    assert.match(line,/^\d+:[a-f0-9]{32}$/);
    const [count, checksum]=line.split(':');
    return {table,count:Number(count),checksum};
  });
}
(async () => {
  const ownerPassword=process.env.PGPASSWORD;
  const runtimePassword=crypto.randomBytes(32).toString('hex');
  const cleanupPassword=crypto.randomBytes(32).toString('hex');
  secrets.push(ownerPassword,runtimePassword,cleanupPassword);
  saveSecrets();
  assert.equal(process.platform,'win32');
  assert.equal(process.env.HMS_PROBE_CI,'1');
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.equal(process.env.PGPORT,'55773');
  assert.equal(process.env.PGUSER,'hms_probe');
  process.env.PGCLIENTENCODING='UTF8';
  assert.ok(home && ownerPassword);
  process.env.DATABASE_URL=dburl('hms_roundtrip','hms_probe',ownerPassword);
  process.env.PRISMA_SCHEMA_ENGINE_BINARY=path.join(base,'schema-engine.exe');
  process.env.PRISMA_QUERY_ENGINE_LIBRARY=path.join(base,'query_engine.dll.node');
  phase='migrate';stage('migrate-before');
  run(path.join(pg,'createdb.exe'), ['hms_roundtrip']);
  run(process.execPath,[path.join(appDir,'node_modules','prisma','build','index.js'),'migrate','deploy']);
  const applied=Number(sql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'));
  const expected=fs.readdirSync(path.join(appDir,'prisma','migrations'),{withFileTypes:true}).filter(e=>e.isDirectory()).length;
  assert.equal(applied,expected); assert.ok(applied>0);
  stage('migrate-after');
  phase='seed';stage('backup-before');
  sql("SELECT hms_cleanup_expired_workspaces(); SELECT hms_create_demo_workspace('11111111-1111-4111-8111-111111111111');");
  sql(fs.readFileSync(path.join(base,'roundtrip-seed.sql'),'utf8'));
  const arabicHex='d8a7d8aed8aad8a8d8a7d8b120d8aad8b1d985d98ad8b220d988d987d985d98a';
  const assertArabic=db=>assert.equal(sql("SELECT encode(convert_to(label,'UTF8'),'hex') FROM windows_probe_types WHERE id=1",db),arabicHex);
  assertArabic('hms_roundtrip');
  assert.equal(sql('SELECT count(*) FROM users'),'8');
  assert.equal(sql('SELECT count(*) FROM patients'),'1');
  phase='roles';
  // Roles are cluster-global; same names exist for source and restored DB.
  sql(`CREATE ROLE hms_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
CREATE ROLE hms_cleanup LOGIN PASSWORD '${cleanupPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;`);
  sql(fs.readFileSync(path.join(appDir,'prisma','demo','grants.sql'),'utf8'));
  sql('REVOKE ALL ON _prisma_migrations,windows_probe_types FROM hms_runtime,hms_cleanup; REVOKE ALL ON SEQUENCE windows_probe_types_id_seq FROM hms_runtime,hms_cleanup;');
  const unsafe=sql("SELECT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)::text FROM pg_roles WHERE rolname='hms_runtime'");assert.equal(unsafe,'false');
  assert.equal(sql("SELECT has_schema_privilege('hms_runtime','public','CREATE')::text"),'false');
  assert.equal(sql("SELECT has_table_privilege('hms_runtime','_prisma_migrations','SELECT')::text"),'false');
  assert.equal(sql("SELECT has_function_privilege('hms_runtime','hms_cleanup_expired_workspaces()','EXECUTE')::text"),'false');
  phase='snapshot';
  const before=snapshot('hms_roundtrip');
  assert.deepEqual(before.filter(t=>t.count===0),[]);
  const catalog=db=>sql("SELECT (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typnamespace='public'::regnamespace)||':'||(SELECT count(*) FROM pg_indexes WHERE schemaname='public')||':'||(SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace)",db);
  const schemaBefore=catalog('hms_roundtrip');
  const sequences=db=>sql("SELECT coalesce(string_agg(sequencename||':'||coalesce(last_value::text,'null'),',' ORDER BY sequencename),'none') FROM pg_sequences WHERE schemaname='public'",db);
  const sequenceBefore=sequences('hms_roundtrip');
  const archive=path.join(home,'fictional-roundtrip.dump');
  phase='dump';
  run(path.join(pg,'pg_dump.exe'),['--format=custom','--file',archive,'hms_roundtrip']);
  assert.ok(fs.statSync(archive).size>0);
  const contents=run(path.join(pg,'pg_restore.exe'),['--list',archive]);
  for(const t of before)assert.ok(contents.includes('TABLE public '+t.table+' '));
  run(path.join(pg,'createdb.exe'),['hms_restored']);
  phase='restore';
  run(path.join(pg,'pg_restore.exe'),['--exit-on-error','--dbname=hms_restored',archive]);
  phase='compare';
  const restored=snapshot('hms_restored');
  assertArabic('hms_restored');
  assert.deepEqual(restored,before);
  assert.equal(catalog('hms_restored'),schemaBefore);
  assert.equal(sequences('hms_restored'),sequenceBefore);
  sql("UPDATE windows_probe_types SET label='negative-control' WHERE id=1",'hms_restored');
  assert.notDeepEqual(snapshot('hms_restored'),before);
  sql("UPDATE windows_probe_types SET label='اختبار ترميز وهمي' WHERE id=1",'hms_restored');
  assert.deepEqual(snapshot('hms_restored'),before);
  assert.deepEqual(snapshot('hms_roundtrip'),before);
  stage('backup-after');
  phase='api';stage('api-before');
  process.env.DATABASE_URL=dburl('hms_restored','hms_runtime',runtimePassword);
  process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
  process.env.HMS_PUBLIC_DEMO='true';
  process.env.HMS_QUALIFICATION_MODE='false';
  process.env.HMS_RATE_LIMIT_IDENTITY='';
  process.env.HMS_TRUSTED_PROXY_ADDRESSES='';
  process.env.FRONTEND_URL='http://127.0.0.1:55774';
  process.env.PORT='55774';
  const jwt=process.env.JWT_SECRET; secrets.push(jwt);
  saveSecrets();
  const {PrismaClient}=require(path.join(appDir,'node_modules','@prisma','client'));
  const cleanup=new PrismaClient({datasources:{db:{url:dburl('hms_restored','hms_cleanup',cleanupPassword)}}});
  try { await cleanup.$executeRawUnsafe('SELECT hms_cleanup_expired_workspaces()'); }
  finally { await cleanup.$disconnect(); }
  const runtime=new PrismaClient();
  let ddlDenied=false;
  try {
    const positive=await runtime.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SELECT set_config('hms.workspace_id','11111111-1111-4111-8111-111111111111',true)");
      return tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM demo_workspaces');
    });
    assert.equal(positive[0].count,1);
    try {await runtime.$executeRawUnsafe('CREATE TABLE public.must_not_exist(id int)');}
    catch(error){ddlDenied=error?.meta?.code==='42501';}
  }
  finally{await runtime.$disconnect();}
  assert.equal(ddlDenied,true);
  const appEnv={...process.env};
  for(const k of Object.keys(appEnv))if(k.startsWith('PG')||k==='HMS_PROBE_HOME')delete appEnv[k];
  app=fork(path.join(base,'app-child.cjs'),[],{cwd:appDir,env:appEnv,stdio:['ignore','ignore','ignore','ipc'],execPath:process.execPath});
  const nextMessage=()=>Promise.race([once(app,'message').then(([m])=>m),new Promise((_,reject)=>setTimeout(()=>reject(Error('IPC timeout')),15000).unref())]);
  const ready=await nextMessage(); assert.equal(ready.type,'ready'); assert.equal(ready.address,'127.0.0.1');
  const url='http://127.0.0.1:'+ready.port;
  const r=await fetch(url+'/api/v1/health',{signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200); assert.deepEqual(await r.json(),{ok:true});
  const workspace=await fetch(url+'/api/v1/demo/start',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
  assert.equal(workspace.status,201);
  const session=await workspace.json(); assert.equal(typeof session.accessToken,'string'); assert.equal(session.user.role,'receptionist');
  secrets.push(session.accessToken);saveSecrets();
  const patients=await fetch(url+'/api/v1/patients',{headers:{Authorization:'Bearer '+session.accessToken},signal:AbortSignal.timeout(5000)});
  assert.equal(patients.status,200);
  stage('api-after');
  phase='close';stage('app-stop-before');
  const closed=nextMessage(); const exited=once(app,'exit'); app.send({type:'close'});
  assert.equal((await closed).type,'closed');
  const [code,signal]=await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Close timeout')),10000).unref())]);
  assert.equal(code,0);assert.equal(signal,null);appClosed=true;
  let refused=false;
  try { await fetch(url+'/api/v1/health',{signal:AbortSignal.timeout(2000)}); } catch {refused=true;}
  assert.equal(refused,true);stage('app-stop-after');
  clearTimeout(timeout);
  const safe={migrations:applied,backupRestore:true,negativeControl:true,sourceUnchanged:true,
    tables:before,emptyTables:[],schemaCatalogCounts:schemaBefore,sequences:sequenceBefore,
    archiveSha256:crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
    apiHealth:true,apiDbEndpoint:true,gracefulAppClose:true,appExitCode:0,listenerAddress:ready.address,runtimeDdlDenied:true};
  const safeText=JSON.stringify(safe);assert.ok(secrets.flatMap(v=>[v,encodeURIComponent(v)]).every(v=>!safeText.includes(v)));
  fs.rmSync(archive);assert.equal(fs.existsSync(archive),false);
  fs.writeFileSync(path.join(home,'roundtrip-result.json'),safeText);
})().catch(() => {
  try{fs.writeFileSync(path.join(home,'helper-failure.json'),JSON.stringify({phase}));}catch{}
  // Force termination is cleanup only, never a graceful-close pass.
  if(app&&!appClosed)app.kill();
  clearTimeout(timeout);
  try{fs.rmSync(path.join(home,'fictional-roundtrip.dump'),{force:true});}catch{}
  process.exitCode=21;
});
