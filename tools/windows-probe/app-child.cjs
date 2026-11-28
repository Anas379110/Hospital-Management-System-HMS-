'use strict';
// Test-only IPC bootstrap. Production main and its signal behavior are unchanged.
const assert=require('node:assert/strict');
const path=require('node:path');
let app, closing=false;
let phase='load';
const deadline=setTimeout(()=>{process.exit(23);},45000);
(async()=>{
  assert.equal(process.platform,'win32');assert.equal(process.env.HMS_PROBE_CI,'1');
  const {createApplication}=require(path.join(__dirname,'deps/dist/app.factory.js'));
  phase='create';
  app=await createApplication({logger:false});
  phase='listen';
  await app.listen(0,'127.0.0.1');
  const address=app.getHttpServer().address();
  assert.equal(address.address,'127.0.0.1');
  process.send({type:'ready',port:address.port,address:address.address});
  process.on('message', async m=>{
    if(m?.type!=='close' || closing)return;
    closing=true;
    try{await app.close();clearTimeout(deadline);process.send({type:'closed'});process.disconnect();}
    catch{process.exitCode=24;process.disconnect();}
  });
})().catch(()=>{
  clearTimeout(deadline);process.exitCode=22;
  if(process.connected)process.send({type:'startup-failed',phase},()=>process.disconnect());
});
