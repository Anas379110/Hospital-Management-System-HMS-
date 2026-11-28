import assert from 'node:assert/strict';
import {checkResponse} from './response-contract-check.mjs';

export async function verifyPharmacyResponses({call,tokens,patientId,native}) {
 const namedCases=[];
 const verify=(name,route,method,status,response)=>{assert.equal(response.status,status,name);const schema=status<400?native.paths['/api/v1'+route][method].responses[String(status)].content['application/json'].schema:{$ref:'#/components/schemas/ApiErrorResponseDto'};checkResponse(response.data,schema,native.components.schemas,name);namedCases.push({name,status});return response.data;};
 const pharmacist=tokens.pharmacist,admin=tokens.admin,doctor=tokens.doctor;
 const medication=verify('create scalar','/medications','post',201,await call('/medications',pharmacist,{name:'Fictional contract inventory',unit:'tablet',currentStock:8,reorderThreshold:10}));
 const list=verify('inventory list','/medications','get',200,await call('/medications',admin));assert.ok(list.some(x=>x.id===medication.id));
 const low=verify('low stock list','/medications/low-stock','get',200,await call('/medications/low-stock',pharmacist));assert.ok(low.some(x=>x.id===medication.id));
 for(const [name,reason,hasReason]of [['reason omitted',undefined,false],['reason null',null,true],['reason string','Fictional restock',true]]){
  const body={delta:1,reasonCode:'restock',...(hasReason?{reason}:{})};const adjusted=verify(name,'/medications/{id}/stock','patch',200,await call('/medications/'+medication.id+'/stock',pharmacist,body,'PATCH'));assert.equal(Object.hasOwn(adjusted,'adjustmentReason'),hasReason);if(hasReason)assert.equal(adjusted.adjustmentReason,reason);assert.equal(adjusted.adjustmentDelta,1);
 }
 const encounter=await call('/encounters',doctor,{patientId,chiefComplaint:'Fictional pharmacy contract',diagnosis:'Fictional diagnosis'});assert.equal(encounter.status,201);
 const prescription=await call('/encounters/'+encounter.data.id+'/prescriptions',doctor,{medicationName:'Fictional medicine',dosage:'Fictional dose',duration:'Fictional duration'});assert.equal(prescription.status,201);
 const pending=verify('pending nested projection','/prescriptions/pending','get',200,await call('/prescriptions/pending',pharmacist));const item=pending.find(x=>x.id===prescription.data.id);assert.ok(item);assert.deepEqual(Object.keys(item.encounter).sort(),['doctor','patient']);assert.deepEqual(Object.keys(item.encounter.patient).sort(),['fullName','mrn']);assert.deepEqual(Object.keys(item.encounter.doctor),['fullName']);assert.equal(item.medicationId,null);assert.equal(item.dispensedAt,null);
 const before=(await call('/medications',pharmacist)).data.find(x=>x.id===medication.id).currentStock;
 verify('insufficient stock conflict','/prescriptions/{id}/dispense','post',409,await call('/prescriptions/'+item.id+'/dispense',pharmacist,{medicationId:medication.id,quantityDispensed:before+1}));assert.equal((await call('/medications',pharmacist)).data.find(x=>x.id===medication.id).currentStock,before);assert.ok((await call('/prescriptions/pending',pharmacist)).data.some(x=>x.id===item.id));
 const dispensed=verify('dispensed scalar','/prescriptions/{id}/dispense','post',201,await call('/prescriptions/'+item.id+'/dispense',pharmacist,{medicationId:medication.id,quantityDispensed:2}));assert.equal(dispensed.status,'dispensed');assert.equal(dispensed.quantityDispensed,2);assert.equal(dispensed.medicationId,medication.id);assert.ok(dispensed.dispensedAt&&dispensed.dispensedBy);assert.equal((await call('/medications',pharmacist)).data.find(x=>x.id===medication.id).currentStock,before-2);
 const after=verify('dispensed absent from pending','/prescriptions/pending','get',200,await call('/prescriptions/pending',pharmacist));assert.ok(!after.some(x=>x.id===item.id));
 verify('processed conflict','/prescriptions/{id}/dispense','post',409,await call('/prescriptions/'+item.id+'/dispense',pharmacist,{medicationId:medication.id,quantityDispensed:1}));
 verify('anonymous inventory','/medications','get',401,await call('/medications',null));
 verify('invalid zero stock delta','/medications/{id}/stock','patch',400,await call('/medications/'+medication.id+'/stock',pharmacist,{delta:0},'PATCH'));
 const missing='00000000-0000-4000-a000-000000000099';verify('missing medication','/medications/{id}/stock','patch',404,await call('/medications/'+missing+'/stock',pharmacist,{delta:1},'PATCH'));
 const endpoints=[['/medications','/medications','get',null,'GET'],['/medications/low-stock','/medications/low-stock','get',null,'GET'],['/prescriptions/pending','/prescriptions/pending','get',null,'GET'],['/medications','/medications','post',{name:'Fictional denied',unit:'tablet',currentStock:1},'POST'],['/medications/'+medication.id+'/stock','/medications/{id}/stock','patch',{delta:1},'PATCH'],['/prescriptions/'+item.id+'/dispense','/prescriptions/{id}/dispense','post',{medicationId:medication.id,quantityDispensed:1},'POST']];
 for(const role of Object.keys(tokens).filter(x=>!['admin','pharmacist'].includes(x)))for(const[path,route,method,body,http]of endpoints)verify(role+' forbidden '+method+' '+route,route,method,403,await call(path,tokens[role],body,http));
 const other=await call('/demo/start',null,{});assert.equal(other.status,201);const otherPharmacist=(await call('/demo/role',other.data.accessToken,{role:'pharmacist'})).data.accessToken;
 const foreignList=verify('foreign inventory isolated','/medications','get',200,await call('/medications',otherPharmacist));assert.ok(!foreignList.some(x=>x.id===medication.id));
 verify('foreign stock not found','/medications/{id}/stock','patch',404,await call('/medications/'+medication.id+'/stock',otherPharmacist,{delta:1},'PATCH'));
 verify('foreign prescription not found','/prescriptions/{id}/dispense','post',404,await call('/prescriptions/'+item.id+'/dispense',otherPharmacist,{medicationId:medication.id,quantityDispensed:1}));
 return {checkedHttpResponses:namedCases.length,namedCases,scope:'Existing six pharmacy response payloads, optional null/omitted echoed reason, projections, auth/errors/isolation and stock semantics. No new workflow.'};
}
