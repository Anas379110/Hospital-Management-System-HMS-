import axios from 'axios';
export function beginEncounterWrite(userId: string, patientId: string) { const key='hms_encounter_unknown:'+userId+':'+patientId;sessionStorage.setItem(key,'true');return key; }
export function finishEncounterWrite(key: string, current: boolean, status?: number) { if(current && status !== undefined && status < 500) sessionStorage.removeItem(key); }
export function encounterErrorStatus(error: unknown) { return axios.isAxiosError(error) ? error.response?.status : undefined; }
