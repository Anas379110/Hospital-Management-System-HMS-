import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../../src/modules/patients/patients.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: {
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    patient: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(callback => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockImplementation(async () => [{ next: BigInt((await prisma.patient.count()) + 1) }]),
      user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1", role: "receptionist", isActive: true }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      patient: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PatientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PatientsService);
  });

  const baseDto = {
    fullName: 'أحمد الحلبي',
    dateOfBirth: '1990-01-01',
    gender: 'male' as const,
    phone: '0999999999',
  };

  it('يولّد MRN بصيغة HMS-000001 لأول مريض', async () => {
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.findFirst.mockResolvedValue(null);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));

    const result = (await service.create(baseDto, 'user-1')) as { mrn: string };

    expect(result.mrn).toBe('HMS-000001');
    expect(prisma.patient.create).toHaveBeenCalledTimes(1);
  });

  it('يرفض الإنشاء بـ409 عند وجود تطابق محتمل وforce=false', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'existing-1', mrn: 'HMS-000002' });

    await expect(service.create(baseDto, 'user-1', false)).rejects.toThrow(ConflictException);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('يتجاوز التنبيه وينشئ السجل عندما force=true حتى مع وجود تطابق', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'existing-1', mrn: 'HMS-000002' });
    prisma.patient.count.mockResolvedValue(2);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p3', ...data }));

    const result = (await service.create(baseDto, 'user-1', true)) as { mrn: string };

    expect(result.mrn).toBe('HMS-000003');
    expect(prisma.patient.create).toHaveBeenCalledTimes(1);
  });

  it('locks before duplicate lookup and MRN allocation, with one shared lock', async () => {
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.findFirst.mockResolvedValue(null);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));
    await service.create(baseDto, 'user-1');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique.mock.invocationCallOrder[0]).toBeLessThan(prisma.$executeRaw.mock.invocationCallOrder[0]);
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.patient.findFirst.mock.invocationCallOrder[0]);
    expect(prisma.patient.findFirst.mock.invocationCallOrder[0]).toBeLessThan(prisma.$queryRaw.mock.invocationCallOrder[0]);
  });

  it('explicit override still acquires the same lock without checking duplicates', async () => {
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));
    await service.create(baseDto, 'user-1', true);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   ', '\t\n'])('ignores blank national ID %p without changing name+DOB warning', async nationalId => {
    prisma.patient.findFirst.mockResolvedValue(null);
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));
    await service.create({ ...baseDto, nationalId } as unknown as Parameters<PatientsService['create']>[0], 'user-1');
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({ where: { fullName: baseDto.fullName, dateOfBirth: new Date(baseDto.dateOfBirth) } });
  });

  it.each(['ID-001', ' ID-001 ', '١٢٣', '123'])('queries and stores original nonblank ID bytes %p', async nationalId => {
    prisma.patient.findFirst.mockResolvedValue(null);
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.create.mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data }));
    const row = await service.create({ ...baseDto, nationalId }, 'user-1');
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({ where: { OR: [{ fullName: baseDto.fullName, dateOfBirth: new Date(baseDto.dateOfBirth) }, { nationalId }] } });
    expect(row.nationalId).toBe(nationalId);
  });

  it('keeps national-ID warning details minimal and override unchanged', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'existing-id', mrn: 'HMS-000002', nationalId: 'SECRET-ID' });
    try { await service.create({ ...baseDto, nationalId: 'SECRET-ID' }, 'user-1'); throw new Error('Expected duplicate warning'); }
    catch (error) { expect((error as ConflictException).getResponse()).toEqual({ error: { code: 'POSSIBLE_DUPLICATE_PATIENT', message: expect.any(String), details: [{ existingPatientId: 'existing-id', mrn: 'HMS-000002' }] } }); }
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('يرمي NotFoundException عند البحث عن مريض غير موجود', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('findOne يعيد المريض عند وجوده', async () => {
    const patient = { id: 'p1', mrn: 'HMS-000001', fullName: 'أحمد الحلبي' };
    prisma.patient.findUnique.mockResolvedValue(patient);

    const result = await service.findOne('p1');

    expect(result).toEqual(patient);
  });
});
