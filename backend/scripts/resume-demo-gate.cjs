// Run with traffic disabled after provider recovery. No state-changing provider calls.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const fail=()=>{throw Error('Resume gate failed')};
function run(script,env){const r=spawnSync(process.execPath,[path.join(__dirname,script)],{env:{...process.env,...env},encoding:'utf8'});if(r.status!==0)fail();}
function plaintext(url){return new Promise((resolve,reject)=>{
 const u=new URL(url),fields=Buffer.from('user\0'+decodeURIComponent(u.username)+'\0database\0'+u.pathname.slice(1)+'\0\0');
 const b=Buffer.alloc(8+fields.length);b.writeInt32BE(b.length);b.writeInt32BE(196608,4);fields.copy(b,8);
 let data=Buffer.alloc(0),done=false;const s=net.connect(Number(u.port||5432),u.hostname,()=>s.write(b));
 const end=(ok)=>{if(done)return;done=true;s.destroy();ok?resolve({at:new Date().toISOString(),identity:decodeURIComponent(u.username).split('.')[0],endpoint:u.hostname,port:Number(u.port||5432),passwordSent:false,result:'ESSLREQUIRED',passed:true}):reject(Error('plaintext not refused'));};
 s.setTimeout(10000,()=>end(false));s.on('error',()=>end(false));s.on('data',d=>{data=Buffer.concat([data,d]);if(data.length<5)return;const len=data.readInt32BE(1);if(data.length<1+len)return;end(data[0]===69&&data.subarray(5,1+len).toString().includes('ESSLREQUIRED'));});
});}
(async()=>{
 if(process.env.HMS_TRAFFIC_DISABLED!=='true'||!process.env.HMS_RESUME_CONTROL_WORKSPACE?.match(/^[a-f0-9-]{36}$/))fail();
 const owner=process.env.HMS_OWNER_DATABASE_URL,runtime=process.env.HMS_RUNTIME_DATABASE_URL;
 if(!owner||!runtime||!process.env.HMS_CLEANUP_DATABASE_URL)fail();
 const probes=[];for(const url of [owner,runtime,process.env.HMS_CLEANUP_DATABASE_URL]){const u=new URL(url);if(u.searchParams.get('sslmode')!=='verify-full'||!fs.existsSync(u.searchParams.get('sslcert')||''))fail();probes.push(await plaintext(url));}
 run('audit-demo-database.cjs',{DATABASE_URL:owner});
 run('cleanup-demo-database.cjs',{});
 const p=new PrismaClient({datasources:{db:{url:owner}}});try{
 await require('./resume-state.cjs')(p,process.env.HMS_RESUME_CONTROL_WORKSPACE);
 }finally{await p.$disconnect()}
 process.env.DATABASE_URL=runtime;process.env.HMS_PUBLIC_DEMO='true';
 const {PrismaService}=require('../dist/src/prisma/prisma.service.js');const r=new PrismaService();try{await r.onModuleInit()}finally{await r.$disconnect()}
 console.log(JSON.stringify({at:new Date().toISOString(),resumeGate:'passed',probes,plaintextRefused:true,runtimeTls:true,expiredRemaining:0,liveControlSurvived:true,scheduledCleanupFresh:true}));
 // Success is evidence for an operator, not an automatic public binding action.
})().catch(()=>{console.error('Resume gate failed. Public traffic must stay disabled.');process.exitCode=1});
