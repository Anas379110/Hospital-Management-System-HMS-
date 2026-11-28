import axios from 'axios';
import { apiClient } from './client';
import { assertEncounterIdentity, validEncounterRow, type EncounterIdentity } from './encounterCreateWrite';
import type { Encounter } from '../types/emr';
export interface DeleteTarget { id: string; patientId: string; doctorId: string; diagnosis: string; encounterDate: string }
export interface DeleteRequest extends EncounterIdentity { target: DeleteTarget; reason: string }
export function deleteHoldKey(userId: string, patientId: string) { return 'hms_encounter_delete_pending:' + userId + ':' + patientId; }
export function readDeleteHold(userId: string, patientId: string): DeleteRequest['target'] | null {
 const raw=sessionStorage.getItem(deleteHoldKey(userId,patientId));if(!raw)return null;
 const value=JSON.parse(raw) as DeleteTarget;if(!value||typeof value.id!=='string'||value.patientId!==patientId||typeof value.doctorId!=='string'||typeof value.diagnosis!=='string'||typeof value.encounterDate!=='string')throw new Error('Invalid deletion hold');return value;
}
export function closeDeleteHold(request: EncounterIdentity) { assertEncounterIdentity(request);sessionStorage.removeItem(deleteHoldKey(request.userId,request.patientId)); }
export async function sendEncounterDelete(request: DeleteRequest): Promise<void> {
 assertEncounterIdentity(request);
 if(request.target.patientId!==request.patientId||request.reason.trim().length<5)throw new Error('Invalid deletion target or reason');
 if(readDeleteHold(request.userId,request.patientId))throw new Error('Deletion already held');
 const fresh=await apiClient.get<unknown>('/encounters/'+request.target.id);assertEncounterIdentity(request);
 const actor=JSON.parse(localStorage.getItem('hms_user')??'null');
 if(fresh.status!==200||!validEncounterRow(fresh.data)||fresh.data.id!==request.target.id||fresh.data.patientId!==request.patientId||fresh.data.doctorId!==request.target.doctorId||fresh.data.diagnosis!==request.target.diagnosis||fresh.data.encounterDate!==request.target.encounterDate||('deletedAt'in fresh.data&&fresh.data.deletedAt!==null)||!['doctor','admin'].includes(actor?.role)||(actor.role!=='admin'&&fresh.data.doctorId!==request.userId))throw new Error('Unverified deletion preflight');
 if(readDeleteHold(request.userId,request.patientId))throw new Error('Deletion already held');
 const key=deleteHoldKey(request.userId,request.patientId);sessionStorage.setItem(key,JSON.stringify(request.target));let dispatched=false;
 try{
  const response=await apiClient.delete<unknown>('/encounters/'+request.target.id,{data:{reason:request.reason},headers:{'Content-Type':'application/json'},transformRequest:[data=>{assertEncounterIdentity(request);dispatched=true;return JSON.stringify(data)}]});assertEncounterIdentity(request);
  const row=response.data as Partial<Encounter>&{deletedAt?:unknown;deleteReason?:unknown};
  if(response.status!==200||!validEncounterRow(row)||row.id!==request.target.id||row.patientId!==request.patientId||row.doctorId!==request.target.doctorId||row.diagnosis!==request.target.diagnosis||row.encounterDate!==request.target.encounterDate||typeof row.deletedAt!=='string'||!Number.isFinite(Date.parse(row.deletedAt))||row.deleteReason!==request.reason)throw new Error('Unverified deletion response');
  sessionStorage.removeItem(key);
 }catch(error){
  if(!dispatched||(axios.isAxiosError(error)&&[400,403,404,409,422].includes(error.response?.status??0))){assertEncounterIdentity(request);sessionStorage.removeItem(key)}
  throw error;
 }
}
export async function checkEncounterDelete(request: EncounterIdentity & {target:DeleteTarget}):Promise<'visible'|'unavailable'> {
 assertEncounterIdentity(request);let visibility:'visible'|'unavailable';
 try{const res=await apiClient.get<unknown>('/encounters/'+request.target.id);assertEncounterIdentity(request);if(res.status!==200||!validEncounterRow(res.data)||res.data.id!==request.target.id||res.data.patientId!==request.patientId||res.data.doctorId!==request.target.doctorId)throw new Error('Unverified current encounter');visibility='visible'}
 catch(error){assertEncounterIdentity(request);if(!axios.isAxiosError(error)||error.response?.status!==404||error.response.data?.error?.code!=='ENCOUNTER_NOT_FOUND')throw error;visibility='unavailable'}
 const records=await apiClient.get<unknown>('/patients/'+request.patientId+'/records');assertEncounterIdentity(request);if(records.status!==200||!Array.isArray(records.data)||!records.data.every(row=>validEncounterRow(row)&&row.patientId===request.patientId&&Array.isArray(row.prescriptions)))throw new Error('Unverified current history');
 const inHistory=records.data.some(row=>row.id===request.target.id);if(inHistory!==(visibility==='visible'))throw new Error('Conflicting current visibility');return visibility;
}
