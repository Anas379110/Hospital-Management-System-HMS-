import { WaitlistService } from '../../src/modules/waitlist/waitlist.service';
import { PrismaService } from '../../src/prisma/prisma.service';
describe('Clinical manual waitlist', () => {
  const pending = { id: 'request', patientId: 'patient', departmentId: 'dept', status: 'pending', requestedAt: new Date(), requestedBy: 'actor' };
  function fixture() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'nurse', isActive: true }) },
      department: { findUnique: jest.fn().mockResolvedValue({ id: 'dept' }) },
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'patient' }), findMany: jest.fn().mockResolvedValue([{ id: 'patient', fullName: 'Fictional', mrn: 'F' }]) },
      admission: { findFirst: jest.fn().mockResolvedValue(null) },
      waitlistRequest: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([pending]), count: jest.fn().mockResolvedValue(1), create: jest.fn().mockResolvedValue(pending), update: jest.fn().mockResolvedValue({ ...pending, status: 'cancelled', closedBy: 'actor', closedAt: new Date() }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((fn: (arg: typeof tx) => unknown) => Promise.resolve().then(() => fn(tx))) };
    return { tx, prisma, service: new WaitlistService(prisma as unknown as PrismaService) };
  }
  it.each(['admin','manager','receptionist','pharmacist','lab_tech','billing_clerk'])('rejects persisted role%s for read/create/cancel', async role => {
    const { tx, service } = fixture(); tx.user.findUnique.mockResolvedValue({ role, isActive: true });
    for (const run of [() => service.list('dept','actor'), () => service.create('dept','patient','actor'), () => service.cancel('dept','request','actor')]) await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(tx.$queryRaw).not.toHaveBeenCalled(); expect(tx.waitlistRequest.create).not.toHaveBeenCalled();
  });
  it('rejects inactive and missing actors', async () => {
    const { tx, service } = fixture();
    await expect(service.create('dept','patient','')).rejects.toMatchObject({ status: 401 });
    tx.user.findUnique.mockResolvedValue({ role: 'doctor', isActive: false });
    await expect(service.list('dept','actor')).rejects.toMatchObject({ status: 403 });
  });
  it('paginates FIFO deterministically with total and only minimal patient identity', async () => {
    const { tx, service } = fixture(); const result = await service.list('dept','actor',1);
    expect(tx.waitlistRequest.findMany).toHaveBeenCalledWith({ where: { departmentId: 'dept', status: 'pending' }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }], take: 100, skip: 100 });
    expect(result.total).toBe(1); expect(result.page).toBe(1); expect(result.items[0].patient?.fullName).toBe('Fictional');
  });
  it('creates under department lock with audit and no admission mutation', async () => {
    const { tx, service } = fixture(); await service.create('dept','patient','actor');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.waitlistRequest.create).toHaveBeenCalledWith({ data: { departmentId: 'dept', patientId: 'patient', requestedBy: 'actor' } });
  });
  it('rejects duplicate pending and already admitted in same department', async () => {
    const { tx, service } = fixture(); tx.waitlistRequest.findFirst.mockResolvedValue(pending);
    await expect(service.create('dept','patient','actor')).rejects.toMatchObject({ status: 409 });
    tx.admission.findFirst.mockResolvedValue({ id: 'admission' });
    await expect(service.create('dept','patient','actor')).rejects.toMatchObject({ status: 409 });
    expect(tx.waitlistRequest.create).not.toHaveBeenCalled();
  });
  it('missing department/patient/request are404', async () => {
    const { tx, service } = fixture(); tx.department.findUnique.mockResolvedValue(null);
    await expect(service.create('dept','patient','actor')).rejects.toMatchObject({ status: 404 });
    tx.department.findUnique.mockResolvedValue({ id: 'dept' }); tx.patient.findUnique.mockResolvedValue(null);
    await expect(service.create('dept','patient','actor')).rejects.toMatchObject({ status: 404 });
    await expect(service.cancel('dept','request','actor')).rejects.toMatchObject({ status: 404 });
  });
  it('cancel retains request and requires pending state', async () => {
    const { tx, service } = fixture(); tx.waitlistRequest.findFirst.mockResolvedValue(pending);
    await service.cancel('dept','request','actor'); expect(tx.waitlistRequest.update).toHaveBeenCalledWith({ where: { id: 'request' }, data: { status: 'cancelled', closedAt: expect.any(Date), closedBy: 'actor' } });
    tx.waitlistRequest.findFirst.mockResolvedValue({ ...pending, status: 'admitted' });
    await expect(service.cancel('dept','request','actor')).rejects.toMatchObject({ status: 409 });
    expect(tx.waitlistRequest.update).toHaveBeenCalledTimes(1);
  });
  it('audit failure rejects transaction callback, rollback requires realPG test', async () => {
    const { tx, service } = fixture(); tx.auditLog.create.mockRejectedValue(new Error('storage'));
    await expect(service.create('dept','patient','actor')).rejects.toMatchObject({ status: 503 });
  });
});
