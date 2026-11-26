import { writeAdmissionAudit } from '../../src/modules/admissions/admission-audit';

describe('Admission-specific trusted diff policy', () => {
  it('captures changed-to-null and real note change without copying text or claiming unchanged fields', async () => {
    const create = jest.fn().mockResolvedValue({});
    const before = { id: 'a', patientId: 'p', bedId: 'b', admittedBy: 'u', admittedAt: new Date('2026-01-01'), dischargedAt: new Date('2026-01-02'), dischargeNotes: 'private previous note' };
    const after = { ...before, dischargedAt: null, dischargeNotes: 'private new note' };
    await writeAdmissionAudit({ auditLog: { create } } as never, 'actor', 'TEST', before, after, { id: 'b', status: 'occupied' }, { id: 'b', status: 'available' });
    const data = create.mock.calls[0][0].data;
    expect(data.newValue.changedFields.admission).toEqual(['dischargedAt', 'dischargeNotes']);
    expect(data.newValue.admission.dischargedAt).toBeNull();
    expect(data.oldValue.admission.dischargedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(JSON.stringify(data)).not.toContain('private');
    expect(data.newValue.changedFields.bed).toEqual(['status']);
  });
  it('does not report unchanged or omitted note input as a change', async () => {
    const create = jest.fn().mockResolvedValue({});
    const row = { id: 'a', patientId: 'p', dischargeNotes: 'same private value' };
    await writeAdmissionAudit({ auditLog: { create } } as never, 'actor', 'TEST', row, { ...row }, { id: 'b', status: 'available' }, { id: 'b', status: 'available' });
    expect(create.mock.calls[0][0].data.newValue.changedFields).toEqual({ admission: [], bed: [] });
  });
});
