import axios from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { assertEncounterIdentity, validEncounterRow, type EncounterIdentity } from './encounterCreateWrite';
import { isCurrentSession } from './sessionIsolation';
import type { Prescription } from '../types/emr';
export interface PrescriptionInput { encounterId: string; medicationName: string; dosage: string; duration: string; notes?: string }
export interface PrescriptionRequest extends EncounterIdentity { input: PrescriptionInput }
export function prescriptionTargetKey(userId: string, patientId: string) { return 'hms_prescription_pending_target:' + userId + ':' + patientId; }
export function prescriptionHeld(userId: string, patientId: string) { try { return sessionStorage.getItem(prescriptionTargetKey(userId, patientId)) !== null; } catch { return true; } }
export async function sendPrescriptionCreate(request: PrescriptionRequest): Promise<Prescription> {
 assertEncounterIdentity(request);
 const key = prescriptionTargetKey(request.userId, request.patientId);
 if (prescriptionHeld(request.userId, request.patientId)) throw new Error('Prescription create already held');
 if (!request.input.encounterId) throw new Error('Missing prescription target');
 sessionStorage.setItem(key, request.input.encounterId);
 try {
  const response = await apiClient.post<unknown>(`/encounters/${request.input.encounterId}/prescriptions`, { medicationName: request.input.medicationName, dosage: request.input.dosage, duration: request.input.duration, ...(request.input.notes === undefined ? {} : { notes: request.input.notes }) }, { transformRequest: [data => { assertEncounterIdentity(request);return JSON.stringify(data); }], headers: { 'Content-Type': 'application/json' } });
  const row = response.data as Partial<Prescription> & { encounterId?: string };
  if (response.status !== 201 || !row || typeof row !== 'object' || typeof row.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.id) || row.encounterId !== request.input.encounterId || row.medicationName !== request.input.medicationName || row.dosage !== request.input.dosage || row.duration !== request.input.duration || (row.notes ?? undefined) !== request.input.notes) throw new Error('Unverified prescription response');
  assertEncounterIdentity(request);sessionStorage.removeItem(key);
  return row as Prescription;
 } catch (error) {
  if (isCurrentSession(request.epoch) && axios.isAxiosError(error) && [400, 401, 403, 404, 409, 422].includes(error.response?.status ?? 0)) sessionStorage.removeItem(key);
  throw error;
 }
}
export async function acknowledgePrescriptionCreate(request: EncounterIdentity, client: QueryClient) {
 assertEncounterIdentity(request);
 const queryKey = ['patients', request.patientId, 'records'];
 await client.cancelQueries({ queryKey, exact: true });assertEncounterIdentity(request);
 const response = await apiClient.get<unknown>(`/patients/${request.patientId}/records`);assertEncounterIdentity(request);
 if (response.status !== 200 || !Array.isArray(response.data) || !response.data.every(row => validEncounterRow(row) && row.patientId === request.patientId && Array.isArray(row.prescriptions) && row.prescriptions.every((rx: unknown) => !!rx && typeof rx === 'object' && typeof (rx as Prescription).id === 'string' && typeof (rx as Prescription).medicationName === 'string' && typeof (rx as Prescription).dosage === 'string' && typeof (rx as Prescription).duration === 'string'))) throw new Error('Unverified prescription readback');
 await client.cancelQueries({ queryKey, exact: true });assertEncounterIdentity(request);
 client.setQueryData(queryKey, response.data);sessionStorage.removeItem(prescriptionTargetKey(request.userId, request.patientId));
}
