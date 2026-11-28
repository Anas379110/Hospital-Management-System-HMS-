// Isolated dependency compatibility test, not a new HMS upload endpoint.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const express=require('express'),multer=require('multer');
const app=express();
app.post('/probe',multer({storage:multer.memoryStorage(),limits:{fileSize:1024,files:1}}).single('file'),(req,res)=>res.json({bytes:req.file?.size}));
app.use((error,req,res,next)=>res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({code:error.code??'MULTIPART_INVALID'}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin='http://127.0.0.1:'+server.address().port;const results={scope:'isolated Express/multer in-memory compatibility probe, not public HMS upload coverage',version:require('multer/package.json').version};
try{
 const form=new FormData();form.append('file',new Blob(['fictional data']),'fictional.txt');
 const valid=await fetch(origin+'/probe',{method:'POST',body:form});const body=await valid.json();if(valid.status!==200||body.bytes!==14)throw new Error('valid multipart failed');
 const large=new FormData();large.append('file',new Blob(['x'.repeat(2048)]),'fictional.txt');const oversized=await fetch(origin+'/probe',{method:'POST',body:large});if(oversized.status!==413)throw new Error('multipart file limit failed');
 const malformed=await fetch(origin+'/probe',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=fictional'},body:'--fictional\r\ninvalid'});if(malformed.status!==400)throw new Error('malformed multipart failed');
 Object.assign(results,{validStatus:200,validBytes:14,oversizedStatus:413,malformedStatus:400,assertionsPassed:true});
}finally{server.close();writeFileSync(process.env.HMS_MULTIPART_REPORT??'multipart-smoke.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))}
