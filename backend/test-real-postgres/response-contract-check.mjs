import assert from 'node:assert/strict';

/** Deliberately small OpenAPI3 subset for the explicitly scoped response DTOs. */
export function checkResponse(value,schema,schemas,path='$') {
 if(schema.$ref){const name=schema.$ref.replace('#/components/schemas/','');assert.ok(schemas[name],path+' missing ref');return checkResponse(value,schemas[name],schemas,path);}
 if(value===null){assert.equal(schema.nullable,true,path+' unexpected null');return;}
 if(schema.enum)assert.ok(schema.enum.includes(value),path+' enum');
 if(!schema.type)return;
 if(schema.type==='object'){
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),path+' object');
  for(const key of schema.required??[])assert.ok(Object.hasOwn(value,key),path+'.'+key+' required');
  for(const[key,item]of Object.entries(value)){assert.ok(schema.properties?.[key],path+'.'+key+' undocumented field');checkResponse(item,schema.properties[key],schemas,path+'.'+key);}
 }else if(schema.type==='array'){
  assert.ok(Array.isArray(value),path+' array');if(schema.maxItems!==undefined)assert.ok(value.length<=schema.maxItems,path+' maxItems');for(const[item,index]of value.map((x,i)=>[x,i]))checkResponse(item,schema.items,schemas,path+'['+index+']');
 }else if(schema.type==='integer')assert.ok(Number.isInteger(value),path+' integer');
 else assert.equal(typeof value,schema.type,path+' type');
 if(schema.minimum!==undefined)assert.ok(value>=schema.minimum,path+' minimum');if(schema.maximum!==undefined)assert.ok(value<=schema.maximum,path+' maximum');
 if(schema.format==='uuid')assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,path+' uuid');
 if(schema.format==='date-time'){assert.equal(typeof value,'string');assert.match(value,/^\d{4}-\d{2}-\d{2}T/);assert.ok(Number.isFinite(Date.parse(value)),path+' date-time');}
}

export async function verifyPatientWaitlistResponses({call,tokens,departmentId,native}) {
 const schemas=native.components.schemas;let verified=0;
 const verify=(path,method,status,response)=>{assert.equal(response.status,status,path);const schema=native.paths['/api/v1'+path.replace(/\/departments\/[^/]+\//,'/departments/{departmentId}/').replace(/\/waitlist\/[^/]+\/cancel$/,'/waitlist/{id}/cancel').replace(/^\/patients\/[^/]+$/,(p)=>p==='/patients/billing-lookup'?p:'/patients/{id}')][method].responses[String(status)].content['application/json'].schema;checkResponse(response.data,schema,schemas,path);verified++;return response.data;};
 const admin=tokens.admin,nurse=tokens.nurse,reception=tokens.receptionist;
 const data={fullName:'Fictional Response Contract',dateOfBirth:'1990-01-01',gender:'male',phone:'0000000000'};
 const created=verify('/patients','post',201,await call('/patients',reception,data));assert.equal(created.nationalId,null);assert.equal(created.emergencyContactName,null);
 verify('/patients/'+created.id,'get',200,await call('/patients/'+created.id,admin));
 verify('/patients','get',200,await call('/patients?search=Fictional%20Response%20Contract',nurse));
 const billing=verify('/patients/billing-lookup','get',200,await call('/patients/billing-lookup?search=Fictional',tokens.billing_clerk));assert.ok(billing.length);for(const row of billing)assert.deepEqual(Object.keys(row).sort(),['fullName','id','mrn']);
 const updated=verify('/patients/'+created.id,'patch',200,await call('/patients/'+created.id,reception,{address:'Fictional address',nationalId:'FAKE-CONTRACT'} ,'PATCH'));assert.equal(updated.address,'Fictional address');
 const cleared=verify('/patients/'+created.id,'patch',200,await call('/patients/'+created.id,reception,{address:null,nationalId:null},'PATCH'));assert.equal(cleared.address,null);assert.equal(cleared.nationalId,null);
 verify('/patients','post',409,await call('/patients',reception,data));
 verify('/patients','post',400,await call('/patients',reception,{...data,fullName:null}));
 verify('/patients','post',401,await call('/patients',null,data));
 verify('/patients','post',403,await call('/patients',nurse,data));
 verify('/patients/00000000-0000-4000-a000-000000000099','get',404,await call('/patients/00000000-0000-4000-a000-000000000099',admin));
 const path='/departments/'+departmentId+'/waitlist';
 const request=verify(path,'post',201,await call(path,nurse,{patientId:created.id}));assert.equal(request.status,'pending');assert.equal(request.closedAt,null);assert.equal(request.closedBy,null);assert.equal(request.admissionId,null);
 const listed=verify(path,'get',200,await call(path,nurse));const item=listed.items.find(x=>x.patient.id===created.id);assert.ok(item);assert.deepEqual(Object.keys(item).sort(),['departmentId','id','patient','requestedAt','status']);assert.deepEqual(Object.keys(item.patient).sort(),['fullName','id','mrn']);
 const cancelled=verify(path+'/'+request.id+'/cancel','post',201,await call(path+'/'+request.id+'/cancel',tokens.doctor,{}));assert.equal(cancelled.status,'cancelled');assert.ok(cancelled.closedAt&&cancelled.closedBy);assert.equal(cancelled.admissionId,null);
 verify(path+'/'+request.id+'/cancel','post',409,await call(path+'/'+request.id+'/cancel',nurse,{}));
 verify(path,'get',403,await call(path,admin));verify(path,'get',401,await call(path,null));
 return {checkedHttpResponses:verified,scope:'Existing patient scalar/billing identity and waitlist list/write success plus error envelopes; no serializer or audience change'};
}
