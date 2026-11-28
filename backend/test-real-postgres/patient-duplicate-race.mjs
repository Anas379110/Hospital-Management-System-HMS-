import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

// Gate outside application transactions. Waiting after each acquired lock would deadlock.
export async function verifyPatientDuplicateRace({call,tokens,owner,workspaceId}) {
  const serverVersion=(await owner.$queryRawUnsafe("SELECT version() AS full_version,current_setting('server_version_num') AS version_num"))[0];
  const isolation=(await owner.$queryRawUnsafe('SHOW default_transaction_isolation'))[0].default_transaction_isolation;
  assert.equal(isolation,'read committed','Existing default isolation is required for fresh post-lock lookup');
  const runLockedPair=async(body,force=false)=>{
    let release,held;
    const gate=new Promise(resolve=>{release=resolve});
    const ready=new Promise(resolve=>{held=resolve});
    const holder=owner.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(18472931)`;
      held();
      await gate;
    },{timeout:15000});
    await ready;
    let requests;
    try {
      requests=Promise.all([call('/patients'+(force?'?force=true':''),tokens.receptionist,Array.isArray(body)?body[0]:body),call('/patients'+(force?'?force=true':''),tokens.receptionist,Array.isArray(body)?body[1]:body)]);
      const deadline=Date.now()+8000;
      let waiters=0;
      while(Date.now()<deadline){
        const rows=await owner.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND objid=18472931 AND NOT granted");
        waiters=rows[0].count;
        if(waiters>=2)break;
        await delay(20);
      }
      assert.ok(waiters>=2,'Both HTTP registrations must be waiting at the held existing lock');
    } finally { release();await holder; }
    return requests;
  };
  const body={fullName:'Fictional exact duplicate race',dateOfBirth:'1993-04-05',gender:'male',phone:'0000000000'};
  const raced=await runLockedPair(body);
  assert.deepEqual(raced.map(x=>x.status).sort(),[201,409]);
  assert.equal(raced.find(x=>x.status===409).data.error.code,'POSSIBLE_DUPLICATE_PATIENT');
  const winner=raced.find(x=>x.status===201).data;
  assert.equal(raced.find(x=>x.status===409).data.error.details[0].existingPatientId,winner.id);
  assert.equal(await owner.patient.count({where:{workspaceId,fullName:body.fullName,dateOfBirth:new Date(body.dateOfBirth)}}),1);
  assert.equal(await owner.auditLog.count({where:{entityId:winner.id,action:'PATIENT_CREATED'}}),1);
  const forced=await runLockedPair(body,true);
  assert.deepEqual(forced.map(x=>x.status),[201,201]);
  assert.equal(new Set(forced.map(x=>x.data.mrn)).size,2);
  for(const changed of [{...body,dateOfBirth:'1994-04-05'},{...body,fullName:body.fullName+' other'}])assert.equal((await call('/patients',tokens.receptionist,changed)).status,201);
  const nationalId='FICTIONAL-ID-001';
  const idPair=[{...body,fullName:'Fictional ID candidate one',dateOfBirth:'1991-01-01',nationalId},{...body,fullName:'Fictional ID candidate two',dateOfBirth:'1992-02-02',nationalId}];
  const idRace=await runLockedPair(idPair);assert.deepEqual(idRace.map(r=>r.status).sort(),[201,409]);const idWinner=idRace.find(r=>r.status===201).data;
  assert.deepEqual(idRace.find(r=>r.status===409).data.error.details,[{existingPatientId:idWinner.id,mrn:idWinner.mrn}]);
  assert.equal(await owner.patient.count({where:{workspaceId,nationalId}}),1);assert.equal(await owner.auditLog.count({where:{entityId:idWinner.id,action:'PATIENT_CREATED'}}),1);
  const override=await call('/patients?force=true',tokens.receptionist,{...body,fullName:'Fictional ID confirmed override',nationalId});assert.equal(override.status,201);assert.equal(override.data.nationalId,nationalId);
  for(const [i,value]of [undefined,null,'','   ',' FICTIONAL-ID-001 ','fictional-id-001','١٢٣','123'].entries()){
    const candidate={...body,fullName:'Fictional literal ID variant '+i,dateOfBirth:'1980-01-01',nationalId:value};const first=await call('/patients',tokens.receptionist,candidate);assert.equal(first.status,201);assert.equal(first.data.nationalId,value??null);
    const second=await call('/patients',tokens.receptionist,{...candidate,fullName:candidate.fullName+' different',dateOfBirth:'1981-01-01'});
    if(typeof value==='string'&&value.trim())assert.equal(second.status,409);
    else {assert.equal(second.status,201);assert.equal(second.data.nationalId,value??null)}
  }
  const patientA=await call('/patients',tokens.receptionist,{...body,fullName:'Fictional competing match A',dateOfBirth:'1970-01-01',nationalId:'FICTIONAL-COMPETING-A'});
  const patientB=await call('/patients',tokens.receptionist,{...body,fullName:'Fictional competing match B',dateOfBirth:'1971-01-01',nationalId:'FICTIONAL-COMPETING-B'});
  assert.equal(patientA.status,201);assert.equal(patientB.status,201);
  const beforeCompeting=await owner.patient.count({where:{workspaceId}});
  const competing=await call('/patients',tokens.receptionist,{...body,fullName:'Fictional competing match A',dateOfBirth:'1970-01-01',nationalId:'FICTIONAL-COMPETING-B'});
  assert.equal(competing.status,409);assert.equal(competing.data.error.code,'POSSIBLE_DUPLICATE_PATIENT');
  assert.equal(competing.data.error.details.length,1);
  assert.ok([patientA.data.id,patientB.data.id].includes(competing.data.error.details[0].existingPatientId),'Either actual matching candidate may be selected; no precedence policy introduced');
  assert.deepEqual(Object.keys(competing.data.error.details[0]).sort(),['existingPatientId','mrn']);
  assert.equal(await owner.patient.count({where:{workspaceId}}),beforeCompeting);
  const equality=await owner.$queryRawUnsafe("SELECT 'FICTIONAL-ID-001'::text = 'fictional-id-001'::text AS case_equal, 'FICTIONAL-ID-001'::text = ' FICTIONAL-ID-001 '::text AS padded_equal, '١٢٣'::text = '123'::text AS digit_equal");
  assert.deepEqual(equality,[{case_equal:false,padded_equal:false,digit_equal:false}]);
  const column=await owner.$queryRawUnsafe("SELECT data_type,collation_name FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='national_id'");
  const collation=await owner.$queryRawUnsafe("SELECT datcollate,datctype FROM pg_database WHERE datname=current_database()");
  const preserved=await owner.patient.findUnique({where:{id:idWinner.id}});assert.equal(preserved.nationalId,nationalId);
  const other=await call('/demo/start',null,{});assert.equal(other.status,201);
  assert.equal((await call('/patients',other.data.accessToken,body)).status,201,'Foreign workspace must not trigger duplicate disclosure');
  assert.equal((await call('/patients',other.data.accessToken,idPair[0])).status,201,'Foreign national ID must not disclose or block');
  for(const role of ['doctor','nurse','manager','pharmacist','lab_tech','billing_clerk'])assert.equal((await call('/patients',tokens[role],body)).status,403);
  assert.equal((await call('/patients',null,body)).status,401);
  const rollback={...body,fullName:'Fictional duplicate rollback'};
  await owner.$executeRawUnsafe("CREATE FUNCTION hms_test_patient_race_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PATIENT_CREATED' THEN RAISE EXCEPTION 'fictional patient audit failure'; END IF; RETURN NEW; END $$");
  await owner.$executeRawUnsafe('CREATE TRIGGER hms_test_patient_race_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_patient_race_audit_reject()');
  try {assert.equal((await call('/patients',tokens.receptionist,rollback)).status,503);assert.equal(await owner.patient.count({where:{workspaceId,fullName:rollback.fullName}}),0);}
  finally {await owner.$executeRawUnsafe('DROP TRIGGER hms_test_patient_race_failure ON audit_logs');await owner.$executeRawUnsafe('DROP FUNCTION hms_test_patient_race_audit_reject()');}
  assert.equal((await call('/patients',tokens.receptionist,rollback)).status,201,'Failed transaction releases registration lock and retry succeeds');
  return {namedCases:[{name:'synchronized exact name+DOB unforced registration pair',statuses:raced.map(x=>x.status).sort(),expected:[201,409],patientRows:1,successAuditRows:1},{name:'explicit force override registration pair',statuses:forced.map(x=>x.status),expected:[201,201],uniqueMrns:2},{name:'audit insert failure then retry',failureStatus:503,rolledBackRows:0,retryStatus:201}],defaultIsolation:isolation,serverVersion,synchronizedUnforcedStatuses:[201,409],forcedStatuses:[201,201],uniqueForcedMrns:2,oneWinnerAudit:true,foreignWorkspaceIndependent:true,distinctNameOrDobAllowed:true,forbiddenRoles:6,anonymous401:true,auditFailure503RollbackAndRetry:true,nationalIdRaceStatuses:idRace.map(r=>r.status).sort(),blankIdDifferentNameAndDobRepeatedRegistrations:4,competingNameDobAndNationalIdMatch409MinimalDetails:true,nationalIdColumn:column,equality,collation,literalNationalIdVariants:true,nationalIdOverride:true,scope:'Exact nonblank literal national ID OR existing name+DOB warning; no normalization, old-row rewrite or unique constraint'};
}
