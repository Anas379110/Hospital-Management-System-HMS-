import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../../src/modules/patients/patients.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: {
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
