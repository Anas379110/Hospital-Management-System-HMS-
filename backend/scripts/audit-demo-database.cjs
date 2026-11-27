// DATABASE_URL is injected securely by the deployment operator. Never log it.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
(async()=>{const u=new URL(process.env.DATABASE_URL);if(u.searchParams.get('sslmode')!=='verify-full'||!fs.existsSync(u.searchParams.get('sslcert')||''))throw Error('strict TLS');const p=new PrismaClient();try{
 const sql=fs.readFileSync(path.join(__dirname,'../prisma/demo/supabase-audit.sql'),'utf8');
 const identity=await p.$queryRawUnsafe("SELECT current_user AS role,current_database() AS database,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl");
 if(identity[0]?.role!=='postgres'||identity[0]?.ssl!==true)throw Error('identity');
 await p.$executeRawUnsafe(sql);
 const status=await p.$queryRawUnsafe(fs.readFileSync(path.join(__dirname,'../prisma/demo/cleanup-status.sql'),'utf8'));
 if(status[0]?.healthy!==true)throw Error('scheduled cleanup unavailable or stale');
 console.log(JSON.stringify({scheduledCleanup:status[0]}));
 console.log(JSON.stringify({at:new Date().toISOString(),projectRef:decodeURIComponent(u.username).split('.').slice(1).join('.')||'local',...identity[0],audit:'passed'}));
 console.log('HMS post-migration database audit passed');
}finally{await p.$disconnect()}})().catch(()=>{console.error('HMS post-migration database audit failed. Keep public traffic disabled.');process.exitCode=1});
