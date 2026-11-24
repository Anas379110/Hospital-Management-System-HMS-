import { describe, expect, it } from 'vitest';
import { patientSchema } from './patientForm';
const valid = { fullName: 'Fictional Patient', dateOfBirth: '2000-02-29', gender: 'male', phone: '000000' };
describe('patient form Zod4validation', () => {
  it('accepts valid fictional input and optional empty fields', () => {
    expect(patientSchema.safeParse({ ...valid, nationalId: '', address: '' }).success).toBe(true);
  });
  it('rejects missing and whitespace-only names', () => {
    for (const fullName of ['', '   ', 'ab']) expect(patientSchema.safeParse({ ...valid, fullName }).success).toBe(false);
  });
  it('rejects impossible and malformed dates', () => {
    for (const dateOfBirth of ['', '2001-02-29', '2000-13-01', '2000-01-32', 'invalid']) expect(patientSchema.safeParse({ ...valid, dateOfBirth }).success).toBe(false);
  });
  it('rejects unsupported gender and short phone', () => {
    expect(patientSchema.safeParse({ ...valid, gender: 'invalid' }).success).toBe(false);
    expect(patientSchema.safeParse({ ...valid, phone: '123' }).success).toBe(false);
  });
  it('accepts Arabic names and preserves non-secret optional identifiers', () => {
    expect(patientSchema.safeParse({ ...valid, fullName: 'مريض خيالي', nationalId: 'FICTIONAL-ONLY' }).success).toBe(true);
  });
});
