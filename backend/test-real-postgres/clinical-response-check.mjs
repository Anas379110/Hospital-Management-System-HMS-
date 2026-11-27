import assert from 'node:assert/strict';
import {checkResponse} from './response-contract-check.mjs';

export async function verifyClinicalResponses({call,tokens,patientId,native}) {
 let checked=0;
 const verify=(route,method,status,response)=>{assert.equal(response.status,status,route);const schema=status<400?native.paths['/api/v1'+route][method].responses[String(status)].content['application/json'].schema:{$ref:'#/components/schemas/ApiErrorResponseDto'};checkResponse(response.data,schema,native.components.schemas,route);checked++;return response.data;};
 const doctor=tokens.doctor,nurse=tokens.nurse,tech=tokens.lab_tech;
 const encounter=verify('/encounters','post',201,await call('/encounters',doctor,{patientId,chiefComplaint:'Fictional contract complaint',diagnosis:'Fictional contract diagnosis'}));assert.equal(encounter.appointmentId,null);assert.equal(encounter.notes,null);assert.equal(encounter.deletedAt,null);
 verify('/encounters','post',401,await call('/encounters',null,{patientId,chiefComplaint:'Fictional complaint',diagnosis:'Fictional diagnosis'}));
 verify('/encounters','post',400,await call('/encounters',doctor,{patientId,chiefComplaint:null,diagnosis:'Fictional diagnosis'}));
 const prescription=verify('/encounters/{id}/prescriptions','post',201,await call('/encounters/'+encounter.id+'/prescriptions',doctor,{medicationName:'Fictional contract medicine',dosage:'Fictional dose',duration:'Fictional duration'}));assert.equal(prescription.notes,null);assert.equal(prescription.dispensedAt,null);assert.equal(prescription.quantityDispensed,null);
 const detail=verify('/encounters/{id}','get',200,await call('/encounters/'+encounter.id,nurse));assert.ok(detail.prescriptions.some(x=>x.id===prescription.id));
 const records=verify('/patients/{id}/records','get',200,await call('/patients/'+patientId+'/records',doctor));assert.ok(records.some(x=>x.id===encounter.id&&x.prescriptions.some(y=>y.id===prescription.id)));
 const order=verify('/test-orders','post',201,await call('/test-orders',doctor,{patientId,encounterId:encounter.id,testType:'lab',testName:'Fictional contract test'}));assert.equal(order.result,null);assert.equal(order.completedAt,null);
 const pending=verify('/test-orders/pending','get',200,await call('/test-orders/pending',tech));const item=pending.find(x=>x.id===order.id);assert.ok(item);assert.deepEqual(Object.keys(item.patient).sort(),['fullName','mrn']);assert.deepEqual(Object.keys(item.orderedByUser),['fullName']);
 const result=verify('/test-orders/{id}/result','post',201,await call('/test-orders/'+order.id+'/result',tech,{result:'Fictional result'}));assert.equal(result.status,'completed');assert.equal(result.resultNotes,null);assert.ok(result.completedAt&&result.completedBy);
 const radiology=verify('/test-orders','post',201,await call('/test-orders',doctor,{patientId,encounterId:encounter.id,testType:'radiology',testName:'Fictional imaging contract'}));assert.equal(radiology.testType,'radiology');
 const radiologyResult=verify('/test-orders/{id}/result','post',201,await call('/test-orders/'+radiology.id+'/result',tech,{result:'Fictional imaging result',resultNotes:'Fictional imaging notes'}));assert.equal(radiologyResult.resultNotes,'Fictional imaging notes');
 const results=verify('/patients/{id}/test-results','get',200,await call('/patients/'+patientId+'/test-results',nurse));assert.ok(results.some(x=>x.id===order.id));
 verify('/test-orders/{id}/result','post',409,await call('/test-orders/'+order.id+'/result',tech,{result:'Fictional second result'}));
 verify('/encounters','post',403,await call('/encounters',nurse,{patientId,chiefComplaint:'Fictional invalid actor',diagnosis:'Fictional diagnosis'}));
 verify('/patients/{id}/records','get',403,await call('/patients/'+patientId+'/records',tokens.receptionist));
 const missing='00000000-0000-4000-a000-000000000099';verify('/encounters/{id}','get',404,await call('/encounters/'+missing,doctor));
 verify('/patients/{id}/test-results','get',200,await call('/patients/'+missing+'/test-results',tech));
 const other=await call('/demo/start',null,{});assert.equal(other.status,201);const otherDoctor=(await call('/demo/role',other.data.accessToken,{role:'doctor'})).data.accessToken;
 verify('/encounters/{id}','get',404,await call('/encounters/'+encounter.id,otherDoctor));assert.equal((await call('/patients/'+patientId+'/test-results',otherDoctor)).data.length,0);
 const deleted=verify('/encounters/{id}','delete',200,await call('/encounters/'+encounter.id,doctor,{reason:'Fictional contract soft delete'},'DELETE'));assert.ok(deleted.deletedAt);assert.equal(deleted.deleteReason,'Fictional contract soft delete');
 verify('/encounters/{id}','get',404,await call('/encounters/'+encounter.id,doctor));
 const after=verify('/patients/{id}/records','get',200,await call('/patients/'+patientId+'/records',nurse));assert.ok(!after.some(x=>x.id===encounter.id));
 const retained=verify('/patients/{id}/test-results','get',200,await call('/patients/'+patientId+'/test-results',tech));assert.ok(retained.some(x=>x.id===order.id),'existing completed test history retained after encounter soft delete');
 return {checkedHttpResponses:checked,scope:'Existing encounter/prescription/nested record/test-order/pending identity/result payloads and current auth/error/isolation/deletion semantics, no new clinical behavior'};
}
