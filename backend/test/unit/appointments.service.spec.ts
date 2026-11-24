import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from '../../src/modules/appointments/appointments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
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
      appointment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
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
    prisma.appointment.create.mockResolvedValue({ id: 'appt-1', ...createDto });

    const result = (await service.create(createDto)) as { id: string };

    expect(result.id).toBe('appt-1');
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
  });

  it('FR-3.2: يرفض الحجز بـ409 عند وجود تعارض لنفس الطبيب/الوقت', async () => {
    prisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appt' });

    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('لا يعتبر موعداً ملغى (cancelled) تعارضاً — الفحص يستثنيه صراحة', async () => {
    // findFirst مُموَّه هنا يحاكي فلترة Prisma الفعلية (status != cancelled)
    // التي تُطبَّق داخل الاستعلام؛ نتحقق فقط أن الخدمة لا تفشل حين لا يُعاد شيء
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockResolvedValue({ id: 'appt-2', ...createDto });

    await service.create(createDto);

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'cancelled' } }),
      }),
    );
  });

  it('update: يرمي 404 لموعد غير موجود', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { scheduledAt: '2026-09-01T11:00:00.000Z' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update: يعيد فحص التعارض عند تغيير scheduledAt فقط', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      doctorId: 'doctor-1',
      departmentId: 'dept-1',
      scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
    });
    prisma.appointment.findFirst.mockResolvedValue({ id: 'conflict-appt' });

    await expect(
      service.update('appt-1', { scheduledAt: '2026-09-01T12:00:00.000Z' }),
    ).rejects.toThrow(ConflictException);
  });

  it('cancel: يحدّث الحالة إلى cancelled مع السبب', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1' });
    prisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'cancelled' });

    await service.cancel('appt-1', 'المريض لم يعد بحاجة للموعد');

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'cancelled', cancelReason: 'المريض لم يعد بحاجة للموعد' },
      }),
    );
  });
  it('maps a database race conflict to409without hiding other database failures', async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockRejectedValue({ code: 'P2002', meta: { target: ['doctor_id', 'scheduled_at'] } });
    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    const unrelated = { code: 'P2002', meta: { target: ['id'] } };
    prisma.appointment.create.mockRejectedValue(unrelated);
    await expect(service.create(createDto)).rejects.toEqual(unrelated);
  });

  it('maps a reschedule race to409after the pre-check succeeds', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1', doctorId: 'doctor-1', departmentId: 'dept-1', scheduledAt: new Date(createDto.scheduledAt),
    });
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.update.mockRejectedValue({ code: 'P2002', meta: { target: 'appointments_doctor_time_unique' } });
    await expect(service.update('appt-1', { scheduledAt: '2027-01-21T10:00:00Z' })).rejects.toThrow(ConflictException);
  });

});
