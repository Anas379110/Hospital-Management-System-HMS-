import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
vi.mock('../i18n/i18n', () => ({ default: { t: (key: string) => key } }));
import { apiClient } from './client';
import { acknowledgeMedicationCreate as acknowledge, sendMedicationCreate } from './medicationCreateWrite';
import { clearSessionQueries, sessionEpoch } from './sessionIsolation';
import { medicationCreateHeld } from '../components/medicationCreate';
import { QueryClient } from '@tanstack/react-query';
const acknowledgeMedicationCreate = (request: Parameters<typeof acknowledge>[0], client = new QueryClient()) => acknowledge(request, client);
const input = { name: 'Fictional medicine', unit: 'box', currentStock: 0 };
const medication = { id: '00000000-0000-4000-a000-000000000099', ...input, reorderThreshold: 10 };
let identity: string;
beforeEach(() => { identity = 'u';const storage = new Map<string, string>();Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'hms_user' ? JSON.stringify({ userId: identity }) : null } }); });
it('refuses synchronous second request and mounted held retry without overwriting/clearing first uncertainty', async () => {
  let calls = 0, fail!: () => void;
  apiClient.defaults.adapter = config => new Promise((_resolve, reject) => { calls++;fail = () => reject(new axios.AxiosError('lost', undefined, config)); });
  const request = { input, userId: 'u', epoch: sessionEpoch() };
  const first = sendMedicationCreate(request);const rejection = expect(first).rejects.toThrow('lost');
  await expect(sendMedicationCreate(request)).rejects.toThrow('already held');await Promise.resolve();await Promise.resolve();expect(calls).toBe(1);fail();await rejection;expect(medicationCreateHeld('u')).toBe(true);await expect(sendMedicationCreate(request)).rejects.toThrow('already held');expect(calls).toBe(1);
});
it('checks captured owner before marker/dispatch and rechecks at adapter boundary', async () => {
  let calls = 0;apiClient.defaults.adapter = async config => { calls++;return { data: medication, status: 201, statusText: 'Created', headers: {}, config }; };
  const request = { input, userId: 'u', epoch: sessionEpoch() };identity = 'other';await expect(sendMedicationCreate(request)).rejects.toThrow('session changed');expect(medicationCreateHeld('u')).toBe(false);identity = 'u';const sending = sendMedicationCreate(request);identity = 'other';await expect(sending).rejects.toThrow('session changed');expect(calls).toBe(0);expect(medicationCreateHeld('u')).toBe(true);expect(medicationCreateHeld('other')).toBe(false);
});
it.each([[200, medication], [201, {}], [201, { ...medication, currentStock: 7 }], [204, null]])('holds unexpected success status/body %s', async (status, data) => { apiClient.defaults.adapter = async config => ({ data, status: status as number, statusText: 'OK', headers: {}, config });await expect(sendMedicationCreate({ input, userId: 'u', epoch: sessionEpoch() })).rejects.toThrow('Unverified');expect(medicationCreateHeld('u')).toBe(true); });
it('clears only verified current201 and preserves stale valid201 without clearing', async () => {
  apiClient.defaults.adapter = async config => ({ data: medication, status: 201, statusText: 'Created', headers: {}, config });expect(await sendMedicationCreate({ input, userId: 'u', epoch: sessionEpoch() })).toEqual(medication);expect(medicationCreateHeld('u')).toBe(false);
  let finish!: () => void;apiClient.defaults.adapter = config => new Promise(resolve => { finish = () => resolve({ data: medication, status: 201, statusText: 'Created', headers: {}, config }); });const sending = sendMedicationCreate({ input, userId: 'u', epoch: sessionEpoch() });await Promise.resolve();await Promise.resolve();clearSessionQueries();finish();expect(await sending).toEqual(medication);expect(medicationCreateHeld('u')).toBe(true);
});
it('received400 clears marker but propagates original error', async () => { apiClient.defaults.adapter = async config => { throw new axios.AxiosError('invalid', undefined, config, undefined, { data: {}, status: 400, statusText: 'Bad Request', headers: {}, config }); };await expect(sendMedicationCreate({ input, userId: 'u', epoch: sessionEpoch() })).rejects.toThrow('invalid');expect(medicationCreateHeld('u')).toBe(false); });

