import type { PrescriptionInput } from '../api/prescriptionCreateWrite';
export function prescriptionInput(encounterId: string, medicationName: string, dosage: string, duration: string, notes: string): PrescriptionInput {
 return { encounterId, medicationName, dosage, duration, ...(notes === '' ? {} : { notes }) };
}
