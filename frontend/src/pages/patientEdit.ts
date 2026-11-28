import type { Patient } from '../types/api';

export const editablePatientFields = ['fullName', 'phone', 'nationalId', 'address', 'emergencyContactName', 'emergencyContactPhone'] as const;
export type PatientEditField = typeof editablePatientFields[number];
export type PatientDraft = Record<PatientEditField, string>;
export type PatientPatch = Partial<Record<PatientEditField, string | null>>;

export function patientDraft(patient: Patient): PatientDraft {
  return Object.fromEntries(editablePatientFields.map(key => [key, patient[key] ?? ''])) as PatientDraft;
}

/** Existing DTO only. No normalization, DOB/gender update or new duplicate rule. */
export function patientPatch(patient: Patient, draft: PatientDraft): PatientPatch {
  const patch: PatientPatch = {};
  for (const key of editablePatientFields) {
    if (draft[key] === (patient[key] ?? '')) continue;
    patch[key] = key === 'fullName' || key === 'phone' ? draft[key] : draft[key] === '' ? null : draft[key];
  }
  return patch;
}

export function patientPatchValid(patch: PatientPatch): boolean {
  return patch.fullName === undefined || (typeof patch.fullName === 'string' && patch.fullName.length >= 3);
}
