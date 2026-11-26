import { auditSnapshot } from '../../src/common/audit-snapshot';

describe('Audit snapshot field policy', () => {
  it.each(['passwordHash', 'accessToken', 'diagnosis', 'notes', 'fullName', 'phone', 'unknownText', 'username'])('redacts %s', field => {
    expect(auditSnapshot({ [field]: 'sensitive-value' })).toEqual({ [field]: '[REDACTED]' });
  });
  it.each(['Patient', 'Encounter', 'Admission', 'Appointment', 'Prescription', 'Invoice', 'User'])('bounds the %s snapshot without assuming action grants', entity => {
    const result = auditSnapshot({ id: 'entity-1', status: 'active', entity, amount: 100, isActive: true, nested: { secret: 'hidden' } });
    expect(result).toEqual({ id: 'entity-1', status: 'active', entity: '[REDACTED]', amount: 100, isActive: true, nested: { secret: '[REDACTED]' } });
  });
  it('documents current numeric/boolean policy and masks sensitive-key numbers', () => {
    expect(auditSnapshot({ amount: 42, quantity: 2, isActive: false, phone: 12345, nationalId: 67890 })).toEqual({ amount: 42, quantity: 2, isActive: false, phone: '[REDACTED]', nationalId: '[REDACTED]' });
  });
  it('redacts top-level, array and nested-array text and unusual scalar fields', () => {
    expect(auditSnapshot('private')).toBe('[REDACTED]');
    expect(auditSnapshot(['private', ['nested-private'], { arbitrary: 'private', unknownNumber: 123, unknownFlag: true }])).toEqual(['[REDACTED]', ['[REDACTED]'], { arbitrary: '[REDACTED]', unknownNumber: '[REDACTED]', unknownFlag: '[REDACTED]' }]);
  });
  it('marks bounded array and object truncation explicitly', () => {
    expect((auditSnapshot(Array(51).fill('private')) as unknown[]).at(-1)).toBe('[ARRAY_TRUNCATED]');
    const many = Object.fromEntries(Array.from({ length: 101 }, (_, index) => ['key' + index, 'private']));
    expect(auditSnapshot(many)).toHaveProperty('_truncated', '[KEYS_TRUNCATED]');
  });

  it('redacts primitive numbers and booleans without a reviewed parent key', () => {
    expect(auditSnapshot(12345)).toBe('[REDACTED]');
    expect(auditSnapshot(true)).toBe('[REDACTED]');
    expect(auditSnapshot([12345, false, [67890, true]])).toEqual(['[REDACTED]', '[REDACTED]', ['[REDACTED]', '[REDACTED]']]);
    expect(auditSnapshot({ amount: 42, isActive: true })).toEqual({ amount: 42, isActive: true });
  });

  it('retains only reviewed keyed dates, not primitive or arbitrary dates', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(auditSnapshot(date)).toBe('[REDACTED]');
    expect(auditSnapshot([date])).toEqual(['[REDACTED]']);
    expect(auditSnapshot({ createdAt: date, unexpectedDate: date, createdBy: new Date('invalid') })).toEqual({ createdAt: date.toISOString(), unexpectedDate: '[REDACTED]', createdBy: '[REDACTED]' });
  });

});
