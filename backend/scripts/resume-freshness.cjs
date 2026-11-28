const fs=require('node:fs'),path=require('node:path');
module.exports=async function checkCleanupFreshness(p){
 const rows=await p.$queryRawUnsafe(fs.readFileSync(path.join(__dirname,'../prisma/demo/cleanup-status.sql'),'utf8'));
 if(rows.length!==1||rows[0]?.healthy!==true)throw Error('Scheduled cleanup missing, failed or stale');
 return rows[0];
};
