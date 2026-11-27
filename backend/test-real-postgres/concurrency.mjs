// Run after npm run build against a disposable synthetic PostgreSQL database.
// This creates fictional rows and applies migrations. Never use a live database.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const backend=fileURLToPath(new URL('../', import.meta.url));
const url=process.env.HMS_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('hms_test')) throw new Error('Set HMS_TEST_DATABASE_URL to an isolated disposable hms_test database');
const {EncountersService}=require(backend+'/dist/src/modules/encounters/encounters.service.js');
const {PatientsService}=require(backend+'/dist/src/modules/patients/patients.service.js');
const {ADMISSION_ROLES}=require(backend+'/dist/src/modules/admissions/admission-audit.js');
const {PrismaClient}=require(backend+'/node_modules/@prisma/client');
const {AdmissionsService}=require(backend+'/dist/src/modules/admissions/admissions.service.js');
const {AppointmentsService}=require(backend+'/dist/src/modules/appointments/appointments.service.js');
let prisma, migrationOwner;
let runtimeUrl=url;
const results={scope:'isolated local PostgreSQL synthetic records, actual compiled services, synchronized concurrent reads',checks:[]};
function barrier(){let count=0,release;const gate=new Promise((r,reject)=>{release=r;setTimeout(()=>reject(new Error('barrier timeout')),10000).unref()});return async()=>{if(++count===4)release();await gate}}
try{
 const migration=spawnSync('node',['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:backend,env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
 results.migration={exit:migration.status,stdout:migration.stdout,stderr:migration.stderr};
 if(migration.status!==0)throw new Error('Migration failed');
 const fixtureOwner=new PrismaClient({datasources:{db:{url}}});await fixtureOwner.$executeRawUnsafe("INSERT INTO demo_workspaces(id) VALUES('baseline-test')");await fixtureOwner.$disconnect();
 if(process.env.HMS_TEST_OWNER_RUNTIME!=='1'){
  migrationOwner=new PrismaClient({datasources:{db:{url}}});
  const runtimePassword=require('node:crypto').randomBytes(24).toString('hex');
  await migrationOwner.$executeRawUnsafe(`CREATE ROLE hms_test_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  await migrationOwner.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO hms_test_runtime');
  await migrationOwner.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hms_test_runtime');
  await migrationOwner.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hms_test_runtime');
  await migrationOwner.$executeRawUnsafe('REVOKE UPDATE, DELETE ON audit_logs FROM hms_test_runtime');
  const restricted=new URL(url);restricted.username='hms_test_runtime';restricted.password=runtimePassword;runtimeUrl=restricted.toString();
  results.runtimeRole={nonOwner:true,migrationUrlSeparate:true,existingTablesExplicitGrants:true,futureTableDefaultGrants:false,auditInsertSelectOnly:true};
 }
 prisma=new PrismaClient({datasources:{db:{url:runtimeUrl}}});
 if(migrationOwner){
  for(const command of ['UPDATE audit_logs SET action=action','DELETE FROM audit_logs','TRUNCATE TABLE audit_logs']){
   let denied=false;try{await prisma.$executeRawUnsafe(command)}catch(e){denied=JSON.stringify(e).includes('42501')||String(e).includes('permission denied')}
   if(!denied)throw new Error('runtime audit role can mutate history');
  }
  results.checks.push({name:'actual runtime role denies audit update delete truncate',statementsDenied:3});
 }
 results.serviceConnection=await prisma.$queryRawUnsafe('SELECT current_user, session_user');
 const user=await prisma.user.create({data:{username:'synthetic_concurrency_doctor',passwordHash:'not-a-login',fullName:'Fictional Doctor',role:'doctor'}});
 const dep=await prisma.department.create({data:{nameEn:'Fictional Concurrency Department',nameAr:'قسم اختباري وهمي',totalBeds:1}});
 const bed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-01',status:'available'}});
 const patients=[];
 for(let i=1;i<=4;i++)patients.push(await prisma.patient.create({data:{mrn:'SYN-'+i,fullName:'Fictional Patient '+i,dateOfBirth:new Date('2000-01-01'),gender:'male',phone:'0000000000',createdBy:user.id}}));
 const meet=barrier();
 const wrapper={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='bed')return new Proxy(tx.bed,{get(delegate,method){if(method==='findUnique')return async args=>{const row=await delegate.findUnique(args);await meet();return row};return delegate[method]}});return target[key]}})))};
 const admissions=new AdmissionsService(wrapper);
 const admitted=await Promise.allSettled(patients.map(p=>admissions.create({patientId:p.id,bedId:bed.id},user.id)));
 results.checks.push({name:'four simultaneous admissions same bed',outcomes:admitted.map(r=>r.status==='fulfilled'?'success':({status:r.reason.getStatus?.(),body:r.reason.getResponse?.()})),activeAdmissions:await prisma.admission.count({where:{bedId:bed.id,dischargedAt:null}})});

 const winner=admitted.find(r=>r.status==='fulfilled').value;
 const admissionAudits=await prisma.auditLog.findMany({where:{entityId:winner.id,action:'PATIENT_ADMITTED'}});
 if(admissionAudits.length!==1||admissionAudits[0].userId!==user.id||admissionAudits[0].oldValue.admission!==null||admissionAudits[0].oldValue.bed.status!=='available'||admissionAudits[0].newValue.bed.status!=='occupied')throw new Error('transactional admission audit mismatch');
 results.checks.push({name:'four-way contention commits exactly one admission audit',auditCount:admissionAudits.length,verifiedActor:true,trustedBedTransition:true});
 const failureBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-AUDIT-FAIL',status:'available'}});
 const auditsBeforeFailure=await prisma.auditLog.count();
 const auditFailure={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='auditLog')return {create:async()=>{throw new Error('synthetic audit insert failure')}};return target[key]}})))};
 let createFailed=false;
 try{await new AdmissionsService(auditFailure).create({patientId:patients[0].id,bedId:failureBed.id},user.id)}catch{createFailed=true}
 if(!createFailed||(await prisma.bed.findUniqueOrThrow({where:{id:failureBed.id}})).status!=='available'||await prisma.admission.count({where:{bedId:failureBed.id}})!==0||await prisma.auditLog.count()!==auditsBeforeFailure)throw new Error('audit failure did not roll admission back');
 const toDischarge=await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:failureBed.id},user.id);
 const beforeDischargeAudits=await prisma.auditLog.count();
 let dischargeFailed=false;
 try{await new AdmissionsService(auditFailure).discharge(toDischarge.id,'private rollback notes',user.id)}catch{dischargeFailed=true}
 const stillActive=await prisma.admission.findUniqueOrThrow({where:{id:toDischarge.id}});
 if(!dischargeFailed||stillActive.dischargedAt!==null||stillActive.dischargeNotes!==null||(await prisma.bed.findUniqueOrThrow({where:{id:failureBed.id}})).status!=='occupied'||await prisma.auditLog.count()!==beforeDischargeAudits)throw new Error('audit failure did not roll discharge back');
 await new AdmissionsService(prisma).discharge(toDischarge.id,'private successful notes',user.id);
 const dischargeAudits=await prisma.auditLog.findMany({where:{entityId:toDischarge.id,action:'PATIENT_DISCHARGED'}});
 const dischargeAudit=dischargeAudits[0];
 if(dischargeAudits.length!==1||dischargeAudit.oldValue.admission.dischargedAt!==null||!dischargeAudit.newValue.admission.dischargedAt||dischargeAudit.oldValue.bed.status!=='occupied'||dischargeAudit.newValue.bed.status!=='available'||JSON.stringify(dischargeAudits).includes('private successful notes')||!dischargeAudit.newValue.changedFields.admission.includes('dischargeNotes')||dischargeAudit.newValue.changedFields.admission.includes('patientId'))throw new Error('trusted discharge audit mismatch');
 const failedMutationCount=await prisma.auditLog.count();
 try{await new AdmissionsService(prisma).discharge(toDischarge.id,undefined,user.id)}catch(e){if(e.getStatus?.()!==409)throw e}
 if(await prisma.auditLog.count()!==failedMutationCount)throw new Error('failed mutation produced success audit');
 for(const actor of [undefined,'', 'missing-actor']){
  let rejected=false;try{await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:failureBed.id},actor)}catch(e){rejected=[401,403].includes(e.getStatus?.())}
  if(!rejected)throw new Error('invalid actor accepted');
 }
 if((await prisma.bed.findUniqueOrThrow({where:{id:failureBed.id}})).status!=='available'||await prisma.auditLog.count()!==failedMutationCount)throw new Error('invalid actor mutated state');
 results.checks.push({name:'transaction-scoped audit failure and trusted diff',admissionAuditFailureRollback:true,dischargeAuditFailureRollback:true,failedMutationNoSuccessAudit:true,invalidActorBeforeMutation:true,notesRedacted:true,trustedDiff:true});

 // Four callers and only two pool connections: no all-callers barrier can deadlock the test.
 const smallUrl=new URL(runtimeUrl);smallUrl.searchParams.set('connection_limit','2');
 const smallPool=new PrismaClient({datasources:{db:{url:smallUrl.toString()}}});
 try{
  const smallBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-SMALL-POOL',status:'available'}});
  const attempts=await Promise.allSettled(patients.map(p=>new AdmissionsService(smallPool).create({patientId:p.id,bedId:smallBed.id},user.id)));
  if(attempts.filter(r=>r.status==='fulfilled').length!==1||attempts.filter(r=>r.status==='rejected'&&r.reason.getStatus?.()===409).length!==3)throw new Error('small pool contention invariant failed');
  results.checks.push({name:'four callers with two connections',successes:1,domainConflicts:3});
 }finally{await smallPool.$disconnect()}
 const maintenanceBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-MAINTENANCE',status:'available'}});
 const maintenanceAdmission=await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:maintenanceBed.id},user.id);
 let interleaved=false;
 const maintenanceWrapper={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='bed')return new Proxy(tx.bed,{get(delegate,method){if(method==='findUniqueOrThrow')return async args=>{const row=await delegate.findUniqueOrThrow(args);if(!interleaved){interleaved=true;await prisma.bed.update({where:{id:row.id},data:{status:'maintenance'}})}return row};return delegate[method]}});return target[key]}})))};
 let maintenanceConflict=false;
 try{await new AdmissionsService(maintenanceWrapper).discharge(maintenanceAdmission.id,undefined,user.id)}catch(e){maintenanceConflict=e.getStatus?.()===409&&e.getResponse?.().error?.code==='BED_STATE_CHANGED'}
 if(!maintenanceConflict||(await prisma.bed.findUniqueOrThrow({where:{id:maintenanceBed.id}})).status!=='maintenance'||(await prisma.admission.findUniqueOrThrow({where:{id:maintenanceAdmission.id}})).dischargedAt!==null||await prisma.auditLog.count({where:{entityId:maintenanceAdmission.id,action:'PATIENT_DISCHARGED'}})!==0)throw new Error('maintenance race overwritten or false audit');
 results.checks.push({name:'concurrent bed maintenance change conflicts without overwrite',status:409,admissionRolledBack:true,noDischargeAudit:true});
 const scheduleActor=await prisma.user.create({data:{username:'synthetic_schedule_actor',passwordHash:'not-a-login',fullName:'Fictional Receptionist',role:'receptionist'}});
 const appointments=new AppointmentsService(prisma);
 const scheduledAt='2026-12-01T10:00:00.000Z';
 const booked=await Promise.allSettled(patients.map(p=>appointments.create({patientId:p.id,doctorId:user.id,departmentId:dep.id,scheduledAt},scheduleActor.id)));
 results.checks.push({name:'four simultaneous appointments same doctor/slot',outcomes:booked.map(r=>r.status==='fulfilled'?'success':({status:r.reason.getStatus?.(),body:r.reason.getResponse?.()})),slotAppointments:await prisma.appointment.count({where:{doctorId:user.id,scheduledAt:new Date(scheduledAt)}})});
 const firstAdmission=await prisma.admission.findFirstOrThrow({where:{bedId:bed.id,dischargedAt:null}});
 await new AdmissionsService(prisma).discharge(firstAdmission.id,'Synthetic test discharge',user.id);
 await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:bed.id},user.id);
 results.checks.push({name:'discharge then readmit',activeAdmissions:await prisma.admission.count({where:{bedId:bed.id,dischargedAt:null}}),bedStatus:(await prisma.bed.findUniqueOrThrow({where:{id:bed.id}})).status});
 const firstAppointment=await prisma.appointment.findFirstOrThrow({where:{doctorId:user.id,scheduledAt:new Date(scheduledAt)}});
 await new AppointmentsService(prisma).cancel(firstAppointment.id,'Synthetic cancellation',scheduleActor.id);
 const rebook=await new AppointmentsService(prisma).create({patientId:patients[1].id,doctorId:user.id,departmentId:dep.id,scheduledAt},scheduleActor.id);
 results.checks.push({name:'cancel then rebook',activeSlotAppointments:await prisma.appointment.count({where:{doctorId:user.id,scheduledAt:new Date(scheduledAt),status:{not:'cancelled'}}})});
 const later=await new AppointmentsService(prisma).create({patientId:patients[0].id,doctorId:user.id,departmentId:dep.id,scheduledAt:'2026-12-01T11:00:00.000Z'},scheduleActor.id);
 try {await new AppointmentsService(prisma).update(later.id,{scheduledAt},scheduleActor.id);throw new Error('reschedule unexpectedly accepted')}catch(e){if(e.getStatus?.()!==409)throw e;results.checks.push({name:'reschedule occupied slot',status:e.getStatus(),code:e.getResponse().error.code})}
 const extra=await new AppointmentsService(prisma).create({patientId:patients[2].id,doctorId:user.id,departmentId:dep.id,scheduledAt:'2026-12-01T12:00:00.000Z'},scheduleActor.id);
 let reached=0,releaseUpdate;const updateGate=new Promise(r=>releaseUpdate=r);
 const updateWrapper=new Proxy(prisma,{get(target,key){if(key==='appointment')return new Proxy(prisma.appointment,{get(delegate,method){if(method==='findFirst')return async args=>{const row=await delegate.findFirst(args);if(++reached===2)releaseUpdate();await updateGate;return row};return delegate[method]}});return target[key]}});
 const moved=await Promise.allSettled([later,extra].map(a=>new AppointmentsService(prisma).update(a.id,{scheduledAt:'2026-12-01T13:00:00.000Z'},scheduleActor.id)));
 const moveOutcomes=moved.map(r=>r.status==='fulfilled'?'success':({status:r.reason.getStatus?.(),code:r.reason.getResponse?.().error?.code}));
 results.checks.push({name:'simultaneous reschedule to same empty slot',outcomes:moveOutcomes});
 if(moveOutcomes.filter(o=>o==='success').length!==1||moveOutcomes.filter(o=>o.status===409&&o.code==='APPOINTMENT_CONFLICT').length!==1)throw new Error('reschedule race invariant failed '+JSON.stringify(moved.map(r=>r.status==='fulfilled'?'ok':JSON.stringify({error:String(r.reason),code:r.reason.code,meta:r.reason.meta}))));
 const rollbackBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-ROLLBACK',status:'available'}});
 try{await new AdmissionsService(prisma).create({patientId:'00000000-0000-4000-a000-000000000000',bedId:rollbackBed.id},user.id);throw new Error('missing patient accepted')}catch(e){if(e.message==='missing patient accepted')throw e}
 const rollbackState=(await prisma.bed.findUniqueOrThrow({where:{id:rollbackBed.id}})).status;
 results.checks.push({name:'failed admission rolls bed claim back',bedStatus:rollbackState});if(rollbackState!=='available')throw new Error('claim not rolled back');
 // Force the unique-index backstop independently of the conditional claim.
 const backstopBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-BACKSTOP',status:'available'}});
 await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:backstopBed.id},user.id);
 await prisma.bed.update({where:{id:backstopBed.id},data:{status:'available'}});
 let backstopStatus,backstopCode;
 try{await new AdmissionsService(prisma).create({patientId:patients[1].id,bedId:backstopBed.id},user.id)}catch(e){backstopStatus=e.getStatus?.();backstopCode=e.getResponse?.().error?.code}
 results.checks.push({name:'active-bed unique-index backstop',status:backstopStatus,code:backstopCode,activeAdmissions:await prisma.admission.count({where:{bedId:backstopBed.id,dischargedAt:null}})});
 if(backstopStatus!==409||backstopCode!=='BED_NOT_AVAILABLE')throw new Error('admission index mapping failed');
 // Two discharges see the same active row; delay the second until readmission.
 const staleBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'SYN-STALE',status:'available'}});
 const staleAdmission=await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:staleBed.id},user.id);
 let reads=0,releaseBoth,releaseSecond;
 const bothRead=new Promise(r=>releaseBoth=r),secondMayFinish=new Promise(r=>releaseSecond=r);
 const staleWrapper={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='admission')return new Proxy(tx.admission,{get(delegate,method){if(method==='findUnique')return async args=>{const row=await delegate.findUnique(args);const number=++reads;if(number===2)releaseBoth();await bothRead;if(number===2)await secondMayFinish;return row};return delegate[method]}});return target[key]}})),{timeout:15000})};
 const firstDischarge=new AdmissionsService(staleWrapper).discharge(staleAdmission.id,undefined,user.id);
 const secondDischarge=new AdmissionsService(staleWrapper).discharge(staleAdmission.id,undefined,user.id).then(()=>({status:200}),e=>({status:e.getStatus?.(),code:e.getResponse?.().error?.code}));
 await Promise.race([firstDischarge,secondDischarge]);
 await new AdmissionsService(prisma).create({patientId:patients[1].id,bedId:staleBed.id},user.id);
 releaseSecond();
 const staleResults=await Promise.allSettled([firstDischarge,secondDischarge]);
 const staleOutcome=staleResults.map(r=>r.status==='rejected'?({status:r.reason.getStatus?.(),code:r.reason.getResponse?.().error?.code}):r.value).find(v=>v?.status===409)??{status:200};
 const staleState=(await prisma.bed.findUniqueOrThrow({where:{id:staleBed.id}})).status;
 results.checks.push({name:'stale second discharge after readmission',outcome:staleOutcome,bedStatus:staleState,activeAdmissions:await prisma.admission.count({where:{bedId:staleBed.id,dischargedAt:null}})});
 if(staleOutcome.status!==409||staleOutcome.code!=='ALREADY_DISCHARGED'||staleState!=='occupied')throw new Error('stale discharge freed readmitted bed');
 const check=['four simultaneous admissions same bed','four simultaneous appointments same doctor/slot','discharge then readmit','cancel then rebook'].map(name=>results.checks.find(c=>c.name===name));
 if(check[0].activeAdmissions!==1||check[1].slotAppointments!==1||check[2].activeAdmissions!==1||check[2].bedStatus!=='occupied'||check[3].activeSlotAppointments!==1)throw new Error('concurrency invariant failed');
 for(const c of check.slice(0,2)){if(c.outcomes.filter(o=>o==='success').length!==1||c.outcomes.filter(o=>o.status===409).length!==3)throw new Error('expected one success and three domain409')}
 const indexDefinitions=await prisma.$queryRawUnsafe("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('appointments_doctor_time_unique','admissions_one_active_per_bed') ORDER BY indexname");
 if(indexDefinitions.length!==2||!indexDefinitions.some(i=>i.indexdef.includes('discharged_at IS NULL'))||!indexDefinitions.some(i=>i.indexdef.includes('cancelled')))throw new Error('raw partial indexes missing');
 results.checks.push({name:'raw partial indexes preserved after migrations',indexes:indexDefinitions});


 const actorAuditBefore=await prisma.auditLog.findFirstOrThrow({where:{userId:user.id}});
 let actorRewriteDenied=false;
 try{await prisma.$executeRawUnsafe('UPDATE users SET id=$1 WHERE id=$2',require('node:crypto').randomUUID(),user.id)}catch(e){actorRewriteDenied=e.code==='P2010'&&['23503','23001'].includes(e.meta?.code)&&e.meta?.message?.includes('workspace_fkey');results.actorRewriteRestriction={prismaCode:e.code,sqlstate:e.meta?.code,meta:e.meta};console.error('actor-rewrite-sqlstate',JSON.stringify(results.actorRewriteRestriction));}
 if(!actorRewriteDenied||(await prisma.auditLog.findUniqueOrThrow({where:{id:actorAuditBefore.id}})).userId!==user.id)throw new Error('audit actor restriction assertion failed '+JSON.stringify({actorRewriteDenied,restriction:results.actorRewriteRestriction,actorUnchanged:(await prisma.auditLog.findUniqueOrThrow({where:{id:actorAuditBefore.id}})).userId===user.id}));
 results.checks.push({name:'runtime users primary-key update cannot cascade rewrite audit actor',foreignKeyRestriction:true,originalActorPreserved:true});
 const patientActor=await prisma.user.create({data:{username:'synthetic_receptionist',passwordHash:'not-a-login',fullName:'Fictional Receptionist',role:'receptionist'}});
 const patientService=new PatientsService(prisma);
 const patientDto={fullName:'Fictional Audit Patient',dateOfBirth:'1991-01-01',gender:'female',phone:'0000000000'};
 const auditedPatient=await patientService.create(patientDto,patientActor.id,true);
 await patientService.update(auditedPatient.id,{phone:'0000000001'},patientActor.id);
 const patientRows=await prisma.auditLog.findMany({where:{entityId:auditedPatient.id},orderBy:{createdAt:'asc'}});
 if(patientRows.length!==2||patientRows[0].oldValue!==null||!patientRows[1].newValue.changedFields.includes('phone')||patientRows[1].newValue.changedFields.includes('fullName')||JSON.stringify(patientRows).includes('0000000001')||JSON.stringify(patientRows).includes('Fictional Audit Patient'))throw new Error('patient transaction audit mismatch');
 const beforePatientCount=await prisma.patient.count(),beforePatientAudits=await prisma.auditLog.count();
 let patientCreateFailed=false;try{await new PatientsService(auditFailure).create({...patientDto,fullName:'Fictional Rollback Patient'},patientActor.id,true)}catch(e){patientCreateFailed=e.getStatus?.()===503}
 let patientUpdateFailed=false;try{await new PatientsService(auditFailure).update(auditedPatient.id,{phone:'0000000002'},patientActor.id)}catch(e){patientUpdateFailed=e.getStatus?.()===503}
 if(!patientCreateFailed||!patientUpdateFailed||await prisma.patient.count()!==beforePatientCount||await prisma.auditLog.count()!==beforePatientAudits||(await prisma.patient.findUniqueOrThrow({where:{id:auditedPatient.id}})).phone!=='0000000001')throw new Error('patient audit failure not rolled back');
 await prisma.patient.create({data:{mrn:'HMS-'+('9'.repeat(100)),fullName:'Fictional Imported Long MRN',dateOfBirth:new Date('1980-01-01'),gender:'male',phone:'0000000000',createdBy:patientActor.id}});
 const patientParallel=await Promise.allSettled([1,2,3,4].map(i=>patientService.create({...patientDto,fullName:'Fictional Parallel '+i},patientActor.id,true)));
 if(patientParallel.some(r=>r.status!=='fulfilled')||new Set(patientParallel.map(r=>r.value.mrn)).size!==4)throw new Error('patient MRN retry transaction failed');
 results.checks.push({name:'patient same-transaction create update audit and MRN retries',createUpdateAudits:2,trustedChangedFields:true,clinicalValuesRedacted:true,auditFailureRollsBackBoth:true,parallelUniqueMrns:4});

 const encounterService=new EncountersService(prisma);
 const encounterDto={patientId:patients[0].id,chiefComplaint:'private complaint',diagnosis:'private diagnosis'};
 const auditedEncounter=await encounterService.create(encounterDto,user.id);
 const auditedPrescription=await encounterService.addPrescription(auditedEncounter.id,{medicationName:'private medication',dosage:'private dose',duration:'private duration'},user.id);
 const encounterAuditBefore=await prisma.auditLog.count();
 for(const operation of [()=>new EncountersService(auditFailure).create(encounterDto,user.id),()=>new EncountersService(auditFailure).addPrescription(auditedEncounter.id,{medicationName:'private rollback',dosage:'dose',duration:'duration'},user.id),()=>new EncountersService(auditFailure).softDelete(auditedEncounter.id,'private reason',{userId:user.id,role:'doctor'})]){
  let failed=false;try{await operation()}catch(e){failed=e.getStatus?.()===503}if(!failed)throw new Error('encounter audit failure accepted');
 }
 if(await prisma.auditLog.count()!==encounterAuditBefore||(await prisma.encounter.findUniqueOrThrow({where:{id:auditedEncounter.id}})).deletedAt!==null||await prisma.prescription.count({where:{encounterId:auditedEncounter.id}})!==1)throw new Error('encounter failure did not rollback');
 await encounterService.softDelete(auditedEncounter.id,'private successful reason',{userId:user.id,role:'doctor'});
 const encounterRows=await prisma.auditLog.findMany({where:{entityId:{in:[auditedEncounter.id,auditedPrescription.id]}}});
 if(encounterRows.length!==3||JSON.stringify(encounterRows).includes('private')||!encounterRows.find(r=>r.action==='ENCOUNTER_SOFT_DELETED').newValue.changedFields.includes('deletedAt'))throw new Error('encounter audit privacy/diff/count');
 results.checks.push({name:'encounter prescription soft-delete transactional audit',exactSuccessRows:3,threeFailureRollbacks:true,clinicalValuesRedacted:true,softDeleteDiff:true});

 const {PharmacyService}=require(backend+'/dist/src/modules/pharmacy/pharmacy.service.js');
 const {BillingService}=require(backend+'/dist/src/modules/billing/billing.service.js');
 const pharmacyActor=await prisma.user.create({data:{username:'synthetic_pharmacist',passwordHash:'not-a-login',fullName:'Fictional Pharmacist',role:'pharmacist'}});
 const billingActor=await prisma.user.create({data:{username:'synthetic_billing',passwordHash:'not-a-login',fullName:'Fictional Billing',role:'billing_clerk'}});
 const medication=await prisma.medication.create({data:{name:'Fictional Contention Medication',unit:'test',currentStock:10}});
 const dispenseEncounter=await prisma.encounter.create({data:{patientId:patients[0].id,doctorId:user.id,chiefComplaint:'test',diagnosis:'test'}});
 const rx=await prisma.prescription.create({data:{encounterId:dispenseEncounter.id,medicationName:'Fictional Medication',dosage:'test',duration:'test'}});
 const raceSource=prisma;
 const dispenseAttempts=await Promise.allSettled([1,2,3,4].map(()=>new PharmacyService(raceSource).dispense(rx.id,{medicationId:medication.id,quantityDispensed:2},pharmacyActor.id)));
 const dispenseSuccess=dispenseAttempts.filter(r=>r.status==='fulfilled').length;
 results.checks.push({name:'four simultaneous dispensing attempts same prescription',successes:dispenseSuccess,stock:(await prisma.medication.findUniqueOrThrow({where:{id:medication.id}})).currentStock});
 if(dispenseAttempts.filter(r=>r.status==='rejected'&&r.reason.getStatus?.()===409).length!==3)throw new Error('dispense losers not domain409');
 if(dispenseSuccess!==1||(await prisma.medication.findUniqueOrThrow({where:{id:medication.id}})).currentStock!==8)throw new Error('same prescription dispensed multiple times');
 const invoice=await prisma.invoice.create({data:{patientId:patients[0].id,createdBy:billingActor.id,items:{create:[{description:'Fictional service',quantity:1,unitPrice:100}]}}});
 const paymentSource=prisma;
 const paymentAttempts=await Promise.allSettled([1,2,3,4].map(()=>new BillingService(paymentSource).recordPayment(invoice.id,{amount:100,method:'cash'},billingActor.id)));
 const payments=await prisma.payment.findMany({where:{invoiceId:invoice.id}});
 results.checks.push({name:'four simultaneous full payments same invoice',successes:paymentAttempts.filter(r=>r.status==='fulfilled').length,paymentTotal:payments.reduce((sum,p)=>sum+p.amount,0)});
 if(paymentAttempts.filter(r=>r.status==='rejected'&&r.reason.getStatus?.()===409).length!==3)throw new Error('payment losers not domain409');
 if(payments.length!==1||payments[0].amount!==100)throw new Error('concurrent invoice overpayment');

 const pharmacy=new PharmacyService(prisma),billing=new BillingService(prisma);
 const stockConservationBefore=(await prisma.medication.findUniqueOrThrow({where:{id:medication.id}})).currentStock;
 const conservationRx=await prisma.prescription.create({data:{encounterId:dispenseEncounter.id,medicationName:'Fictional Conservation',dosage:'test',duration:'test'}});
 await Promise.all([pharmacy.adjustStock(medication.id,5,'private adjustment reason',pharmacyActor.id),pharmacy.dispense(conservationRx.id,{medicationId:medication.id,quantityDispensed:2},pharmacyActor.id)]);
 if((await prisma.medication.findUniqueOrThrow({where:{id:medication.id}})).currentStock!==stockConservationBefore+3)throw new Error('adjust/dispense stock conservation failed');
 const adjustmentAudit=await prisma.auditLog.findFirstOrThrow({where:{entityId:medication.id,action:'MEDICATION_STOCK_ADJUSTED'}});
 if(adjustmentAudit.newValue.context.reasonCode!=='correction'||JSON.stringify(adjustmentAudit).includes('private adjustment reason'))throw new Error('stock reason policy leak');
 const dispensedAudit=await prisma.auditLog.findMany({where:{entityId:conservationRx.id,action:'PRESCRIPTION_DISPENSED'}});
 if(dispensedAudit.length!==1||dispensedAudit[0].newValue.entities.length!==2)throw new Error('combined prescription inventory audit missing');
 const partialInvoice=await billing.createInvoice({patientId:patients[0].id,items:[{description:'Fictional billing',quantity:1,unitPrice:100}]},billingActor.id);
 const itemPaymentRace=await Promise.allSettled([billing.recordPayment(partialInvoice.id,{amount:100,method:'cash'},billingActor.id),billing.addItem(partialInvoice.id,{description:'Fictional extra',quantity:1,unitPrice:50},billingActor.id)]);
 const finalInvoice=await billing.getInvoice(partialInvoice.id);
 const derived=finalInvoice.remaining===0?'paid':finalInvoice.totalPaid>0?'partial':'unpaid';
 if(finalInvoice.totalPaid>finalInvoice.patientResponsibility||finalInvoice.status!==derived||!itemPaymentRace.some(r=>r.status==='fulfilled'))throw new Error('item/final payment status invariant failed');
 await prisma.invoice.update({where:{id:partialInvoice.id},data:{status:'cancelled'}});
 let cancelledBlocked=false;try{await billing.recordPayment(partialInvoice.id,{amount:1,method:'cash'},billingActor.id)}catch(e){cancelledBlocked=e.getStatus?.()===409}
 if(!cancelledBlocked||(await prisma.invoice.findUniqueOrThrow({where:{id:partialInvoice.id}})).status!=='cancelled')throw new Error('cancelled invoice resurrected');
 results.checks.push({name:'stock conservation and invoice item-finalpayment serialization',stockConserved:true,invoiceTotalPaid:finalInvoice.totalPaid,responsibility:finalInvoice.patientResponsibility,remaining:finalInvoice.remaining,status:finalInvoice.status,cancelledPaymentBlocked:true,combinedDispenseAudit:true});

 const {LabService}=require(backend+'/dist/src/modules/lab/lab.service.js');
 const labActor=await prisma.user.create({data:{username:'synthetic_lab_tech',passwordHash:'not-a-login',fullName:'Fictional Lab Technician',role:'lab_tech'}});
 const labService=new LabService(prisma);
 const labOrder=await labService.createOrder({patientId:patients[0].id,encounterId:dispenseEncounter.id,testType:'lab',testName:'private test name'},user.id);
 const labAttempts=await Promise.allSettled([1,2,3,4].map(i=>labService.recordResult(labOrder.id,{result:'private test result '+i},labActor.id)));
 if(labAttempts.filter(r=>r.status==='fulfilled').length!==1||labAttempts.filter(r=>r.status==='rejected'&&r.reason.getStatus?.()===409).length!==3)throw new Error('lab result contention invariant');
 const labRows=await prisma.auditLog.findMany({where:{entityId:labOrder.id}});
 if(labRows.length!==2||JSON.stringify(labRows).includes('private'))throw new Error('lab audit count/privacy mismatch');
 results.checks.push({name:'four concurrent lab-result submissions one commit one success audit',successes:1,conflicts:3,auditRowsIncludingOrder:2,clinicalTextRedacted:true});
 // Privilege proof only in disposable local DB, not a deployed role/migration.
 await (migrationOwner??prisma).$executeRawUnsafe('CREATE ROLE hms_test_audit_writer NOLOGIN');
 await (migrationOwner??prisma).$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO hms_test_audit_writer');
 await (migrationOwner??prisma).$executeRawUnsafe('GRANT SELECT ON demo_workspaces TO hms_test_audit_writer');
 await (migrationOwner??prisma).$executeRawUnsafe('GRANT SELECT, INSERT ON audit_logs TO hms_test_audit_writer');
 const asAuditWriter=fn=>(migrationOwner??prisma).$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE hms_test_audit_writer');return fn(tx)});
 const restrictedAudit=await asAuditWriter(tx=>tx.auditLog.create({data:{userId:user.id,action:'SYNTHETIC_PERMISSION_TEST',entityType:'Admission',entityId:firstAdmission.id}}));
 for(const command of ['UPDATE audit_logs SET action=action','DELETE FROM audit_logs','TRUNCATE TABLE audit_logs']){
  let denied=false;try{await asAuditWriter(tx=>tx.$executeRawUnsafe(command))}catch(e){denied=JSON.stringify(e).includes('42501')||String(e).includes('permission denied')}
  if(!denied)throw new Error('restricted audit role could mutate existing history');
 }
 if(!await prisma.auditLog.findUnique({where:{id:restrictedAudit.id}}))throw new Error('audit row removed during privilege test');
 await (migrationOwner??prisma).$executeRawUnsafe('DROP OWNED BY hms_test_audit_writer');
 await (migrationOwner??prisma).$executeRawUnsafe('DROP ROLE hms_test_audit_writer');
 results.checks.push({name:'isolated non-owner audit-writer privilege proof',insertAllowed:true,updateDeleteTruncateDenied:true,roleRemoved:true,scope:'local design proof only, not app deployment or owner tamper evidence'});
 // Actual HTTP app, real Prisma and real PostgreSQL. Not an override-provider test.
 process.env.DATABASE_URL=runtimeUrl;
 process.env.JWT_SECRET=require('node:crypto').randomBytes(32).toString('hex');
 const {createApplication}=require(backend+'/dist/src/app.factory.js');
 const app=await createApplication({logger:false});
 await app.listen(0,'127.0.0.1');
 try{
  const origin=await app.getUrl();
  const {gzipSync}=require('node:zlib');
  const compressed=gzipSync(Buffer.from(JSON.stringify({username:'parser_probe',password:'synthetic-invalid-password'})));
  const compressedResponse=await fetch(origin+'/api/v1/parser-probe',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:compressed});
  if(compressedResponse.status!==404)throw new Error('valid compressed JSON behavior changed');
  const trailing=await fetch(origin+'/api/v1/parser-probe',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:Buffer.concat([compressed,Buffer.from('synthetic trailing bytes')])});
  if(trailing.status!==400)throw new Error('compressed trailing bytes unexpected response '+trailing.status);
  await new Promise(resolve=>setTimeout(resolve,100));
  const alive=await fetch(origin+'/api/v1/patients');if(alive.status!==401)throw new Error('parser regression service unavailable');
  results.checks.push({name:'patched body parser compressed request regression',validGzipParsed404:true,trailingResponseStatus:trailing.status,processRemainsAvailable401:true});

  results.httpConnection=await app.get(require(backend+'/dist/src/prisma/prisma.service.js').PrismaService).$queryRawUnsafe('SELECT current_user, session_user');
  const roles=['admin','receptionist','doctor','nurse','manager','pharmacist','lab_tech','billing_clerk'];
  const password=require('node:crypto').randomBytes(20).toString('hex');
  const hash=await require(backend+'/node_modules/bcrypt').hash(password,4);
  const tokens={};
  for(const [roleIndex,role] of roles.entries()){
   if(roleIndex===5) {
    const limited=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'http_admin',password})});
    if(limited.status!==429)throw new Error('login throttle did not reject sixth request');
    await new Promise(r=>setTimeout(r,61000));
   }
   await prisma.user.create({data:{username:'http_'+role,passwordHash:hash,fullName:'Fictional '+role,role}});
   const login=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'http_'+role,password})});
   if(login.status!==200)throw new Error('real HTTP login failed for '+role+' '+login.status);
   const data=await login.json();if(data.user.passwordHash)throw new Error('password hash exposed');tokens[role]=data.accessToken;
  }
  const loginLogs=[];
  app.useLogger(Object.fromEntries(['log','error','warn','debug','verbose','fatal'].map(level=>[level,(...args)=>loginLogs.push(args.map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' '))])));
  const inactiveLoginUser=await prisma.user.findFirstOrThrow({where:{username:'http_receptionist'}});
  await prisma.user.update({where:{id:inactiveLoginUser.id},data:{isActive:false}});
  const inactiveLogin=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'http_receptionist',password})});
  const inactiveBody=await inactiveLogin.json();
  await prisma.user.update({where:{id:inactiveLoginUser.id},data:{isActive:true}});
  if(inactiveLogin.status!==401||inactiveBody.accessToken||JSON.stringify(inactiveBody).includes(hash)||JSON.stringify(loginLogs).includes(password)||JSON.stringify(loginLogs).includes(hash))throw new Error('inactive login rejection or credential log leak');
  app.useLogger(false);
  results.checks.push({name:'inactive account actual login rejection and captured login logs',status:401,noToken:true,noPasswordOrHashInCapturedLogs:true,scope:'this login attempt, not a global logging guarantee'});
  const matrix=[
   ['/patients?search=Fictional',['admin','receptionist','doctor','nurse','manager']],
   ['/appointments',['admin','receptionist','doctor']],
   ['/departments',['admin','receptionist','doctor','nurse','manager']],
   ['/departments/'+dep.id+'/beds',['admin','doctor','nurse','manager']],
   ['/medications',['admin','pharmacist']],
   ['/test-orders/pending',['admin','lab_tech']],
  ];
  // Derive the frontend contract from actual controller metadata, not copied arrays.
  const {DepartmentsController}=require(backend+'/dist/src/modules/departments/departments.controller.js');
  const {AdmissionsController}=require(backend+'/dist/src/modules/admissions/admissions.controller.js');
  const fs=require('node:fs');
  const frontendPermissions=fs.readFileSync(backend+'/../frontend/src/auth/permissions.ts','utf8');
  const directoryRoles=Reflect.getMetadata('roles',DepartmentsController.prototype.findAll);
  const bedRoles=Reflect.getMetadata('roles',DepartmentsController.prototype.getBeds);
  const admissionRoles=Reflect.getMetadata('roles',AdmissionsController.prototype.create);
  const dischargeRoles=Reflect.getMetadata('roles',AdmissionsController.prototype.discharge);
  function rolesIn(fragment){return [...fragment.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]).filter(r=>roles.includes(r)).sort()}
  const pageFragment=frontendPermissions.match(/departments:\s*\[([^\]]+)\]/)?.[1];
  const bedFragment=frontendPermissions.match(/function canViewBeds[\s\S]*?return \[([^\]]+)\]/)?.[1];
  const admitFragment=frontendPermissions.match(/function canAdmitPatient[\s\S]*?return \[([^\]]+)\]/)?.[1];
  for(const [actual,expected] of [[rolesIn(pageFragment??''),directoryRoles],[rolesIn(bedFragment??''),bedRoles],[rolesIn(admitFragment??''),admissionRoles],[admissionRoles,dischargeRoles]])if(JSON.stringify([...actual].sort())!==JSON.stringify([...expected].sort()))throw new Error('frontend/backend role metadata contract drift');
  results.checks.push({name:'frontend department view/write parity against controller metadata',passed:true});
  let assertions=0;
  for(const [path,allowed]of matrix)for(const role of roles){
   const res=await fetch(origin+'/api/v1'+path,{headers:{Authorization:'Bearer '+tokens[role]}});
   const expected=allowed.includes(role)?200:403;
   if(res.status!==expected)throw new Error('HTTP role matrix failed '+path+' '+role+' expected '+expected+' got '+res.status);
   if(expected===403&&(await res.json()).error.code!=='FORBIDDEN_ROLE')throw new Error('wrong rejection reason');
   assertions++;
  }
  const excludedDoctor=await prisma.user.create({data:{username:'synthetic_disabled_options_doctor',passwordHash:'not-a-login',fullName:'Fictional Disabled Doctor',role:'doctor',isActive:false}});
  for(const role of roles){
   const response=await fetch(origin+'/api/v1/appointments/options',{headers:{Authorization:'Bearer '+tokens[role]}});
   if(response.status!==(['admin','receptionist','doctor'].includes(role)?200:403))throw new Error('appointment options RBAC');
   if(response.status===200){const data=await response.json();if(data.doctors.some(doctor=>doctor.id===excludedDoctor.id||doctor.id===(inactiveLoginUser.id))||data.doctors.some(doctor=>Object.keys(doctor).sort().join(',')!=='fullName,id')||data.departments.some(department=>Object.keys(department).sort().join(',')!=='id,nameAr,nameEn'))throw new Error('appointment options excess fields')}
  }
  for(const query of ['doctor_id=not-a-uuid','date=2026-02-30','start=2026-12-01T00%3A00%3A00Z','start=2026-12-02T00%3A00%3A00Z&end=2026-12-01T00%3A00%3A00Z','start=2026-12-01T00%3A00%3A00&end=2026-12-02T00%3A00%3A00','start=2026-12-01T00%3A00%3A00Z&end=2027-02-01T00%3A00%3A00Z']){
   const response=await fetch(origin+'/api/v1/appointments?'+query,{headers:{Authorization:'Bearer '+tokens.receptionist}});if(response.status!==400)throw new Error('invalid appointment query accepted '+query+' '+response.status);
  }
  const boundaryRows=[];
  for(const [index,time] of ['2026-12-29T20:59:59Z','2026-12-29T21:00:00Z','2026-12-30T20:59:59.999Z','2026-12-30T21:00:00Z'].entries())boundaryRows.push(await prisma.appointment.create({data:{patientId:patients[index].id,doctorId:user.id,departmentId:dep.id,scheduledAt:new Date(time)}}));
  const boundaryResponse=await fetch(origin+'/api/v1/appointments?start=2026-12-29T21%3A00%3A00Z&end=2026-12-30T21%3A00%3A00Z',{headers:{Authorization:'Bearer '+tokens.receptionist}});const boundaryData=await boundaryResponse.json();
  if(boundaryResponse.status!==200||JSON.stringify(boundaryData.map(row=>row.id))!==JSON.stringify(boundaryRows.slice(1,3).map(row=>row.id)))throw new Error('local appointment day boundaries wrong');
  results.checks.push({name:'appointment options minimal fields eight-role matrix and local-day range',roleAssertions:8,invalidQueries400:6,inclusiveStart:true,exclusiveEnd:true,lastMillisecondIncluded:true});
  const boundedDay='2026-12-31';
  await prisma.appointment.createMany({data:Array.from({length:501},(_,index)=>({patientId:patients[0].id,doctorId:user.id,departmentId:dep.id,scheduledAt:new Date(Date.parse(boundedDay+'T00:00:00Z')+index*1000)}))});
  const tooMany=await fetch(origin+'/api/v1/appointments?date='+boundedDay,{headers:{Authorization:'Bearer '+tokens.receptionist}});const tooManyBody=await tooMany.json();
  if(tooMany.status!==400||tooManyBody.error?.code!=='APPOINTMENT_RANGE_TOO_LARGE')throw new Error('unbounded/truncated appointment response');
  const defaultDay=await fetch(origin+'/api/v1/appointments',{headers:{Authorization:'Bearer '+tokens.receptionist}});const defaultData=await defaultDay.json();
  const todayUtc=new Date().toISOString().slice(0,10);if(defaultDay.status!==200||defaultData.some(row=>!row.scheduledAt.startsWith(todayUtc)))throw new Error('default appointment day not bounded');
  const pageOne=await fetch(origin+'/api/v1/appointments?date='+boundedDay+'&page=1',{headers:{Authorization:'Bearer '+tokens.receptionist}});const one=await pageOne.json();
  const pageSix=await fetch(origin+'/api/v1/appointments?date='+boundedDay+'&page=6',{headers:{Authorization:'Bearer '+tokens.receptionist}});const six=await pageSix.json();
  if(pageOne.status!==200||one.length!==100||pageSix.status!==200||six.length!==1||one.some(row=>row.id===six[0].id))throw new Error('appointment pagination bounds');
  if(Object.keys(one[0].doctor).join(',')!=='fullName'||Object.keys(one[0].patient).sort().join(',')!=='fullName,mrn')throw new Error('schedule identity projection leaks extra fields');
  results.checks.push({name:'appointment bounded paging and identity projection',pageSize:100,lastPage:1,noOverlap:true,doctorNameOnly:true,patientNameMrnOnly:true});
  results.checks.push({name:'bounded appointment schedule prevents unfiltered all-row scan response',implicitUtcDay:true,readLimit:501,over500Explicit400:true,noSilentTruncation:true});
  const unauthorized=await fetch(origin+'/api/v1/patients?search=Fictional');if(unauthorized.status!==401)throw new Error('unauthenticated access allowed');
  results.checks.push({name:'actual HTTP real-DB eight-role read-route allow/deny matrix',assertions,loginRoles:8,unauthenticatedStatus:401,scope:'six read endpoints only, not full mutation RBAC'});
  async function post(path,role,body,expected){
   const res=await fetch(origin+'/api/v1'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[role]},body:JSON.stringify(body)});
   const data=await res.json();if(res.status!==expected)throw new Error('workflow '+path+' '+role+' expected '+expected+' got '+res.status+' code '+data.error?.code);return data;
  }
  const viewBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'HTTP-PAYLOAD',status:'available'}});
  const oldAdmission=await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:viewBed.id},user.id);
  await new AdmissionsService(prisma).discharge(oldAdmission.id,'Fictional historical admission',user.id);
  const currentAdmission=await new AdmissionsService(prisma).create({patientId:patients[1].id,bedId:viewBed.id},user.id);
  for(const role of ['manager','admin','nurse','doctor']){
   const res=await fetch(origin+'/api/v1/departments/'+dep.id+'/beds',{headers:{Authorization:'Bearer '+tokens[role]}});
   const list=await res.json();const item=list.find(b=>b.id===viewBed.id);
   const expectedKeys=['id','departmentId','bedNumber','status',...(['nurse','doctor'].includes(role)?['admissions']:[])].sort();
   if(JSON.stringify(Object.keys(item).sort())!==JSON.stringify(expectedKeys))throw new Error('unexpected top-level bed fields');
   if(['manager','admin'].includes(role)){if('admissions'in item)throw new Error('aggregate viewer received patient-bearing admissions')}
   else{
    if(item.admissions.length!==1||item.admissions[0].id!==currentAdmission.id)throw new Error('active admission filter failed');
    const p=item.admissions[0].patient;
    if(JSON.stringify(Object.keys(p).sort())!==JSON.stringify(['fullName','id','mrn']))throw new Error('patient summary exceeded selected fields');
    const empty=list.find(b=>b.id===rollbackBed.id);if(empty.admissions.length!==0)throw new Error('empty bed admission list incorrect');
   }
  }
  results.checks.push({name:'minimal role-specific bed payload',aggregateRolesOmitAdmissions:true,clinicalRolesOnlyActiveAdmission:true,patientFields:['id','mrn','fullName'],emptyBedAdmissions:0});
  if([...admissionRoles].sort().join(',')!==[...ADMISSION_ROLES].sort().join(','))throw new Error('controller and service admission role parity failed');
  let admissionMutationAssertions=0;
  for(const role of roles){
   const roleBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'HTTP-'+role,status:'available'}});
   const allowed=admissionRoles.includes(role);
   await post('/admissions',role,{patientId:patients[0].id,bedId:roleBed.id},allowed?201:403);
   if(!allowed){const deniedBed=await prisma.bed.findUniqueOrThrow({where:{id:roleBed.id}});if(deniedBed.status!=='available'||await prisma.admission.count({where:{bedId:roleBed.id}})!==0)throw new Error('denied admission changed state')}
   const active=await prisma.admission.findFirst({where:{bedId:roleBed.id,dischargedAt:null}});
   const dischargeTarget=active??await new AdmissionsService(prisma).create({patientId:patients[0].id,bedId:roleBed.id},user.id);
   await post('/admissions/'+dischargeTarget.id+'/discharge',role,{dischargeNotes:'Fictional HTTP role check'},allowed?201:403);
   const admitRows=await prisma.auditLog.findMany({where:{entityId:dischargeTarget.id,action:'PATIENT_ADMITTED'}});
   const dischargeRows=await prisma.auditLog.findMany({where:{entityId:dischargeTarget.id,action:'PATIENT_DISCHARGED'}});
   const expectedActor=allowed?(await prisma.user.findFirstOrThrow({where:{username:'http_'+role}})).id:user.id;
   if(admitRows.length!==1||admitRows[0].userId!==expectedActor||dischargeRows.length!==(allowed?1:0)||allowed&&dischargeRows[0].userId!==expectedActor)throw new Error('HTTP transactional audit count or actor mismatch');
   if(!allowed){const stillActive=await prisma.admission.findUniqueOrThrow({where:{id:dischargeTarget.id}});if(stillActive.dischargedAt!==null)throw new Error('denied discharge changed state')}
   admissionMutationAssertions+=2;
  }
  results.checks.push({name:'real HTTP admission and discharge eight-role mutation matrix',assertions:admissionMutationAssertions,rolesFromControllerMetadata:true});
  await post('/admissions','nurse',{patientId:'00000000-0000-4000-a000-000000000000',bedId:bed.id},404);
  // A real PostgreSQL INSERT rejection, not a mocked delegate, must roll the HTTP mutation back.
  const sqlFailureBed=await prisma.bed.create({data:{departmentId:dep.id,bedNumber:'HTTP-SQL-AUDIT-FAIL',status:'available'}});
  await (migrationOwner??prisma).$executeRawUnsafe(`CREATE FUNCTION hms_test_reject_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('PATIENT_ADMITTED','PATIENT_DISCHARGED') THEN RAISE EXCEPTION 'synthetic audit insertion rejected'; END IF; RETURN NEW; END $$`);
  const installAuditRejection=()=>(migrationOwner??prisma).$executeRawUnsafe('CREATE TRIGGER hms_test_audit_rejection BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_reject_audit_insert()');
  const removeAuditRejection=()=>(migrationOwner??prisma).$executeRawUnsafe('DROP TRIGGER hms_test_audit_rejection ON audit_logs');
  await installAuditRejection();
  try{
   const before=await prisma.auditLog.count();
   await post('/admissions','nurse',{patientId:patients[0].id,bedId:sqlFailureBed.id},503);
   if((await prisma.bed.findUniqueOrThrow({where:{id:sqlFailureBed.id}})).status!=='available'||await prisma.admission.count({where:{bedId:sqlFailureBed.id}})!==0||await prisma.auditLog.count()!==before)throw new Error('SQL rejected audit did not roll HTTP admission back');
  }finally{await removeAuditRejection()}
  const sqlAdmission=await post('/admissions','nurse',{patientId:patients[0].id,bedId:sqlFailureBed.id},201);
  await installAuditRejection();
  try{
   const before=await prisma.auditLog.count();
   await post('/admissions/'+sqlAdmission.id+'/discharge','nurse',{dischargeNotes:'must roll back'},503);
   const persisted=await prisma.admission.findUniqueOrThrow({where:{id:sqlAdmission.id}});
   if(persisted.dischargedAt!==null||persisted.dischargeNotes!==null||(await prisma.bed.findUniqueOrThrow({where:{id:sqlFailureBed.id}})).status!=='occupied'||await prisma.auditLog.count()!==before)throw new Error('SQL rejected audit did not roll HTTP discharge back');
  }finally{await removeAuditRejection();await (migrationOwner??prisma).$executeRawUnsafe('DROP FUNCTION hms_test_reject_audit_insert()')}
  results.checks.push({name:'real HTTP and PostgreSQL trigger-rejected audit rolls mutation back',admissionRollback:true,dischargeRollback:true,noSuccessAudit:true,expectedHttpStatus:503,triggerRemoved:true});



  const contractPatient=await post('/patients','receptionist',{fullName:'Fictional Contract Patient',dateOfBirth:'1981-01-01',gender:'male',phone:'0000000000'},201);
  const contractDoctor=await prisma.user.findFirstOrThrow({where:{username:'http_doctor'}});
  const otherDoctor=await prisma.user.create({data:{username:'synthetic_other_doctor',passwordHash:'not-a-login',fullName:'Fictional Other Doctor',role:'doctor'}});
  const contractAppointment=await prisma.appointment.create({data:{patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:new Date('2026-12-10T09:00:00Z')}});
  const foreignAppointment=await prisma.appointment.create({data:{patientId:patients[0].id,doctorId:otherDoctor.id,departmentId:dep.id,scheduledAt:new Date('2026-12-11T09:00:00Z')}});
  await post('/encounters','doctor',{patientId:contractPatient.id,appointmentId:foreignAppointment.id,chiefComplaint:'test',diagnosis:'test'},409);
  await post('/encounters','doctor',{patientId:contractPatient.id,appointmentId:'00000000-0000-4000-a000-000000000000',chiefComplaint:'test',diagnosis:'test'},404);
  await post('/encounters','doctor',{patientId:'00000000-0000-4000-a000-000000000000',chiefComplaint:'test',diagnosis:'test'},404);

  for(const status of ['cancelled','no_show']){
   const invalidAppointment=await prisma.appointment.create({data:{patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:new Date(status==='cancelled'?'2026-12-13T09:00:00Z':'2026-12-14T09:00:00Z'),status}});
   await post('/encounters','doctor',{patientId:contractPatient.id,appointmentId:invalidAppointment.id,chiefComplaint:'test',diagnosis:'test'},409);
   if((await prisma.appointment.findUniqueOrThrow({where:{id:invalidAppointment.id}})).status!==status||await prisma.encounter.count({where:{appointmentId:invalidAppointment.id}})!==0)throw new Error('non-attended appointment changed');
  }
  results.checks.push({name:'cancelled and no-show appointment encounter linkage rejected',status:409,noAppointmentSideEffect:true,standaloneVisitStillAllowed:true});
  const contractEncounter=await post('/encounters','doctor',{patientId:contractPatient.id,appointmentId:contractAppointment.id,chiefComplaint:'test',diagnosis:'test'},201);
  await post('/encounters','doctor',{patientId:contractPatient.id,appointmentId:contractAppointment.id,chiefComplaint:'test',diagnosis:'test'},409);
  const foreignEncounter=await prisma.encounter.create({data:{patientId:contractPatient.id,doctorId:otherDoctor.id,chiefComplaint:'test',diagnosis:'test'}});
  await post('/encounters/'+foreignEncounter.id+'/prescriptions','doctor',{medicationName:'test',dosage:'test',duration:'test'},403);
  for(const field of ['id','mrn','createdBy']){
   const rejection=await fetch(origin+'/api/v1/patients/'+contractPatient.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:JSON.stringify({[field]:'forged'})});
   if(rejection.status!==400)throw new Error('patient identity whitelist failure '+field);
  }
  const stillContract=await prisma.patient.findUniqueOrThrow({where:{id:contractPatient.id}});
  if(stillContract.mrn!==contractPatient.mrn||stillContract.createdBy!==contractPatient.createdBy)throw new Error('patient identity changed');
  const beforeDisabledCount=await prisma.patient.count();
  const receptionistId=(await prisma.user.findFirstOrThrow({where:{username:'http_receptionist'}})).id;
  await prisma.user.update({where:{id:receptionistId},data:{isActive:false}});
  await post('/patients','receptionist',{fullName:'Fictional Disabled Actor',dateOfBirth:'1982-01-01',gender:'male',phone:'0000000000'},401);
  const disabledRead=await fetch(origin+'/api/v1/patients?search=Fictional',{headers:{Authorization:'Bearer '+tokens.receptionist}});
  if(disabledRead.status!==401)throw new Error('disabled token retained read access');
  results.checks.push({name:'disabled current user token denies read and write',readStatus:401,writeStatus:401});
  await prisma.user.update({where:{id:receptionistId},data:{isActive:true}});
  if(await prisma.patient.count()!==beforeDisabledCount)throw new Error('disabled actor mutated patient');

  const updateAuditsBefore=await prisma.auditLog.count({where:{entityId:contractPatient.id,action:'PATIENT_UPDATED'}});
  const parallelPatches=await Promise.all(['0000000011','0000000012'].map(phone=>fetch(origin+'/api/v1/patients/'+contractPatient.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:JSON.stringify({phone})})));
  if(parallelPatches.some(r=>r.status!==200)||await prisma.auditLog.count({where:{entityId:contractPatient.id,action:'PATIENT_UPDATED'}})!==updateAuditsBefore+2)throw new Error('concurrent patient HTTP audit mismatch');
  const parallelAppointment=await prisma.appointment.create({data:{patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:new Date('2026-12-12T09:00:00Z')}});
  const encounterAttempts=await Promise.all([1,2].map(()=>fetch(origin+'/api/v1/encounters',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.doctor},body:JSON.stringify({patientId:contractPatient.id,appointmentId:parallelAppointment.id,chiefComplaint:'parallel test',diagnosis:'parallel test'})})));
  if(encounterAttempts.filter(r=>r.status===201).length!==1||encounterAttempts.filter(r=>r.status===409).length!==1)throw new Error('concurrent appointment encounter HTTP mismatch');
  const parallelEncounter=await prisma.encounter.findUniqueOrThrow({where:{appointmentId:parallelAppointment.id}});
  if(await prisma.auditLog.count({where:{entityId:parallelEncounter.id,action:'ENCOUNTER_CREATED'}})!==1)throw new Error('duplicate concurrent encounter audit');
  results.checks.push({name:'concurrent clinical HTTP mutation audit',patientUpdates:2,patientUpdateAudits:2,encounterSuccess:1,encounterConflict:1,encounterAudits:1});
  results.checks.push({name:'clinical HTTP contract and ownership guards',appointmentMissing404:true,patientMissing404:true,appointmentAssociation409:true,duplicateAppointmentEncounter409:true,foreignDoctorPrescription403:true,identityWhitelistFields:['id','mrn','createdBy'],disabledActor401:true});


  await post('/invoices','billing_clerk',{patientId:'00000000-0000-4000-a000-000000000000',items:[{description:'Fictional missing patient',quantity:1,unitPrice:100}]},404);
  const foreignAdmission=await prisma.admission.findFirstOrThrow({where:{patientId:patients[0].id}});
  await post('/invoices','billing_clerk',{patientId:contractPatient.id,admissionId:foreignAdmission.id,items:[{description:'Fictional wrong admission',quantity:1,unitPrice:100}]},409);
  for(const value of [2147483648,Number.MAX_SAFE_INTEGER,1.5,-1])await post('/invoices','billing_clerk',{patientId:contractPatient.id,items:[{description:'Fictional range test',quantity:1,unitPrice:value}]},400);
  await post('/invoices','billing_clerk',{patientId:contractPatient.id,items:[{description:'Fictional total overflow',quantity:2147483647,unitPrice:2147483647}]},409);
  await post('/medications','pharmacist',{name:'Fictional range medication',unit:'test',currentStock:2147483648},400);
  results.checks.push({name:'invoice patient admission and numeric storage bounds HTTP',missingPatient404:true,wrongAdmission409:true,int4DtoOverflow400:true,unsafeProduct409:true});
  const sqlMedication=await post('/medications','pharmacist',{name:'Fictional SQL Medication',unit:'test',currentStock:10},201);
  for(const reasonCode of ['restock','correction','disposal']){
   const delta=reasonCode==='disposal'?-1:1;
   const result=await fetch(origin+'/api/v1/medications/'+sqlMedication.id+'/stock',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.pharmacist},body:JSON.stringify({delta,reasonCode})});
   if(result.status!==200)throw new Error('stock reason category HTTP contract '+reasonCode);
  }
  const badReason=await fetch(origin+'/api/v1/medications/'+sqlMedication.id+'/stock',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.pharmacist},body:JSON.stringify({delta:1,reasonCode:'patient-name-like-private-value'})});
  if(badReason.status!==400)throw new Error('arbitrary stock reason code accepted');
  const stockAuditRows=await prisma.auditLog.findMany({where:{entityId:sqlMedication.id}});
  if(stockAuditRows.length!==4||JSON.stringify(stockAuditRows).includes('patient-name-like-private-value'))throw new Error('stock creation/category exact audit mismatch');
  await prisma.medication.update({where:{id:sqlMedication.id},data:{currentStock:10}});
  for(const delta of [0,2147483648,-2147483648,1.5]){
   const bounded=await fetch(origin+'/api/v1/medications/'+sqlMedication.id+'/stock',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.pharmacist},body:JSON.stringify({delta,reasonCode:'correction'})});if(bounded.status!==400)throw new Error('stock DTO bound/no-op failed');
  }
  const sqlDispenseRx=await prisma.prescription.create({data:{encounterId:contractEncounter.id,medicationName:'Fictional SQL Rx',dosage:'test',duration:'test'}});
  const sqlInvoice=await post('/invoices','billing_clerk',{patientId:contractPatient.id,items:[{description:'Fictional SQL Item',quantity:1,unitPrice:100}]},201);
  await (migrationOwner??prisma).$executeRawUnsafe(`CREATE FUNCTION hms_test_reject_finance_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('MEDICATION_CREATED','MEDICATION_STOCK_ADJUSTED','PRESCRIPTION_DISPENSED','INVOICE_CREATED','INVOICE_ITEM_ADDED','PAYMENT_RECORDED') THEN RAISE EXCEPTION 'synthetic finance audit rejection'; END IF; RETURN NEW; END $$`);
  await (migrationOwner??prisma).$executeRawUnsafe('CREATE TRIGGER hms_test_finance_audit_rejection BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_reject_finance_audit()');
  try{
   const before={medications:await prisma.medication.count(),invoices:await prisma.invoice.count(),items:await prisma.invoiceItem.count(),payments:await prisma.payment.count(),audits:await prisma.auditLog.count()};
   await post('/medications','pharmacist',{name:'Fictional SQL Fail Medication',unit:'test',currentStock:10},503);
   const adjustment=await fetch(origin+'/api/v1/medications/'+sqlMedication.id+'/stock',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.pharmacist},body:JSON.stringify({delta:5,reason:'Fictional stock reason'})});
   if(adjustment.status!==503)throw new Error('stock audit rejection HTTP contract');
   await post('/prescriptions/'+sqlDispenseRx.id+'/dispense','pharmacist',{medicationId:sqlMedication.id,quantityDispensed:2},503);
   await post('/invoices','billing_clerk',{patientId:contractPatient.id,items:[{description:'Fictional failed item',quantity:1,unitPrice:100}]},503);
   await post('/invoices/'+sqlInvoice.id+'/items','billing_clerk',{description:'Fictional failed extra',quantity:1,unitPrice:50},503);
   await post('/invoices/'+sqlInvoice.id+'/payments','billing_clerk',{amount:100,method:'cash'},503);
   if(await prisma.medication.count()!==before.medications||await prisma.invoice.count()!==before.invoices||await prisma.invoiceItem.count()!==before.items||await prisma.payment.count()!==before.payments||await prisma.auditLog.count()!==before.audits||(await prisma.medication.findUniqueOrThrow({where:{id:sqlMedication.id}})).currentStock!==10||(await prisma.prescription.findUniqueOrThrow({where:{id:sqlDispenseRx.id}})).status!=='pending'||(await prisma.invoice.findUniqueOrThrow({where:{id:sqlInvoice.id}})).status!=='unpaid')throw new Error('finance audit failure did not rollback combined state');
   results.checks.push({name:'six pharmacy billing HTTP mutations SQL-audit-rejected roll back',operations:6,stockPrescriptionInvoiceItemsPaymentsUnchanged:true,noSuccessAudit:true,status:503});
  }finally{await (migrationOwner??prisma).$executeRawUnsafe('DROP TRIGGER hms_test_finance_audit_rejection ON audit_logs');await (migrationOwner??prisma).$executeRawUnsafe('DROP FUNCTION hms_test_reject_finance_audit()')}

  const beforeForbiddenLab={orders:await prisma.testOrder.count(),audits:await prisma.auditLog.count()};
  await post('/test-orders','doctor',{patientId:contractPatient.id,encounterId:foreignEncounter.id,testType:'lab',testName:'Fictional foreign encounter'},403);
  if(await prisma.testOrder.count()!==beforeForbiddenLab.orders||await prisma.auditLog.count()!==beforeForbiddenLab.audits)throw new Error('forbidden lab changed state');
  const sqlLabOrder=await post('/test-orders','doctor',{patientId:contractPatient.id,encounterId:contractEncounter.id,testType:'lab',testName:'Fictional SQL Lab Test'},201);
  await (migrationOwner??prisma).$executeRawUnsafe(`CREATE FUNCTION hms_test_reject_lab_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('TEST_ORDERED','TEST_RESULT_RECORDED') THEN RAISE EXCEPTION 'synthetic lab audit rejection'; END IF; RETURN NEW; END $$`);
  await (migrationOwner??prisma).$executeRawUnsafe('CREATE TRIGGER hms_test_lab_audit_rejection BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_reject_lab_audit()');
  try{
   const before={orders:await prisma.testOrder.count(),audits:await prisma.auditLog.count()};
   await post('/test-orders','doctor',{patientId:contractPatient.id,encounterId:contractEncounter.id,testType:'radiology',testName:'Fictional SQL Radiology'},503);
   await post('/test-orders/'+sqlLabOrder.id+'/result','lab_tech',{result:'private synthetic result'},503);
   const unchanged=await prisma.testOrder.findUniqueOrThrow({where:{id:sqlLabOrder.id}});
   if(await prisma.testOrder.count()!==before.orders||await prisma.auditLog.count()!==before.audits||unchanged.status!=='pending'||unchanged.result!==null)throw new Error('SQL lab audit failure did not rollback');
   results.checks.push({name:'lab order and result SQL-audit-rejected HTTP rollback',operations:2,status:503,pendingStatePreserved:true,noSuccessAudit:true});
  }finally{await (migrationOwner??prisma).$executeRawUnsafe('DROP TRIGGER hms_test_lab_audit_rejection ON audit_logs');await (migrationOwner??prisma).$executeRawUnsafe('DROP FUNCTION hms_test_reject_lab_audit()')}

  const adminActor=await prisma.user.findFirstOrThrow({where:{username:'http_admin'}});
  const auditAppointment=await post('/appointments','receptionist',{patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:'2026-12-20T09:00:00Z'},201);
  const auditUser=await post('/users','admin',{username:'fictional_audited_user',password:password,fullName:'Fictional Audited User',role:'nurse'},201);
  if(auditUser.passwordHash)throw new Error('user create hash exposed');
  await (migrationOwner??prisma).$executeRawUnsafe(`CREATE FUNCTION hms_test_reject_remaining_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('APPOINTMENT_CREATED','APPOINTMENT_UPDATED','APPOINTMENT_CANCELLED','USER_CREATED','USER_STATUS_CHANGED') THEN RAISE EXCEPTION 'synthetic final handlers audit rejection'; END IF; RETURN NEW; END $$`);
  await (migrationOwner??prisma).$executeRawUnsafe('CREATE TRIGGER hms_test_remaining_audit_rejection BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_reject_remaining_audit()');
  try{
   const before={appointments:await prisma.appointment.count(),users:await prisma.user.count(),audits:await prisma.auditLog.count()};
   await post('/appointments','receptionist',{patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:'2026-12-21T09:00:00Z'},503);
   const patch=await fetch(origin+'/api/v1/appointments/'+auditAppointment.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:JSON.stringify({scheduledAt:'2026-12-20T10:00:00Z'})});if(patch.status!==503)throw new Error('appointment update audit rollback status');
   await post('/appointments/'+auditAppointment.id+'/cancel','receptionist',{reason:'private cancel reason'},503);
   await post('/users','admin',{username:'fictional_failed_user',password:password,fullName:'Fictional Failed User',role:'nurse'},503);
   const disabled=await fetch(origin+'/api/v1/users/'+auditUser.id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.admin},body:JSON.stringify({isActive:false})});if(disabled.status!==503)throw new Error('user status audit rollback status');
   const unchanged=await prisma.appointment.findUniqueOrThrow({where:{id:auditAppointment.id}});
   if(await prisma.appointment.count()!==before.appointments||await prisma.user.count()!==before.users||await prisma.auditLog.count()!==before.audits||unchanged.scheduledAt.toISOString()!==new Date(auditAppointment.scheduledAt).toISOString()||unchanged.status!=='scheduled'||!(await prisma.user.findUniqueOrThrow({where:{id:auditUser.id}})).isActive)throw new Error('final handler SQL rollback failed');
   results.checks.push({name:'remaining five handler HTTP SQL audit rejection rollback',operationsTested:5,measuredBefore:before,measuredAfter:{appointments:await prisma.appointment.count(),users:await prisma.user.count(),audits:await prisma.auditLog.count()}});
  }finally{await (migrationOwner??prisma).$executeRawUnsafe('DROP TRIGGER hms_test_remaining_audit_rejection ON audit_logs');await (migrationOwner??prisma).$executeRawUnsafe('DROP FUNCTION hms_test_reject_remaining_audit()')}

  const successfulUpdate=await fetch(origin+'/api/v1/appointments/'+auditAppointment.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:JSON.stringify({scheduledAt:'2026-12-20T10:00:00Z'})});if(successfulUpdate.status!==200)throw new Error('appointment successful update failed');
  await post('/appointments/'+auditAppointment.id+'/cancel','receptionist',{reason:'private successful cancellation'},201);
  const appointmentAuditRows=await prisma.auditLog.findMany({where:{entityId:auditAppointment.id}});
  if(appointmentAuditRows.length!==3||JSON.stringify(appointmentAuditRows).includes('private successful cancellation')||!appointmentAuditRows.find(r=>r.action==='APPOINTMENT_UPDATED').newValue.changedFields.includes('scheduledAt'))throw new Error('appointment audit count/diff/privacy');
  results.checks.push({name:'appointment successful mutation audit sequence',measuredRows:appointmentAuditRows.length,actions:appointmentAuditRows.map(row=>row.action)});
  const statusChange=await fetch(origin+'/api/v1/users/'+auditUser.id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.admin},body:JSON.stringify({isActive:false})});if(statusChange.status!==200)throw new Error('successful user status failed');
  for(const value of ['false',0,null]){
   const invalid=await fetch(origin+'/api/v1/users/'+auditUser.id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.admin},body:JSON.stringify({isActive:value})});if(invalid.status!==400)throw new Error('untyped user status accepted');
  }
  const finalUserAudits=await prisma.auditLog.findMany({where:{entityId:auditUser.id}});
  if(finalUserAudits.length!==2||JSON.stringify(finalUserAudits).includes('Fictional Audited User')||JSON.stringify(finalUserAudits).includes(password))throw new Error('user audit privacy/exact count failure');
  // Current persisted session roles override signed claims, even on read/guard paths.
  const sessionAudits=await prisma.auditLog.count();
  await prisma.user.update({where:{id:adminActor.id},data:{role:'nurse'}});
  await post('/users','admin',{username:'must_not_be_created',password:'SyntheticTestOnly123!',fullName:'Fictional denied user',role:'nurse'},403);
  await prisma.user.update({where:{id:adminActor.id},data:{role:'admin'}});
  if(await prisma.user.count({where:{username:'must_not_be_created'}})!==0||await prisma.auditLog.count()!==sessionAudits)throw new Error('stale admin claim changed state');
  results.checks.push({name:'persisted current role overrides old admin token',status:403,userAndAuditUnchanged:true});

  const lifecycleCounts={appointments:await prisma.appointment.count(),audits:await prisma.auditLog.count()};
  const appointmentBody={patientId:contractPatient.id,doctorId:contractDoctor.id,departmentId:dep.id,scheduledAt:'2026-12-28T09:00:00Z'};
  const missingId='00000000-0000-4000-a000-000000000000';
  for(const [field,value,status] of [['patientId',missingId,404],['doctorId',missingId,404],['departmentId',missingId,404],['doctorId',receptionistId,409]])await post('/appointments','receptionist',{...appointmentBody,[field]:value},status);
  await prisma.user.update({where:{id:otherDoctor.id},data:{isActive:false}});
  await post('/appointments','receptionist',{...appointmentBody,doctorId:otherDoctor.id},409);
  await prisma.user.update({where:{id:otherDoctor.id},data:{isActive:true}});
  if(await prisma.appointment.count()!==lifecycleCounts.appointments||await prisma.auditLog.count()!==lifecycleCounts.audits)throw new Error('invalid appointment association side effects');
  results.checks.push({name:'appointment relation validation HTTP',missingPatientDoctorDepartment404:true,nonDoctorAndDisabledDoctor409:true,appointmentAndAuditCountsUnchanged:true});
  async function patch(path,role,body,expected){
   const res=await fetch(origin+'/api/v1'+path,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[role]},body:JSON.stringify(body)});
   const data=await res.json();if(res.status!==expected)throw new Error('patch '+path+' expected '+expected+' got '+res.status+' code '+data.error?.code);return data;
  }
  const beforeLifecycle=await prisma.auditLog.count();
  await post('/appointments/'+auditAppointment.id+'/cancel','receptionist',{reason:'second cancellation'},409);
  await patch('/appointments/'+auditAppointment.id,'receptionist',{scheduledAt:'2026-12-28T10:00:00Z'},409);
  await post('/appointments/'+parallelAppointment.id+'/cancel','receptionist',{},409);
  await patch('/appointments/'+parallelAppointment.id,'receptionist',{scheduledAt:'2026-12-28T10:00:00Z'},409);
  const editable=await post('/appointments','receptionist',appointmentBody,201);
  await patch('/appointments/'+editable.id,'receptionist',{departmentId:missingId},404);
  if(await prisma.auditLog.count()!==beforeLifecycle+1||(await prisma.appointment.findUniqueOrThrow({where:{id:editable.id}})).departmentId!==dep.id)throw new Error('appointment lifecycle no-op audit or invalid edit');
  const dualCancel=await Promise.all([1,2].map(()=>fetch(origin+'/api/v1/appointments/'+editable.id+'/cancel',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:'{}'})));
  if(dualCancel.filter(r=>r.status===201).length!==1||dualCancel.filter(r=>r.status===409).length!==1||await prisma.auditLog.count({where:{entityId:editable.id,action:'APPOINTMENT_CANCELLED'}})!==1)throw new Error('duplicate cancellation audit');
  results.checks.push({name:'appointment lifecycle and double cancel HTTP',cancelledUpdateAndCancel409:true,encounterLinkedUpdateAndCancel409:true,missingUpdateDepartment404:true,parallelCancelSuccesses:1,parallelCancelConflicts:1,cancelAudits:1});

  const adminBefore=await prisma.auditLog.count();
  const adminCount=await prisma.user.count({where:{role:'admin',isActive:true}});
  await patch('/users/'+adminActor.id+'/status','admin',{isActive:false},409);
  if(!(await prisma.user.findUniqueOrThrow({where:{id:adminActor.id}})).isActive||await prisma.auditLog.count()!==adminBefore||await prisma.user.count({where:{role:'admin',isActive:true}})!==adminCount)throw new Error('self-disable protection changed state');
  const adminTwo=await prisma.user.create({data:{username:'synthetic_second_admin',passwordHash:'not-a-login',fullName:'Fictional Second Admin',role:'admin'}});
  const {UsersService}=require(backend+'/dist/src/modules/users/users.service.js');
  const crossDisable=await Promise.allSettled([new UsersService(prisma).setActiveStatus(adminTwo.id,false,adminActor.id),new UsersService(prisma).setActiveStatus(adminActor.id,false,adminTwo.id)]);
  if(crossDisable.filter(r=>r.status==='fulfilled').length!==1||crossDisable.filter(r=>r.status==='rejected'&&r.reason.getStatus?.()===403).length!==1||await prisma.user.count({where:{id:{in:[adminActor.id,adminTwo.id]},isActive:true}})!==1||await prisma.auditLog.count()!==adminBefore+1)throw new Error('cross admin deactivation race');
  await prisma.user.updateMany({where:{id:{in:[adminActor.id,adminTwo.id]}},data:{isActive:true}});
  results.checks.push({name:'admin self-disable and simultaneous cross-disable protection',selfStatus:409,selfNoAudit:true,crossSuccesses:1,crossDenied403:1,crossAudits:1,activeAdminsPreserved:true,scope:'conservative implementation safeguard, not explicit user requirement'});

  // Force both status transactions to overlap and observe actual PostgreSQL blocking.
  let heldResolve, contenderResolve, releaseHolder;
  const held=new Promise(r=>heldResolve=r),contender=new Promise(r=>contenderResolve=r),holderMayFinish=new Promise(r=>releaseHolder=r);
  let holderPid,contenderPid;
  const overlapAuditStart=await prisma.auditLog.count();
  const lockWrapper=holder=>({$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){
   if(key==='$executeRaw')return async (...args)=>{
    if(!String(args[0]?.[0]??'').includes('pg_advisory_xact_lock(18472932)'))return tx.$executeRaw(...args);
    const [{pid}]=await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid');
    if(holder){holderPid=pid;const value=await tx.$executeRaw(...args);heldResolve();await holderMayFinish;return value}
    contenderPid=pid;contenderResolve();return tx.$executeRaw(...args);
   };
   return target[key];
  }})),{timeout:15000})});
  const holderStatus=new UsersService(lockWrapper(true)).setActiveStatus(adminTwo.id,false,adminActor.id);
  await held;
  const contenderStatus=new UsersService(lockWrapper(false)).setActiveStatus(adminActor.id,false,adminTwo.id).then(()=>({status:200}),error=>({status:error.getStatus?.()}));
  await contender;
  let observedBlocking=false;
  try{
   for(let attempt=0;attempt<100;attempt++){
    const [state]=await (migrationOwner??prisma).$queryRawUnsafe('SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS blocked',holderPid,contenderPid);
    if(state.blocked){observedBlocking=true;break}await new Promise(r=>setTimeout(r,20));
   }
  }finally{releaseHolder()}
  await holderStatus;const contenderOutcome=await contenderStatus;
  if(!observedBlocking||contenderOutcome.status!==403||await prisma.user.count({where:{id:{in:[adminActor.id,adminTwo.id]},isActive:true}})!==1||await prisma.auditLog.count()!==overlapAuditStart+1)throw new Error('deterministic admin overlap invariant');
  await prisma.user.updateMany({where:{id:{in:[adminActor.id,adminTwo.id]}},data:{isActive:true}});
  results.checks.push({name:'deterministic overlapping cross-admin status transactions',postgresBlockingObserved:true,holderCommits:true,waiterRechecksActor403:true,oneActiveAdmin:true,auditsBefore:overlapAuditStart,auditsAfter:await prisma.auditLog.count(),oneAdditionalAudit:true});

  // Force database rejection for every newly converted clinical handler over HTTP.
  const sqlPatient=await post('/patients','receptionist',{fullName:'Fictional SQL Audit Patient',dateOfBirth:'1985-01-01',gender:'male',phone:'0000000000'},201);
  const sqlEncounter=await post('/encounters','doctor',{patientId:sqlPatient.id,chiefComplaint:'SQL test complaint',diagnosis:'SQL test diagnosis'},201);
  await (migrationOwner??prisma).$executeRawUnsafe(`CREATE FUNCTION hms_test_reject_clinical_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('PATIENT_CREATED','PATIENT_UPDATED','ENCOUNTER_CREATED','PRESCRIPTION_ADDED','ENCOUNTER_SOFT_DELETED') THEN RAISE EXCEPTION 'synthetic clinical audit rejection'; END IF; RETURN NEW; END $$`);
  await (migrationOwner??prisma).$executeRawUnsafe('CREATE TRIGGER hms_test_clinical_audit_rejection BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_reject_clinical_audit()');
  try{
   const before={patients:await prisma.patient.count(),encounters:await prisma.encounter.count(),prescriptions:await prisma.prescription.count(),audits:await prisma.auditLog.count()};
   await post('/patients','receptionist',{fullName:'Fictional SQL Rollback Patient',dateOfBirth:'1986-01-01',gender:'female',phone:'0000000000'},503);
   const patch=await fetch(origin+'/api/v1/patients/'+sqlPatient.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.receptionist},body:JSON.stringify({phone:'0000000003'})});
   const patchBody=await patch.json();if(patch.status!==503||patchBody.error?.code!=='AUDIT_PERSISTENCE_FAILED')throw new Error('patient update audit failure HTTP contract');
   await post('/encounters','doctor',{patientId:sqlPatient.id,chiefComplaint:'SQL failed complaint',diagnosis:'SQL failed diagnosis'},503);
   await post('/encounters/'+sqlEncounter.id+'/prescriptions','doctor',{medicationName:'Synthetic',dosage:'test only',duration:'test only'},503);
   const deletion=await fetch(origin+'/api/v1/encounters/'+sqlEncounter.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.doctor},body:JSON.stringify({reason:'Synthetic failed deletion'})});
   const deletionBody=await deletion.json();if(deletion.status!==503||deletionBody.error?.code!=='AUDIT_PERSISTENCE_FAILED')throw new Error('encounter delete audit failure HTTP contract');
   if(await prisma.patient.count()!==before.patients||await prisma.encounter.count()!==before.encounters||await prisma.prescription.count()!==before.prescriptions||await prisma.auditLog.count()!==before.audits||(await prisma.patient.findUniqueOrThrow({where:{id:sqlPatient.id}})).phone!=='0000000000'||(await prisma.encounter.findUniqueOrThrow({where:{id:sqlEncounter.id}})).deletedAt!==null)throw new Error('clinical SQL rejection failed rollback');
   results.checks.push({name:'five clinical HTTP mutations rejected by SQL audit trigger roll back',operations:['patient create','patient update','encounter create','prescription add','encounter soft-delete'],expectedStatus:503,unchangedState:true,noSuccessAudit:true});
  }finally{
   await (migrationOwner??prisma).$executeRawUnsafe('DROP TRIGGER hms_test_clinical_audit_rejection ON audit_logs');
   await (migrationOwner??prisma).$executeRawUnsafe('DROP FUNCTION hms_test_reject_clinical_audit()');
  }
  const patient=await post('/patients','receptionist',{fullName:'Fictional Workflow Patient',dateOfBirth:'1990-01-01',gender:'female',phone:'0000000000'},201);
  const httpDoctor=await prisma.user.findFirstOrThrow({where:{username:'http_doctor'}});
  const appointment=await post('/appointments','receptionist',{patientId:patient.id,doctorId:httpDoctor.id,departmentId:dep.id,scheduledAt:'2026-12-02T09:00:00.000Z'},201);
  const encounter=await post('/encounters','doctor',{patientId:patient.id,appointmentId:appointment.id,chiefComplaint:'Synthetic demonstration',diagnosis:'Fictional note only',notes:'Not clinical advice'},201);
  await post('/encounters','receptionist',{patientId:patient.id,chiefComplaint:'Synthetic demonstration',diagnosis:'Fictional note only'},403);
  const saved=await prisma.encounter.findUniqueOrThrow({where:{id:encounter.id}});
  if(saved.patientId!==patient.id||saved.appointmentId!==appointment.id||saved.doctorId!==httpDoctor.id)throw new Error('workflow linkage failed');
  const read=await fetch(origin+'/api/v1/patients/'+patient.id+'/records',{headers:{Authorization:'Bearer '+tokens.nurse}});
  if(read.status!==200)throw new Error('nurse records read failed');
  const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:encounter.id,action:'ENCOUNTER_CREATED'}});
  if(audit.userId!==httpDoctor.id||audit.entityType!=='Encounter'||!audit.newValue)throw new Error('audit actor/action/entity missing');
  const auditText=JSON.stringify(audit);
  for(const value of ['Synthetic demonstration','Fictional note only','Not clinical advice'])if(auditText.includes(value))throw new Error('audit clinical text leaked');
  if(audit.oldValue!==null)throw new Error('untrusted audit before-state retained');
  if(audit.newValue.diagnosis!=='[REDACTED]'||audit.newValue.patientId!==patient.id)throw new Error('audit snapshot contract failed');
  const deniedAudits=await prisma.auditLog.count({where:{userId:(await prisma.user.findFirstOrThrow({where:{username:'http_receptionist'}})).id,action:'ENCOUNTER_CREATED'}});
  if(deniedAudits!==0)throw new Error('denied operation recorded as success');
  results.checks.push({name:'real HTTP audit persisted before response completion',actorActionEntity:true,clinicalTextRedacted:true,clientBeforeStateIgnored:true,deniedNotRecordedAsSuccess:true,scope:'successful mutation audit only; not denied/login-event auditing or atomic transaction guarantee'});
  results.checks.push({name:'real HTTP reception registration to appointment to doctor encounter',persistedLinkage:true,receptionEncounterDenied:403,nurseRecordsRead:200,scope:'API/database journey, not browser UX acceptance'});

 }finally{await app.close()}
 results.sourceHashes=Object.fromEntries(['src/modules/appointments/dto/find-appointments.dto.ts','src/modules/auth/auth.service.ts','src/modules/auth/auth.controller.ts','src/common/filters/http-exception.filter.ts','src/modules/auth/strategies/jwt.strategy.ts','src/app.factory.ts','src/modules/users/users.service.ts','src/modules/users/users.controller.ts','src/modules/appointments/appointments.service.ts','src/modules/appointments/appointments.controller.ts','src/modules/lab/lab.service.ts','src/modules/lab/lab.controller.ts','src/modules/pharmacy/pharmacy.service.ts','src/modules/pharmacy/pharmacy.controller.ts','src/modules/billing/billing.controller.ts','src/modules/billing/billing.service.ts','src/common/transaction-audit.ts','src/modules/encounters/encounters.service.ts','src/modules/encounters/encounters.controller.ts','src/modules/patients/patients.service.ts','src/modules/patients/patients.controller.ts','src/common/audit-snapshot.ts','src/modules/admissions/admission-audit.ts','src/modules/admissions/admissions.controller.ts','src/common/decorators/audit.decorator.ts','src/common/interceptors/audit.interceptor.ts','src/modules/admissions/admissions.service.ts','src/modules/departments/departments.controller.ts','src/modules/departments/departments.service.ts','test-real-postgres/concurrency.mjs'].map(path=>[path,require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(backend+'/'+path)).digest('hex')]));
 results.assertionsPassed=true;
 console.log(JSON.stringify(results,null,2));
}catch(e){results.error=String(e?.stack??e);console.error(results.error);process.exitCode=1}
finally{writeFileSync(process.env.HMS_TEST_REPORT ?? 'postgres-regression.json',JSON.stringify(results,null,2));if(prisma)await prisma.$disconnect();if(migrationOwner){await migrationOwner.$executeRawUnsafe('DROP OWNED BY hms_test_runtime');await migrationOwner.$executeRawUnsafe('DROP ROLE hms_test_runtime');await migrationOwner.$disconnect()}}
