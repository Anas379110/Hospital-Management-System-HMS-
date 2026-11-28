import { DepartmentSetupService } from '../../src/modules/departments/department-setup.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Admin department setup', () => {
  const before = { id: 'bed', departmentId: 'dept', bedNumber: 'A', status: 'available' };
  function fixture() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin', isActive: true }) },
      department: { findUnique: jest.fn().mockResolvedValue({ id: 'dept' }), create: jest.fn().mockResolvedValue({ id: 'dept', totalBeds: 0 }), update: jest.fn(), delete: jest.fn() },
      bed: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue(before), count: jest.fn().mockResolvedValue(0), delete: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue({ ...before, status: 'maintenance' }) },
      waitlistRequest: { count: jest.fn().mockResolvedValue(0) },
      appointment: { count: jest.fn().mockResolvedValue(0) },
      admission: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((fn: (arg: typeof tx) => unknown) => Promise.resolve().then(() => fn(tx))) };
    return { tx, service: new DepartmentSetupService(prisma as unknown as PrismaService) };
  }
  it('creates department and writes audit inside same transaction', async () => {
    const { tx, service } = fixture();
    await service.createDepartment({ nameAr: ' قسم ', nameEn: ' Dept ' }, 'admin');
    expect(tx.department.create).toHaveBeenCalledWith({ data: { nameAr: 'قسم', nameEn: 'Dept', totalBeds: 0 } });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it.each(['manager','doctor','nurse','receptionist','pharmacist','lab_tech','billing_clerk'])('rechecks persisted non-admin %s before any write', async role => {
    const { tx, service } = fixture(); tx.user.findUnique.mockResolvedValue({ role, isActive: true });
    await expect(service.createDepartment({ nameAr: 'a', nameEn: 'b' }, 'actor')).rejects.toMatchObject({ status: 403 });
    expect(tx.department.create).not.toHaveBeenCalled();
  });
  it('rejects inactive actor', async () => {
    const { tx, service } = fixture(); tx.user.findUnique.mockResolvedValue({ role: 'admin', isActive: false });
    await expect(service.deleteDepartment('dept', 'admin')).rejects.toMatchObject({ status: 403 });
  });
  it('rejects missing scoped department', async () => {
    const { tx, service } = fixture(); tx.department.findUnique.mockResolvedValue(null);
    await expect(service.createBed('other', 'A', 'admin')).rejects.toMatchObject({ status: 404 });
    expect(tx.bed.create).not.toHaveBeenCalled();
  });
  it('rejects duplicate bed label under department lock', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValue(before);
    await expect(service.createBed('dept', 'A', 'admin')).rejects.toMatchObject({ status: 409 });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); expect(tx.bed.create).not.toHaveBeenCalled();
  });
  it('updates count from actual rows on create', async () => {
    const { tx, service } = fixture(); tx.bed.count.mockResolvedValue(4);
    await service.createBed('dept', 'A', 'admin');
    expect(tx.department.update).toHaveBeenCalledWith({ where: { id: 'dept' }, data: { totalBeds: 4 } });
  });
  it('rejects occupied maintenance', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValue({ ...before, status: 'occupied' });
    await expect(service.updateBed('dept', 'bed', { status: 'maintenance' }, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(tx.bed.updateMany).not.toHaveBeenCalled();
  });
  it('allows occupied relabeling without changing state or identity', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValueOnce({ ...before, status: 'occupied' }).mockResolvedValueOnce(null);
    await service.updateBed('dept', 'bed', { bedNumber: 'B' }, 'admin');
    expect(tx.bed.updateMany).toHaveBeenCalledWith({ where: { id: 'bed', departmentId: 'dept', status: 'occupied' }, data: { bedNumber: 'B' } });
  });
  it('CAS rejects state change without audit', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValue(before); tx.bed.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateBed('dept', 'bed', { status: 'maintenance' }, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects deletion with any admission history', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValue(before); tx.admission.count.mockResolvedValue(1);
    await expect(service.deleteBed('dept', 'bed', 'admin')).rejects.toMatchObject({ status: 409 });
    expect(tx.bed.delete).not.toHaveBeenCalled();
  });
  it('rejects department deletion with appointments', async () => {
    const { tx, service } = fixture(); tx.appointment.count.mockResolvedValue(1);
    await expect(service.deleteDepartment('dept', 'admin')).rejects.toMatchObject({ status: 409 });
    expect(tx.department.delete).not.toHaveBeenCalled();
  });
  it('audits explicit deletion and redacts names', async () => {
    const { tx, service } = fixture(); tx.bed.findFirst.mockResolvedValue(before);
    await service.deleteBed('dept', 'bed', 'admin');
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.newValue.deleted).toBe(true); expect(audit.newValue.bedNumber).toBe('[REDACTED]');
  });
  it('fails closed when audit insert rejects', async () => {
    const { tx, service } = fixture(); tx.auditLog.create.mockRejectedValue(new Error('storage'));
    await expect(service.createBed('dept', 'A', 'admin')).rejects.toMatchObject({ status: 503 });
  });
});
