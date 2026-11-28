import { describe, expect, it } from 'vitest';
import { editablePatientFields, patientDraft, patientPatch, patientPatchValid } from './patientEdit';
import type { Patient } from '../types/api';
const patient: Patient = { id: 'fictional', mrn: 'HMS-1', fullName: 'Fictional Name', phone: '000000', dateOfBirth: '1990-01-01', gender: 'male', nationalId: null, address: 'Old', emergencyContactName: null, emergencyContactPhone: '111111' };
describe('existing patient PATCH form projection', () => {
  it('omits unchanged null and string fields', () => expect(patientPatch(patient, patientDraft(patient))).toEqual({}));
  it('sends null only for a changed nullable field cleared by the operator', () => expect(patientPatch(patient, { ...patientDraft(patient), address: '', emergencyContactPhone: '' })).toEqual({ address: null, emergencyContactPhone: null }));
  it('preserves literal national-ID spaces and digits', () => expect(patientPatch(patient, { ...patientDraft(patient), nationalId: ' ٠٠1 ' })).toEqual({ nationalId: ' ٠٠1 ' }));
  it('never sends DOB, gender, MRN or identifiers from the source', () => {
    const draft = { ...patientDraft(patient), fullName: 'Changed', dateOfBirth: '2000-01-01', gender: 'female', id: 'foreign' };
    expect(patientPatch(patient, draft)).toEqual({ fullName: 'Changed' });
    expect(editablePatientFields).toHaveLength(6);
  });
  it('does not mutate original patient or draft', () => {
    const original = JSON.stringify(patient), draft = patientDraft(patient), before = JSON.stringify(draft);
    patientPatch(patient, draft);
    expect(JSON.stringify(patient)).toBe(original); expect(JSON.stringify(draft)).toBe(before);
  });
});

it('validates only changed names, allowing unrelated legacy edits', () => {
  const legacy = { ...patient, fullName: 'Ab' };
  expect(patientPatchValid(patientPatch(legacy, { ...patientDraft(legacy), address: 'New' }))).toBe(true);
  expect(patientPatchValid({ fullName: 'X' })).toBe(false);
  expect(patientPatchValid({ fullName: 'Valid' })).toBe(true);
});
