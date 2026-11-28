import axios from 'axios';
import { apiClient } from './client';
import { isCurrentSession } from './sessionIsolation';
import { beginMedicationCreate, finishMedicationCreate, type CreateMedicationInput } from '../components/medicationCreate';
import type { Medication } from '../types/pharmacy';
export interface MedicationCreateRequest { input: CreateMedicationInput; userId: string; epoch: number }
function assertIdentity(request: MedicationCreateRequest) {
  if (!isCurrentSession(request.epoch) || JSON.parse(localStorage.getItem('hms_user') ?? 'null')?.userId !== request.userId) throw new Error('Medication create session changed');
}
export function validMedicationCreated(value: unknown, input: CreateMedicationInput): value is Medication {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Medication>;
  return typeof row.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.id) && row.name === input.name && row.unit === input.unit && row.currentStock === input.currentStock && row.reorderThreshold === (input.reorderThreshold ?? 10);
}
/** Scoped request guard. No global write gate or change to other mutations. */
export async function sendMedicationCreate(request: MedicationCreateRequest): Promise<Medication> {
  assertIdentity(request);
  const key = beginMedicationCreate(request.userId);
  try {
    const response = await apiClient.post<unknown>('/medications', request.input, {
      headers: { 'Content-Type': 'application/json' },
      // Runs after async request interceptors, immediately before the adapter.
      transformRequest: [data => { assertIdentity(request);return JSON.stringify(data); }],
    });
    if (response.status !== 201 || !validMedicationCreated(response.data, request.input)) throw new Error('Unverified medication creation response');
    if (isCurrentSession(request.epoch)) sessionStorage.removeItem(key);
    return response.data;
  } catch (error) {
    finishMedicationCreate(key, isCurrentSession(request.epoch), axios.isAxiosError(error) ? error.response?.status : undefined);
    throw error;
  }
}
