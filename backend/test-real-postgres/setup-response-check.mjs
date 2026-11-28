import assert from 'node:assert/strict';
import {checkResponse} from './response-contract-check.mjs';

export async function verifySetupResponses({call,tokens,patientId,foreignToken,native}) {
 const namedCases=[],missing='00000000-0000-4000-a000-000000000099',admin=tokens.admin;
 const verify=(name,route,method,status,r)=>{assert.equal(r.status,status,name);const schema=status<400?native.paths['/api/v1'+route][method.toLowerCase()].responses[String(status)].content['application/json'].schema:{$ref:'#/components/schemas/ApiErrorResponseDto'};checkResponse(r.data,schema,native.components.schemas,name);namedCases.push({name,status});return r.data;};
 const names={nameAr:'قسم عقود خيالي',nameEn:'Fictional Setup Contract'};
 const dept=verify('create department','/departments','POST',201,await call('/departments',admin,names));assert.equal(dept.totalBeds,0);assert.equal(dept.nameEn,names.nameEn);
 const path='/departments/'+dept.id,bed=verify('create bed','/departments/{id}/beds','POST',201,await call(path+'/beds',admin,{bedNumber:'SETUP-CONTRACT'}));assert.equal(bed.status,'available');assert.equal(bed.departmentId,dept.id);
 const renamed=verify('rename department','/departments/{id}','PATCH',200,await call(path,admin,{...names,nameEn:'Fictional Renamed Contract'},'PATCH'));assert.equal(renamed.id,dept.id);assert.equal(renamed.nameEn,'Fictional Renamed Contract');assert.equal(renamed.totalBeds,1);
 const bedPath=path+'/beds/'+bed.id;
 const relabeled=verify('rename bed','/departments/{id}/beds/{bedId}','PATCH',200,await call(bedPath,admin,{bedNumber:'RENAMED-CONTRACT'},'PATCH'));assert.equal(relabeled.id,bed.id);assert.equal(relabeled.bedNumber,'RENAMED-CONTRACT');
 const maintained=verify('maintenance bed','/departments/{id}/beds/{bedId}/maintenance','PATCH',200,await call(bedPath+'/maintenance',admin,{status:'maintenance'},'PATCH'));assert.equal(maintained.status,'maintenance');
 verify('available bed','/departments/{id}/beds/{bedId}/maintenance','PATCH',200,await call(bedPath+'/maintenance',admin,{status:'available'},'PATCH'));
 const routes=[['/departments','/departments','POST',names],['/departments/{id}',path,'PATCH',names],['/departments/{id}',path,'DELETE',null],['/departments/{id}/beds',path+'/beds','POST',{bedNumber:'DENIED'}],['/departments/{id}/beds/{bedId}',bedPath,'PATCH',{bedNumber:'DENIED'}],['/departments/{id}/beds/{bedId}/maintenance',bedPath+'/maintenance','PATCH',{status:'maintenance'}],['/departments/{id}/beds/{bedId}',bedPath,'DELETE',null]];
 for(const[route,url,method,body]of routes){verify('anonymous '+route+method,route,method,401,await call(url,null,body,method));for(const[role,token]of Object.entries(tokens).filter(([r])=>r!=='admin'))verify(role+' denied '+route+method,route,method,403,await call(url,token,body,method));}
 verify('invalid department','/departments','POST',400,await call('/departments',admin,{...names,nameEn:null}));
 verify('bad department UUID','/departments/{id}','PATCH',400,await call('/departments/bad',admin,names,'PATCH'));
 verify('invalid bed','/departments/{id}/beds','POST',400,await call(path+'/beds',admin,{bedNumber:null}));
 verify('invalid maintenance','/departments/{id}/beds/{bedId}/maintenance','PATCH',400,await call(bedPath+'/maintenance',admin,{status:'occupied'},'PATCH'));
 verify('duplicate bed','/departments/{id}/beds','POST',409,await call(path+'/beds',admin,{bedNumber:'RENAMED-CONTRACT'}));
 for(const[route,url,method,body]of routes.slice(1)){const absent=url.replace(dept.id,missing);verify('missing '+route+method,route,method,404,await call(absent,admin,body,method));}
 const foreignAdmin=await call('/demo/role',foreignToken,{role:'admin'});assert.equal(foreignAdmin.status,201);
 for(const[route,url,method,body]of routes.slice(1))verify('foreign '+route+method,route,method,404,await call(url,foreignAdmin.data.accessToken,body,method));
 const admission=await call('/admissions',tokens.nurse,{patientId,bedId:bed.id});assert.equal(admission.status,201);
 verify('occupied maintenance','/departments/{id}/beds/{bedId}/maintenance','PATCH',409,await call(bedPath+'/maintenance',admin,{status:'maintenance'},'PATCH'));
 verify('occupied delete','/departments/{id}/beds/{bedId}','DELETE',409,await call(bedPath,admin,null,'DELETE'));
 const occupied=verify('occupied relabel preserved','/departments/{id}/beds/{bedId}','PATCH',200,await call(bedPath,admin,{bedNumber:'OCCUPIED-CONTRACT'},'PATCH'));assert.equal(occupied.status,'occupied');
 assert.equal((await call('/admissions/'+admission.data.id+'/discharge',tokens.nurse,{})).status,201);
 verify('history bed delete','/departments/{id}/beds/{bedId}','DELETE',409,await call(bedPath,admin,null,'DELETE'));
 verify('linked department delete','/departments/{id}','DELETE',409,await call(path,admin,null,'DELETE'));
 const free=verify('create unused bed','/departments/{id}/beds','POST',201,await call(path+'/beds',admin,{bedNumber:'UNUSED-CONTRACT'}));const deleted=verify('delete unused bed','/departments/{id}/beds/{bedId}','DELETE',200,await call(path+'/beds/'+free.id,admin,null,'DELETE'));assert.deepEqual(deleted,{id:free.id,deleted:true});
 const empty=verify('create empty department','/departments','POST',201,await call('/departments',admin,names));assert.deepEqual(verify('delete empty department','/departments/{id}','DELETE',200,await call('/departments/'+empty.id,admin,null,'DELETE')),{id:empty.id,deleted:true});
 return {checkedHttpResponses:namedCases.length,namedCases,scope:'Seven existing Admin setup success projections and current auth/error/isolation. Literal true deletion asserted in HTTP; native schema is boolean. No service/schema/role/policy change or new audit/concurrency claim.'};
}
