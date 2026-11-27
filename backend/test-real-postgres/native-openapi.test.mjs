// Native Nest annotations versus independent validator/controller reference.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test as nodeTest} from 'node:test';
let contractFailed=false;
const test=(name,fn)=>nodeTest(name,()=>{try{return fn()}catch(error){contractFailed=true;throw error}});
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../../',import.meta.url));
process.env.JWT_SECRET='local-document-contract-only-not-real';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/hms_test_docs';
const {createApplication}=require(root+'backend/dist/src/app.factory');
const {createApiDocument}=require(root+'backend/dist/src/api-documentation');
const app=await createApplication({logger:false});
const native=createApiDocument(app);await app.close();
const reference=JSON.parse(readFileSync(root+'docs/api/openapi.yaml','utf8'));
const inventory=JSON.parse(readFileSync(root+'docs/api/ROUTE-INVENTORY.json','utf8'));
const fields=['type','format','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','nullable','pattern','not'];
function compareProperties(actual,expected,label){
 assert.deepEqual(Object.keys(actual.properties).sort(),Object.keys(expected.properties).sort(),label+' fields');
 assert.deepEqual([...(actual.required??[])].sort(),[...(expected.required??[])].sort(),label+' required');
 for(const [name,e]of Object.entries(expected.properties)){const a=actual.properties[name];for(const key of [...fields,'items'])assert.deepEqual(a[key],e[key],label+'.'+name+'.'+key);}
}
test('all native request DTO fields/required/constraints match independent validators',()=>{
 assert.deepEqual(Object.keys(reference.components.schemas).filter(k=>!native.components.schemas[k]).sort(),['FindAppointmentsDto','OverviewRangeDto','SearchUsersDto']);
 assert.deepEqual(Object.keys(native.components.schemas).filter(k=>!reference.components.schemas[k]),[]);
 assert.equal(Object.keys(native.components.schemas).length,24);
 for(const [name,actual]of Object.entries(native.components.schemas)){assert.ok(Object.keys(actual.properties).length,name+' not empty');compareProperties(actual,reference.components.schemas[name],name);}
});
test('all45native controller operations have correct roles, security and codes',()=>{
 assert.equal(Object.values(native.paths).reduce((n,x)=>n+Object.keys(x).length,0),45);
 for(const row of inventory){const op=native.paths['/api/v1'+row.path][row.method.toLowerCase()],ref=reference.paths[row.path][row.method.toLowerCase()];assert.ok(op,row.path);assert.deepEqual(op['x-roles'],row.roles);const jwt=row.guards.includes('JwtAuthGuard');assert.deepEqual(op.security??[],jwt?[{bearer:[]}]:[]);assert.equal(op['x-auth'],row.roles.length?'roles':jwt?'any-authenticated-user':'public');assert.deepEqual(Object.keys(op.responses).sort(),Object.keys(ref.responses).sort(),row.path+' response codes');assert.equal(Boolean(op.requestBody),Boolean(ref.requestBody),row.path+' body');if(ref.requestBody)assert.deepEqual(op.requestBody,ref.requestBody,row.path+' body schema');assert.deepEqual(op.parameters.filter(p=>p.in==='path'),(ref.parameters??[]).filter(p=>p.in==='path'),row.path+' path parameters');}
});
test('explicit query bounds, optional force and current default semantics are not lost',()=>{
 for(const row of inventory){const actual=native.paths['/api/v1'+row.path][row.method.toLowerCase()],ref=reference.paths[row.path][row.method.toLowerCase()];for(const e of(ref.parameters??[]).filter(x=>x.in==='query')){const a=actual.parameters.find(x=>x.in==='query'&&x.name===e.name);assert.ok(a,row.path+':'+e.name);assert.equal(a.required,e.required);for(const key of fields)assert.deepEqual(a.schema[key],e.schema[key],row.path+':'+e.name+':'+key);}}
});
test('native operation response descriptions do not invent unverified result DTOs',()=>{for(const path of Object.values(native.paths))for(const op of Object.values(path))for(const response of Object.values(op.responses))assert.equal(response.content,undefined)});
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
test('snapshot generation or drift check runs after prior contract assertions',()=>{assert.equal(contractFailed,false,'prior contract assertions must pass before snapshot write');if(process.argv.includes('--snapshot'))writeFileSync(root+'docs/api/native-openapi.json',JSON.stringify(sorted(native),null,2)+'\n');else assert.deepEqual(JSON.parse(readFileSync(root+'docs/api/native-openapi.json','utf8')),sorted(native));});
