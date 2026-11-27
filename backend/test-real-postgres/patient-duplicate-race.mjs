import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

// Gate outside application transactions. Waiting after each acquired lock would deadlock.
export async function verifyPatientDuplicateRace({call,tokens,owner,workspaceId}) {
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
      requests=Promise.all([call('/patients'+(force?'?force=true':''),tokens.receptionist,body),call('/patients'+(force?'?force=true':''),tokens.receptionist,body)]);
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
  const other=await call('/demo/start',null,{});assert.equal(other.status,201);
  assert.equal((await call('/patients',other.data.accessToken,body)).status,201,'Foreign workspace must not trigger duplicate disclosure');
  for(const role of ['doctor','nurse','manager','pharmacist','lab_tech','billing_clerk'])assert.equal((await call('/patients',tokens[role],body)).status,403);
  assert.equal((await call('/patients',null,body)).status,401);
  const rollback={...body,fullName:'Fictional duplicate rollback'};
  await owner.$executeRawUnsafe("CREATE FUNCTION hms_test_patient_race_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PATIENT_CREATED' THEN RAISE EXCEPTION 'fictional patient audit failure'; END IF; RETURN NEW; END $$");
  await owner.$executeRawUnsafe('CREATE TRIGGER hms_test_patient_race_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_patient_race_audit_reject()');
  try {assert.equal((await call('/patients',tokens.receptionist,rollback)).status,503);assert.equal(await owner.patient.count({where:{workspaceId,fullName:rollback.fullName}}),0);}
  finally {await owner.$executeRawUnsafe('DROP TRIGGER hms_test_patient_race_failure ON audit_logs');await owner.$executeRawUnsafe('DROP FUNCTION hms_test_patient_race_audit_reject()');}
  assert.equal((await call('/patients',tokens.receptionist,rollback)).status,201,'Failed transaction releases registration lock and retry succeeds');
  return {namedCases:[{name:'synchronized exact name+DOB unforced registration pair',statuses:raced.map(x=>x.status).sort(),expected:[201,409],patientRows:1,successAuditRows:1},{name:'explicit force override registration pair',statuses:forced.map(x=>x.status),expected:[201,201],uniqueMrns:2},{name:'audit insert failure then retry',failureStatus:503,rolledBackRows:0,retryStatus:201}],defaultIsolation:isolation,synchronizedUnforcedStatuses:[201,409],forcedStatuses:[201,201],uniqueForcedMrns:2,oneWinnerAudit:true,foreignWorkspaceIndependent:true,distinctNameOrDobAllowed:true,forbiddenRoles:6,anonymous401:true,auditFailure503RollbackAndRetry:true,scope:'Existing exact name+DOB only, no national-ID normalization or unique-patient constraint'};
}
