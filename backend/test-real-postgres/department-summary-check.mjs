import assert from 'node:assert/strict';
import {checkResponse} from './response-contract-check.mjs';

export async function verifyDepartmentSummaries({call,tokens,patientId,departmentId,foreignToken,native}) {
 const namedCases=[],missing='00000000-0000-4000-a000-000000000099';
 const from='2026-11-28T03:00:00+03:00',to='2026-11-29T03:00:00+03:00';
 const overview='/departments/overview?start='+encodeURIComponent(from)+'&end='+encodeURIComponent(to),summary='/departments/'+departmentId+'/beds/summary';
 const verify=(name,route,status,r)=>{assert.equal(r.status,status,name);const schema=status<400?native.paths['/api/v1'+route].get.responses[String(status)].content['application/json'].schema:{$ref:'#/components/schemas/ApiErrorResponseDto'};checkResponse(r.data,schema,native.components.schemas,name);namedCases.push({name,status});return r.data;};
 const routes=[['/departments','/departments',['receptionist','doctor','nurse','admin','manager']],['/departments/overview',overview,['admin','manager']],['/departments/{id}/beds/summary',summary,['admin','manager']]];
 for(const[route,url,allowed]of routes){
  verify('anonymous '+route,route,401,await call(url,null));
  for(const[role,token]of Object.entries(tokens))verify(role+' '+route,route,allowed.includes(role)?200:403,await call(url,token));
 }
 const initial=verify('initial counts','/departments/{id}/beds/summary',200,await call(summary,tokens.manager));assert.equal(initial.total,initial.available+initial.occupied+initial.maintenance);
 const departments=verify('list identity only','/departments',200,await call('/departments',tokens.nurse));assert.ok(departments.some(d=>d.id===departmentId));
 const o=verify('offset normalized overview','/departments/overview',200,await call(overview,tokens.manager));assert.equal(o.start,new Date(from).toISOString());assert.equal(o.end,new Date(to).toISOString());assert.ok(o.departments.some(d=>d.id===departmentId));assert.deepEqual(o.departments.find(d=>d.id===departmentId),{id:departmentId,nameAr:departments.find(d=>d.id===departmentId).nameAr,nameEn:departments.find(d=>d.id===departmentId).nameEn,...initial});
 for(const suffix of ['','?start=bad&end=bad','?start=2026-11-28&end=2026-11-29','?start=2026-11-28T00:00:00Z&end=2026-11-28T00:00:00Z','?start=2026-11-29T00:00:00Z&end=2026-11-28T00:00:00Z','?start=2026-11-28T00:00:00Z&end=2026-11-29T02:00:00.001Z','?start=2026-11-28T00:00:00Z&end=2026-11-29T00:00:00Z&extra=true'])verify('invalid range '+suffix,'/departments/overview',400,await call('/departments/overview'+suffix,tokens.manager));
 verify('exact26hour maximum','/departments/overview',200,await call('/departments/overview?start=2026-11-28T00:00:00Z&end=2026-11-29T02:00:00Z',tokens.admin));
 verify('bad department UUID','/departments/{id}/beds/summary',400,await call('/departments/bad/beds/summary',tokens.admin));
 verify('missing department','/departments/{id}/beds/summary',404,await call('/departments/'+missing+'/beds/summary',tokens.admin));
 const created=await call('/departments',tokens.admin,{nameAr:'قسم ملخص خيالي',nameEn:'Fictional Summary Contract'});assert.equal(created.status,201);const id=created.data.id,path='/departments/'+id+'/beds/summary';
 const assertCounts=async(name,counts)=>assert.deepEqual(verify(name,'/departments/{id}/beds/summary',200,await call(path,tokens.manager)),counts);
 await assertCounts('empty summary',{total:0,available:0,occupied:0,maintenance:0});
 const added=await call('/departments/'+id+'/beds',tokens.admin,{bedNumber:'SUMMARY-FAKE'});assert.equal(added.status,201);const bedId=added.data.id;
 await assertCounts('available summary',{total:1,available:1,occupied:0,maintenance:0});
 assert.equal((await call('/departments/'+id+'/beds/'+bedId+'/maintenance',tokens.admin,{status:'maintenance'},'PATCH')).status,200);
 await assertCounts('maintenance summary',{total:1,available:0,occupied:0,maintenance:1});
 assert.equal((await call('/departments/'+id+'/beds/'+bedId+'/maintenance',tokens.admin,{status:'available'},'PATCH')).status,200);
 const admitted=await call('/admissions',tokens.nurse,{patientId,bedId});assert.equal(admitted.status,201);
 await assertCounts('occupied summary',{total:1,available:0,occupied:1,maintenance:0});
 const active=verify('occupied overview','/departments/overview',200,await call(overview,tokens.manager));assert.deepEqual(active.departments.find(d=>d.id===id),{id,nameAr:created.data.nameAr,nameEn:created.data.nameEn,total:1,available:0,occupied:1,maintenance:0});
 const foreign=verify('foreign department list','/departments',200,await call('/departments',foreignToken));assert.ok(!foreign.some(d=>d.id===id||d.id===departmentId));
 // The supplied foreign token is clinical, so summary access itself is forbidden.
 verify('foreign clinical summary role denied','/departments/{id}/beds/summary',403,await call(path,foreignToken));
 const foreignManager=await call('/demo/role',foreignToken,{role:'manager'});assert.equal(foreignManager.status,201);
 verify('foreign manager scoped summary404','/departments/{id}/beds/summary',404,await call(path,foreignManager.data.accessToken));
 const foreignOverview=verify('foreign aggregate excludes departments','/departments/overview',200,await call(overview,foreignManager.data.accessToken));assert.ok(!foreignOverview.departments.some(d=>d.id===id||d.id===departmentId));
 assert.equal((await call('/admissions/'+admitted.data.id+'/discharge',tokens.nurse,{})).status,201);
 await assertCounts('discharged summary',{total:1,available:1,occupied:0,maintenance:0});
 return {checkedHttpResponses:namedCases.length,namedCases,scope:'Three existing department read projections, role matrix, range boundaries, count transitions, workspace isolation. Setup/admission writes are fictional fixture preparation, not new contract or audit/concurrency proof. Lists remain unbounded.'};
}
