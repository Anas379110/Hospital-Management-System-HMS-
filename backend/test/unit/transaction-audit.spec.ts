import { Logger } from '@nestjs/common';
import { writeEntityAudit, writeCombinedAudit, requireActor } from '../../src/common/transaction-audit';

describe('Clinical entity audit policy', () => {
  it('computes actual changed fields while redacting both old and new clinical values', async () => {
    const create = jest.fn().mockResolvedValue({});
    await writeEntityAudit({ auditLog: { create } } as never, 'actor', 'PATIENT_UPDATED', 'Patient',
      { id: 'p', fullName: 'private old', phone: 'private old phone' },
      { id: 'p', fullName: 'private new', phone: null });
    const record = create.mock.calls[0][0].data;
    expect(record.newValue.changedFields).toEqual(['fullName', 'phone']);
    expect(record.newValue.phone).toBeNull();
    expect(record.oldValue.phone).toBe('[REDACTED]');
    expect(JSON.stringify(record)).not.toContain('private');
  });
  it('rejects unknown policy without mutation or fake fallback record', async () => {
    const create = jest.fn();
    await expect(writeEntityAudit({ auditLog: { create } } as never, 'actor', 'TEST', 'Unknown', null, { id: 'p' })).rejects.toThrow('Entity audit policy missing');
    expect(create).not.toHaveBeenCalled();
  });
  it('returns a fixed retry-safe error and logs no raw database details', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await expect(writeEntityAudit({ auditLog: { create: jest.fn().mockRejectedValue(new Error('private database credentials')) } } as never, 'actor', 'PATIENT_UPDATED', 'Patient', null, { id: 'p' })).rejects.toMatchObject({ response: { error: { code: 'AUDIT_PERSISTENCE_FAILED' } } });
      expect(JSON.stringify(log.mock.calls)).not.toContain('private');
      expect(log).toHaveBeenCalledWith({ code: 'AUDIT_INSERT_FAILED', failure: 'AUDIT_STORAGE_ERROR', action: 'PATIENT_UPDATED', entityId: 'p' });
    } finally { log.mockRestore(); }
  });
  it.each([null, { isActive: false, role: 'doctor' }, { isActive: true, role: 'nurse' }])('rejects missing/inactive/wrong-role actors: %p', async user => {
    await expect(requireActor({ user: { findUnique: jest.fn().mockResolvedValue(user) } } as never, 'actor', ['doctor'])).rejects.toMatchObject({ response: { error: { code: 'AUDIT_ACTOR_FORBIDDEN' } } });
  });
  it('keeps combined inventory and prescription state in one row without clinical text', async () => {
    const create = jest.fn().mockResolvedValue({});
    await writeCombinedAudit({ auditLog: { create } } as never, 'actor', 'PRESCRIPTION_DISPENSED', 'Prescription', 'rx', [
      { type: 'Prescription', before: { id: 'rx', status: 'pending', medicationName: 'private patient-like name' }, after: { id: 'rx', status: 'dispensed', medicationName: 'private patient-like name' } },
      { type: 'Medication', before: { id: 'med', currentStock: 10 }, after: { id: 'med', currentStock: 8 } },
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.newValue.entities[1].changedFields).toEqual(['currentStock']);
    expect(data.oldValue.entities[1].value.currentStock).toBe(10);
    expect(data.newValue.entities[1].value.currentStock).toBe(8);
    expect(JSON.stringify(data)).not.toContain('private');
  });

});