it('dedicated acknowledgment does not join initial pending inventory and failure retains hold', async () => {
  const { QueryClient, QueryObserver } = await import('@tanstack/react-query');
  let completeInitial!: () => void, reads = 0;
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
  const observer = new QueryObserver(client, { queryKey: ['medications'], queryFn: () => new Promise(resolve => { completeInitial = () => resolve([medication]); }) });
  const unsubscribe = observer.subscribe(() => {});
  sessionStorage.setItem('hms_medication_create_unknown:u', 'true');
  apiClient.defaults.adapter = async config => { reads++;completeInitial();throw new axios.AxiosError('read failed', undefined, config, undefined, { data: {}, status: 503, statusText: 'Unavailable', headers: {}, config }); };
  await expect(acknowledgeMedicationCreate({ userId: 'u', epoch: sessionEpoch() })).rejects.toThrow('read failed');
  expect(reads).toBe(1);expect(medicationCreateHeld('u')).toBe(true);
  apiClient.defaults.adapter = async config => { reads++;return { data: [medication], status: 200, statusText: 'OK', headers: {}, config }; };
  await acknowledgeMedicationCreate({ userId: 'u', epoch: sessionEpoch() });expect(reads).toBe(2);expect(medicationCreateHeld('u')).toBe(false);unsubscribe();client.clear();
});
it.each([[204, []], [200, {}], [200, [{ id: 'invalid' }]], [200, [{ ...medication, currentStock: '1' }]]])('invalid acknowledgment response retains marker %s', async (status, data) => {
  sessionStorage.setItem('hms_medication_create_unknown:u', 'true');apiClient.defaults.adapter = async config => ({ data, status: status as number, statusText: 'OK', headers: {}, config });await expect(acknowledgeMedicationCreate({ userId: 'u', epoch: sessionEpoch() })).rejects.toThrow('Unverified');expect(medicationCreateHeld('u')).toBe(true);
});
it('stale dedicated read cannot clear old or new owner marker', async () => {
  sessionStorage.setItem('hms_medication_create_unknown:u', 'true');sessionStorage.setItem('hms_medication_create_unknown:other', 'true');
  apiClient.defaults.adapter = async config => { clearSessionQueries();identity = 'other';return { data: [], status: 200, statusText: 'OK', headers: {}, config }; };
  await expect(acknowledgeMedicationCreate({ userId: 'u', epoch: sessionEpoch() })).rejects.toThrow();expect(medicationCreateHeld('u')).toBe(true);expect(medicationCreateHeld('other')).toBe(true);
});

it('publishes fresh inventory and prevents an older initial response overwriting it, accepts legacy strings', async () => {
  const { QueryObserver } = await import('@tanstack/react-query');const client = new QueryClient();let old!: () => void;
  const observer = new QueryObserver(client, { queryKey: ['medications'], queryFn: () => new Promise(resolve => { old = () => resolve([]); }) });const unsubscribe = observer.subscribe(() => {});
  const legacy = { ...medication, name: '', unit: '' };sessionStorage.setItem('hms_medication_create_unknown:u', 'true');
  apiClient.defaults.adapter = async config => ({ data: [legacy], status: 200, statusText: 'OK', headers: {}, config });
  await acknowledgeMedicationCreate({ userId: 'u', epoch: sessionEpoch() }, client);old();await Promise.resolve();await Promise.resolve();expect(client.getQueryData(['medications'])).toEqual([legacy]);expect(medicationCreateHeld('u')).toBe(false);unsubscribe();client.clear();
});
