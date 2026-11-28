import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LabService } from '../../src/modules/lab/lab.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTypeDto } from '../../src/modules/lab/dto/create-test-order.dto';

describe('LabService', () => {
  let service: LabService;
  let prisma: {
    $transaction: jest.Mock; $queryRaw: jest.Mock; user: { findUnique: jest.Mock }; auditLog: { create: jest.Mock };
    testOrder: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    encounter: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(callback => callback(prisma)), $queryRaw: jest.fn().mockResolvedValue([]), user: { findUnique: jest.fn().mockImplementation(({where}) => Promise.resolve({ isActive: true, role: where.id.includes("tech") ? "lab_tech" : "doctor" })) }, auditLog: { create: jest.fn().mockResolvedValue({}) },
      testOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      encounter: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [LabService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LabService);
  });

  const createDto = {
    patientId: 'patient-1',
    encounterId: 'enc-1',
    testType: TestTypeDto.lab,
    testName: 'تعداد دم شامل (CBC)',
  };

  it('FR-7.1: ينشئ طلب فحص مرتبطاً بالطبيب الطالب عندما تتطابق الزيارة والمريض', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', patientId: 'patient-1' });
    prisma.testOrder.create.mockResolvedValue({ id: 'order-1', orderedBy: 'doc-1', ...createDto });

    const result = (await service.createOrder(createDto, 'doc-1')) as { orderedBy: string };

    expect(result.orderedBy).toBe('doc-1');
  });

  it('rejects a test order when encounter belongs to another patient', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', patientId: 'someone-else' });

    await expect(service.createOrder(createDto, 'doc-1')).rejects.toThrow(BadRequestException);
    expect(prisma.testOrder.create).not.toHaveBeenCalled();
  });

  it('يرمي 404 عندما تكون الزيارة المحددة غير موجودة أصلاً', async () => {
    prisma.encounter.findUnique.mockResolvedValue(null);

    await expect(service.createOrder(createDto, 'doc-1')).rejects.toThrow(NotFoundException);
    expect(prisma.testOrder.create).not.toHaveBeenCalled();
  });

  it('FR-7.3: يسجل نتيجة فحص وينهي حالته لـcompleted', async () => {
    prisma.testOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'pending' });
    prisma.testOrder.update.mockResolvedValue({ id: 'order-1', status: 'completed' });

    await service.recordResult('order-1', { result: 'طبيعي' }, 'tech-1');

    expect(prisma.testOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          result: 'طبيعي',
          completedBy: 'tech-1',
        }),
      }),
    );
  });

  it('يرفض تسجيل نتيجة لطلب سبقت معالجته', async () => {
    prisma.testOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'completed' });

    await expect(service.recordResult('order-1', { result: 'x' }, 'tech-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.testOrder.update).not.toHaveBeenCalled();
  });

  it('يرمي 404 لطلب فحص غير موجود', async () => {
    prisma.testOrder.findUnique.mockResolvedValue(null);
    await expect(service.recordResult('missing', { result: 'x' }, 'tech-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('FR-7.4: getPatientResults يعيد فقط الفحوصات المكتملة', async () => {
    prisma.testOrder.findMany.mockResolvedValue([{ id: 'order-1', status: 'completed' }]);

    await service.getPatientResults('patient-1');

    expect(prisma.testOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'patient-1', status: 'completed' } }),
    );
  });
  it('rejects another doctor encounter before order or audit mutation', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', patientId: 'patient-1', doctorId: 'another-doctor' });
    await expect(service.createOrder(createDto, 'doc-1')).rejects.toMatchObject({ response: { error: { code: 'FORBIDDEN_ENCOUNTER_WRITE' } } });
    expect(prisma.testOrder.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

});
