import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from '../../src/modules/appointments/appointments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
    patient: { findUnique: jest.Mock }; department: { findUnique: jest.Mock }; encounter: { findUnique: jest.Mock };
    $transaction: jest.Mock; $queryRaw: jest.Mock; user: { findUnique: jest.Mock }; auditLog: { create: jest.Mock };
    appointment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({id: "p"}) }, department: { findUnique: jest.fn().mockResolvedValue({id:"d"}) }, encounter: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(callback => callback(prisma)), $queryRaw: jest.fn().mockResolvedValue([]), user: { findUnique: jest.fn().mockImplementation(({where}) => Promise.resolve({ isActive: true, role: where.id === "doctor-1" || where.id === "32320b1d-efd3-535c-85e4-f0d22550437d" ? "doctor" : "receptionist" })) }, auditLog: { create: jest.fn().mockResolvedValue({}) },
      appointment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AppointmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AppointmentsService);
  });

  const createDto = {
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    departmentId: 'dept-1',
    scheduledAt: '2026-09-01T10:00:00.000Z',
  };

  it('FR-3.1: يحجز موعداً جديداً عند عدم وجود تعارض', async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockResolvedValue({ id: 'appt-1', status: 'scheduled', ...createDto });

    const result = (await service.create(createDto, 'actor')) as { id: string };

    expect(result.id).toBe('appt-1');
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
  });

  it('FR-3.2: يرفض الحجز بـ409 عند وجود تعارض لنفس الطبيب/الوقت', async () => {
    prisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appt' });

    await expect(service.create(createDto, 'actor')).rejects.toThrow(ConflictException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('لا يعتبر موعداً ملغى (cancelled) تعارضاً — الفحص يستثنيه صراحة', async () => {
    // findFirst مُموَّه هنا يحاكي فلترة Prisma الفعلية (status != cancelled)
    // التي تُطبَّق داخل الاستعلام؛ نتحقق فقط أن الخدمة لا تفشل حين لا يُعاد شيء
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockResolvedValue({ id: 'appt-2', ...createDto });

    await service.create(createDto, 'actor');

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'cancelled' } }),
      }),
    );
  });

  it('update: يرمي 404 لموعد غير موجود', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { scheduledAt: '2026-09-01T11:00:00.000Z' }, 'actor')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update: يعيد فحص التعارض عند تغيير scheduledAt فقط', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1', status: 'scheduled',
      doctorId: 'doctor-1',
      departmentId: 'dept-1',
      scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
    });
    prisma.appointment.findFirst.mockResolvedValue({ id: 'conflict-appt' });

    await expect(
      service.update('appt-1', { scheduledAt: '2026-09-01T12:00:00.000Z' }, 'actor'),
    ).rejects.toThrow(ConflictException);
  });

  it('cancel: يحدّث الحالة إلى cancelled مع السبب', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1', status: 'scheduled' });
    prisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'cancelled' });

    await service.cancel('appt-1', 'المريض لم يعد بحاجة للموعد', 'actor');

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'cancelled', cancelReason: 'المريض لم يعد بحاجة للموعد' },
      }),
    );
  });
  it.each(['cancelled', 'completed', 'no_show'])('rejects updates and cancellation of %s appointments', async status => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1', status });
    await expect(service.update('appt-1', {}, 'actor')).rejects.toMatchObject({ status: 409 });
    await expect(service.cancel('appt-1', undefined, 'actor')).rejects.toMatchObject({ status: 409 });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects editing an encounter-linked appointment without write or audit', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1', status: 'scheduled' });
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1' });
    await expect(service.update('appt-1', {}, 'actor')).rejects.toMatchObject({ status: 409 });
    await expect(service.cancel('appt-1', undefined, 'actor')).rejects.toMatchObject({ status: 409 });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it.each([['doctor_id', 'scheduled_at'], 'appointments_doctor_time_unique'])('maps actual Prisma index target %p to conflict', async target => {
    const { Prisma } = await import('@prisma/client');
    prisma.appointment.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('synthetic conflict', { code: 'P2002', clientVersion: '5', meta: { target } }));
    await expect(service.create(createDto, 'actor')).rejects.toMatchObject({ response: { error: { code: 'APPOINTMENT_CONFLICT' } } });
  });

  it.each([[undefined, '2026-12-01T00:00:00Z'], ['2026-12-01T00:00:00Z', undefined], ['2026-12-02T00:00:00Z', '2026-12-01T00:00:00Z'], ['2026-12-01T00:00:00', '2026-12-02T00:00:00']])('rejects invalid bounded range %s %s', async (start, end) => {
    await expect(service.findByDoctorAndDate(undefined, undefined, start, end)).rejects.toMatchObject({ status: 400 });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
  it('uses exclusive next midnight for legacy UTC date', async () => {
    await service.findByDoctorAndDate(undefined, '2026-12-31');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { scheduledAt: { gte: new Date('2026-12-31T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') } } }));
  });

  it('bounds schedule reads and rejects truncation rather than hiding rows', async () => {
    prisma.appointment.findMany.mockResolvedValue(Array.from({ length: 501 }, (_, id) => ({ id })));
    await expect(service.findByDoctorAndDate()).rejects.toMatchObject({ response: { error: { code: 'APPOINTMENT_RANGE_TOO_LARGE' } } });
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 501, where: { scheduledAt: { gte: expect.any(Date), lt: expect.any(Date) } } }));
  });

});
