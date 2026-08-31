import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentsService } from '../../src/modules/departments/departments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: { findMany: jest.Mock; findUnique: jest.Mock };
    bed: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      department: { findMany: jest.fn(), findUnique: jest.fn() },
      bed: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DepartmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(DepartmentsService);
  });

  it('getBedsSummary: يحسب الأعداد بشكل صحيح لكل حالة (US-5)', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prisma.bed.findMany.mockResolvedValue([
      { status: 'available' },
      { status: 'available' },
      { status: 'occupied' },
      { status: 'maintenance' },
    ]);

    const summary = await service.getBedsSummary('dept-1');

    expect(summary).toEqual({ total: 4, available: 2, occupied: 1, maintenance: 1 });
  });

  it('getBedsSummary: يرمي 404 لقسم غير موجود', async () => {
    prisma.department.findUnique.mockResolvedValue(null);
    await expect(service.getBedsSummary('missing')).rejects.toThrow(NotFoundException);
  });

  it('getBeds: يرمي 404 لقسم غير موجود قبل محاولة جلب الأسرّة', async () => {
    prisma.department.findUnique.mockResolvedValue(null);
    await expect(service.getBeds('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.bed.findMany).not.toHaveBeenCalled();
  });
});
