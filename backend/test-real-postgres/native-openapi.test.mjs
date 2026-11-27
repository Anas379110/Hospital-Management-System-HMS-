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
const responseSchemas=['PatientIdentityResponseDto','PatientResponseDto','WaitlistRequestResponseDto','WaitlistItemResponseDto','WaitlistPageResponseDto','ApiErrorResponseDto','ApiErrorDetailResponseDto','PrescriptionResponseDto','EncounterResponseDto','EncounterWithPrescriptionsResponseDto','TestOrderResponseDto','PendingTestOrderResponseDto','TestPatientIdentityResponseDto','OrderingUserIdentityResponseDto'];
const fields=['type','format','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','nullable','pattern','not'];
function compareProperties(actual,expected,label){
 assert.deepEqual(Object.keys(actual.properties).sort(),Object.keys(expected.properties).sort(),label+' fields');
 assert.deepEqual([...(actual.required??[])].sort(),[...(expected.required??[])].sort(),label+' required');
 for(const [name,e]of Object.entries(expected.properties)){const a=actual.properties[name];for(const key of [...fields,'items'])assert.deepEqual(a[key],e[key],label+'.'+name+'.'+key);}
}
test('all native request DTO fields/required/constraints match independent validators',()=>{
 assert.deepEqual(Object.keys(reference.components.schemas).filter(k=>!native.components.schemas[k]).sort(),['FindAppointmentsDto','OverviewRangeDto','SearchUsersDto','WaitlistPageDto']);
 assert.deepEqual(Object.keys(native.components.schemas).filter(k=>!reference.components.schemas[k]).sort(),[...responseSchemas].sort());
 assert.equal(Object.keys(native.components.schemas).length,42);
 for(const [name,actual]of Object.entries(native.components.schemas).filter(([name])=>!responseSchemas.includes(name))){assert.ok(Object.keys(actual.properties).length,name+' not empty');compareProperties(actual,reference.components.schemas[name],name);}
});
test('all55native controller operations have correct roles, security and codes',()=>{
 assert.equal(Object.values(native.paths).reduce((n,x)=>n+Object.keys(x).length,0),55);
 for(const row of inventory){const op=native.paths['/api/v1'+row.path][row.method.toLowerCase()],ref=reference.paths[row.path][row.method.toLowerCase()];assert.ok(op,row.path);assert.deepEqual(op['x-roles'],row.roles);const jwt=row.guards.includes('JwtAuthGuard');assert.deepEqual(op.security??[],jwt?[{bearer:[]}]:[]);assert.equal(op['x-auth'],row.roles.length?'roles':jwt?'any-authenticated-user':'public');assert.deepEqual(Object.keys(op.responses).sort(),Object.keys(ref.responses).sort(),row.path+' response codes');assert.equal(Boolean(op.requestBody),Boolean(ref.requestBody),row.path+' body');if(ref.requestBody)assert.deepEqual(op.requestBody,ref.requestBody,row.path+' body schema');assert.deepEqual(op.parameters.filter(p=>p.in==='path').sort((a,b)=>a.name.localeCompare(b.name)),(ref.parameters??[]).filter(p=>p.in==='path').sort((a,b)=>a.name.localeCompare(b.name)),row.path+' path parameters');}
});
test('explicit query bounds, optional force and current default semantics are not lost',()=>{
 for(const row of inventory){const actual=native.paths['/api/v1'+row.path][row.method.toLowerCase()],ref=reference.paths[row.path][row.method.toLowerCase()];for(const e of(ref.parameters??[]).filter(x=>x.in==='query')){const a=actual.parameters.find(x=>x.in==='query'&&x.name===e.name);assert.ok(a,row.path+':'+e.name);assert.equal(a.required,e.required);for(const key of fields)assert.deepEqual(a.schema[key],e.schema[key],row.path+':'+e.name+':'+key);}}
});
test('only explicitly scoped existing patient and waitlist payloads get response contracts',()=>{
 const successes={
 '/api/v1/encounters:post:201':['EncounterResponseDto',false],'/api/v1/encounters/{id}:get:200':['EncounterWithPrescriptionsResponseDto',false],'/api/v1/encounters/{id}:delete:200':['EncounterResponseDto',false],'/api/v1/encounters/{id}/prescriptions:post:201':['PrescriptionResponseDto',false],'/api/v1/patients/{id}/records:get:200':['EncounterWithPrescriptionsResponseDto',true],'/api/v1/test-orders:post:201':['TestOrderResponseDto',false],'/api/v1/test-orders/pending:get:200':['PendingTestOrderResponseDto',true],'/api/v1/test-orders/{id}/result:post:201':['TestOrderResponseDto',false],'/api/v1/patients/{id}/test-results:get:200':['TestOrderResponseDto',true],
 '/api/v1/patients:post:201':['PatientResponseDto',false],'/api/v1/patients:get:200':['PatientResponseDto',true],
 '/api/v1/patients/billing-lookup:get:200':['PatientIdentityResponseDto',true],'/api/v1/patients/{id}:get:200':['PatientResponseDto',false],'/api/v1/patients/{id}:patch:200':['PatientResponseDto',false],
 '/api/v1/departments/{departmentId}/waitlist:get:200':['WaitlistPageResponseDto',false],'/api/v1/departments/{departmentId}/waitlist:post:201':['WaitlistRequestResponseDto',false],'/api/v1/departments/{departmentId}/waitlist/{id}/cancel:post:201':['WaitlistRequestResponseDto',false]};
 let count=0;for(const [path,methods]of Object.entries(native.paths))for(const[method,op]of Object.entries(methods))for(const[code,response]of Object.entries(op.responses)){
 const target=successes[path+':'+method+':'+code];if(target){count++;assert.deepEqual(response.content['application/json'].schema,target[1]?{type:'array',items:{$ref:'#/components/schemas/'+target[0]}}:{$ref:'#/components/schemas/'+target[0]});}
 else if(response.content){assert.ok((path.startsWith('/api/v1/patients')||path.includes('/waitlist'))&&Number(code)>=400);assert.deepEqual(response.content['application/json'].schema,{$ref:'#/components/schemas/ApiErrorResponseDto'});}
 }
 assert.equal(count,17);const schemas=native.components.schemas;assert.deepEqual(Object.keys(schemas.PatientIdentityResponseDto.properties).sort(),['fullName','id','mrn']);assert.deepEqual([...schemas.PatientResponseDto.required].sort(),Object.keys(schemas.PatientResponseDto.properties).sort());assert.equal(schemas.PatientResponseDto.properties.nationalId.nullable,true);assert.equal(schemas.PatientResponseDto.properties.dateOfBirth.format,'date-time');assert.deepEqual(schemas.WaitlistItemResponseDto.properties.status.enum,['pending']);assert.equal(schemas.WaitlistPageResponseDto.properties.items.maxItems,100);
});
test('clinical nested projection shapes and nullable scalar histories stay distinct',()=>{
 const s=native.components.schemas;assert.deepEqual(s.EncounterWithPrescriptionsResponseDto.properties.prescriptions,{type:'array',items:{$ref:'#/components/schemas/PrescriptionResponseDto'}});
 assert.equal(s.EncounterResponseDto.properties.prescriptions,undefined);assert.equal(s.EncounterResponseDto.properties.notes.nullable,true);assert.equal(s.EncounterResponseDto.properties.deletedAt.nullable,true);assert.equal(s.EncounterResponseDto.properties.deletedAt.format,'date-time');
 assert.deepEqual(s.PrescriptionResponseDto.properties.status.enum,['pending','dispensed','unavailable']);assert.deepEqual(s.TestOrderResponseDto.properties.status.enum,['pending','completed','cancelled']);assert.deepEqual(s.TestOrderResponseDto.properties.testType.enum,['lab','radiology']);
 assert.equal(s.PrescriptionResponseDto.properties.quantityDispensed.nullable,true);assert.equal(s.TestOrderResponseDto.properties.completedBy.nullable,true);assert.equal(s.PendingTestOrderResponseDto.properties.patient.$ref,'#/components/schemas/TestPatientIdentityResponseDto');assert.deepEqual(Object.keys(s.TestPatientIdentityResponseDto.properties).sort(),['fullName','mrn']);assert.deepEqual(Object.keys(s.OrderingUserIdentityResponseDto.properties),['fullName']);
 for(const name of ['EncounterResponseDto','EncounterWithPrescriptionsResponseDto','PrescriptionResponseDto','TestOrderResponseDto','PendingTestOrderResponseDto'])assert.deepEqual([...s[name].required].sort(),Object.keys(s[name].properties).sort(),name+' complete scalar/projection shape');
});
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
test('snapshot generation or drift check runs after prior contract assertions',()=>{assert.equal(contractFailed,false,'prior contract assertions must pass before snapshot write');if(process.argv.includes('--snapshot'))writeFileSync(root+'docs/api/native-openapi.json',JSON.stringify(sorted(native),null,2)+'\n');else assert.deepEqual(JSON.parse(readFileSync(root+'docs/api/native-openapi.json','utf8')),sorted(native));});
