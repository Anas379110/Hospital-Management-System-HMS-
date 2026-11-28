import assert from 'node:assert/strict';
import {checkResponse} from './response-contract-check.mjs';

export async function verifyAdmissionResponses({call,tokens,patientId,departmentId,foreignToken,native}) {
 const namedCases=[];
 const verify=(name,route,status,response)=>{assert.equal(response.status,status,name);const schema=status<400?native.paths['/api/v1'+route].post.responses[String(status)].content['application/json'].schema:{$ref:'#/components/schemas/ApiErrorResponseDto'};checkResponse(response.data,schema,native.components.schemas,name);namedCases.push({name,status});return response.data;};
 const doctor=tokens.doctor,nurse=tokens.nurse;
 const beds=(await call('/departments/'+departmentId+'/beds',nurse)).data,bed=beds.find(x=>x.status==='available');assert.ok(bed);
 for(const[name,body]of [['omitted',{}],['null',{dischargeNotes:null}],['string',{dischargeNotes:'Fictional discharge contract'}]]){
  const admission=verify('create before '+name,'/admissions',201,await call('/admissions',nurse,{patientId,bedId:bed.id}));assert.equal(admission.patientId,patientId);assert.equal(admission.bedId,bed.id);assert.equal(admission.dischargedAt,null);assert.equal(admission.dischargeNotes,null);
  verify('occupied conflict '+name,'/admissions',409,await call('/admissions',doctor,{patientId,bedId:bed.id}));
  const discharge=verify('discharge notes '+name,'/admissions/{id}/discharge',201,await call('/admissions/'+admission.id+'/discharge',doctor,body));assert.equal(discharge.id,admission.id);assert.ok(discharge.dischargedAt);assert.equal(discharge.dischargeNotes,body.dischargeNotes??null);
  verify('already discharged '+name,'/admissions/{id}/discharge',409,await call('/admissions/'+admission.id+'/discharge',nurse,{}));
 }
 verify('anonymous create','/admissions',401,await call('/admissions',null,{patientId,bedId:bed.id}));
 verify('invalid patient','/admissions',400,await call('/admissions',nurse,{patientId:null,bedId:bed.id}));
 const missing='00000000-0000-4000-a000-000000000099';verify('missing patient','/admissions',404,await call('/admissions',nurse,{patientId:missing,bedId:bed.id}));verify('missing bed','/admissions',404,await call('/admissions',nurse,{patientId,bedId:missing}));verify('missing admission','/admissions/{id}/discharge',404,await call('/admissions/'+missing+'/discharge',nurse,{}));
 for(const role of Object.keys(tokens).filter(x=>!['doctor','nurse'].includes(x))){verify(role+' create forbidden','/admissions',403,await call('/admissions',tokens[role],{patientId,bedId:bed.id}));verify(role+' discharge forbidden','/admissions/{id}/discharge',403,await call('/admissions/'+missing+'/discharge',tokens[role],{}));}
 const active=verify('create for isolation','/admissions',201,await call('/admissions',nurse,{patientId,bedId:bed.id}));verify('foreign create not found','/admissions',404,await call('/admissions',foreignToken,{patientId,bedId:bed.id}));verify('foreign discharge not found','/admissions/{id}/discharge',404,await call('/admissions/'+active.id+'/discharge',foreignToken,{}));verify('original discharge after isolation rejection','/admissions/{id}/discharge',201,await call('/admissions/'+active.id+'/discharge',nurse,{}));
 return {checkedHttpResponses:namedCases.length,namedCases,scope:'Existing admission scalar create/discharge, nullable notes three forms, current conflicts/auth/errors. No workflow change; no new audit-failure injection.'};
}
