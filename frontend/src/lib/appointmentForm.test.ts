import { describe, expect, it } from 'vitest';
import { localDateInput, validateAppointment } from './appointmentForm';
const valid = { patientId: '11111111-1111-4111-8111-111111111111', doctorId: '22222222-2222-4222-8222-222222222222', departmentId: '33333333-3333-4333-8333-333333333333', scheduledAt: '2026-11-23T10:30' };
describe('appointment entry validation', () => {
  it('accepts complete valid inputs without modifying them', () => {
    const before = JSON.stringify(valid);
    expect(validateAppointment(valid)).toEqual({});
    expect(JSON.stringify(valid)).toBe(before);
  });
  it('requires every field', () => {
    expect(validateAppointment({ patientId: '', doctorId: ' ', departmentId: '', scheduledAt: '' })).toEqual({ patientId: 'required', doctorId: 'required', departmentId: 'required', scheduledAt: 'required' });
  });
  it('rejects malformed and script-like identifiers', () => {
    for (const patientId of ['abc', '<script>', '11111111-1111-1111-1111-111111111111']) expect(validateAppointment({ ...valid, patientId }).patientId).toBe('uuid');
  });
  it('accepts trimmed identifiers', () => {
    expect(validateAppointment({ ...valid, doctorId: ` ${valid.doctorId} ` })).toEqual({});
  });
  it('rejects impossible calendar dates and malformed time input', () => {
    for (const scheduledAt of ['2026-02-30T10:30', 'not a date', '2026-11-23', '2026-11-23T25:30']) expect(validateAppointment({ ...valid, scheduledAt }).scheduledAt).toBe('datetime');
  });
  it('uses local calendar fields rather than UTC date', () => {
    const date = new Date(2026, 10, 23, 0, 15);
    expect(localDateInput(date)).toBe('2026-11-23');
  });
});
