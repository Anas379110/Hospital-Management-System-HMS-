import axios from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { isCurrentSession } from './sessionIsolation';
import { beginEncounterWrite, finishEncounterWrite, encounterWriteKey } from './encounterPending';
import type { Encounter } from '../types/emr';
export interface EncounterInput { patientId: string; chiefComplaint: string; diagnosis: string; notes?: string }
export interface EncounterIdentity { userId: string; patientId: string; epoch: number }
export function assertEncounterIdentity(request: EncounterIdentity) {
  if (!isCurrentSession(request.epoch) || JSON.parse(localStorage.getItem('hms_user') ?? 'null')?.userId !== request.userId) throw new Error('Encounter session changed');
}
export function validEncounterRow(value: unknown): value is Encounter {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Encounter>;
  return typeof row.id === 'string' && typeof row.patientId === 'string' && typeof row.doctorId === 'string' && typeof row.chiefComplaint === 'string' && typeof row.diagnosis === 'string' && (row.notes === undefined || row.notes === null || typeof row.notes === 'string') && typeof row.encounterDate === 'string';
}
export async function sendEncounterCreate(request: EncounterIdentity & { input: EncounterInput }): Promise<Encounter> {
  assertEncounterIdentity(request);
  if (request.patientId !== request.input.patientId) throw new Error('Encounter patient changed');
  const key = beginEncounterWrite(request.userId, request.patientId);
  try {
    const response = await apiClient.post<unknown>('/encounters', request.input, { headers: { 'Content-Type': 'application/json' }, transformRequest: [data => { assertEncounterIdentity(request);return JSON.stringify(data); }] });
    if (response.status !== 201 || !validEncounterRow(response.data) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(response.data.id) || response.data.patientId !== request.patientId || response.data.doctorId !== request.userId || response.data.chiefComplaint !== request.input.chiefComplaint || response.data.diagnosis !== request.input.diagnosis || (response.data.notes ?? undefined) !== request.input.notes) throw new Error('Unverified encounter creation response');
    if (isCurrentSession(request.epoch)) sessionStorage.removeItem(key);
    return response.data;
  } catch (error) { finishEncounterWrite(key, isCurrentSession(request.epoch), axios.isAxiosError(error) ? error.response?.status : undefined);throw error; }
}
export async function acknowledgeEncounterCreate(request: EncounterIdentity, client: QueryClient): Promise<void> {
  assertEncounterIdentity(request);
  const queryKey = ['patients', request.patientId, 'records'];
  await client.cancelQueries({ queryKey, exact: true });assertEncounterIdentity(request);
  const response = await apiClient.get<unknown>(`/patients/${request.patientId}/records`);assertEncounterIdentity(request);
  if (response.status !== 200 || !Array.isArray(response.data) || !response.data.every(row => validEncounterRow(row) && row.patientId === request.patientId && Array.isArray(row.prescriptions) && row.prescriptions.every((rx: unknown) => !!rx && typeof rx === 'object' && typeof (rx as {id?: unknown}).id === 'string' && typeof (rx as {medicationName?: unknown}).medicationName === 'string' && typeof (rx as {dosage?: unknown}).dosage === 'string' && typeof (rx as {duration?: unknown}).duration === 'string'))) throw new Error('Unverified encounter records response');
  await client.cancelQueries({ queryKey, exact: true });assertEncounterIdentity(request);
  client.setQueryData(queryKey, response.data);sessionStorage.removeItem(encounterWriteKey(request.userId, request.patientId));
}
