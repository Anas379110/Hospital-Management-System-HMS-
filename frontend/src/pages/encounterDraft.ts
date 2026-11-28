import type { CreateEncounterInput } from '../hooks/useEncounters';
export function encounterInput(patientId: string, chiefComplaint: string, diagnosis: string, notes: string): CreateEncounterInput {
 return { patientId, chiefComplaint, diagnosis, ...(notes === '' ? {} : { notes }) };
}
