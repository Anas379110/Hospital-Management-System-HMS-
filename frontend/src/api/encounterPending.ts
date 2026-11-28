import axios from 'axios';
export function encounterWriteKey(userId: string, patientId: string) { return 'hms_encounter_unknown:' + userId + ':' + patientId; }
export function encounterWriteHeld(userId: string, patientId: string) { try { return sessionStorage.getItem(encounterWriteKey(userId, patientId)) === 'true'; } catch { return true; } }
export function beginEncounterWrite(userId: string, patientId: string) { const key=encounterWriteKey(userId,patientId);if(encounterWriteHeld(userId,patientId))throw new Error('Encounter create already held');sessionStorage.setItem(key,'true');return key; }
export function finishEncounterWrite(key: string, current: boolean, status?: number) { if(current && status !== undefined && [400, 401, 403, 404, 409, 422].includes(status)) sessionStorage.removeItem(key); }
export function encounterErrorStatus(error: unknown) { return axios.isAxiosError(error) ? error.response?.status : undefined; }
