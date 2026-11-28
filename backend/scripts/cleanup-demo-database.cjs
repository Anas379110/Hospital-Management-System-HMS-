// Manual quarantined-resume cleanup only. Never use the owner URL here.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
(async()=>{const url=process.env.HMS_CLEANUP_DATABASE_URL;if(!url)throw Error('missing cleanup URL');
 const u=new URL(url);if(u.searchParams.get('sslmode')!=='verify-full'||!fs.existsSync(u.searchParams.get('sslcert')||''))throw Error('strict TLS required');
 const p=new PrismaClient({datasources:{db:{url}}});try{
 const ssl=await p.$queryRawUnsafe('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');if(ssl[0]?.ssl!==true)throw Error('TLS required');
 await p.$executeRawUnsafe(fs.readFileSync(path.join(__dirname,'../prisma/demo/cleanup-selfcheck.sql'),'utf8'));
 await p.$queryRawUnsafe('SELECT public.hms_cleanup_expired_workspaces()');
 console.log(JSON.stringify({at:new Date().toISOString(),cleanup:'passed',role:'hms_cleanup',tls:true}));
 }finally{await p.$disconnect()}
})().catch(()=>{console.error('Restricted cleanup failed. Keep public traffic disabled.');process.exitCode=1});
