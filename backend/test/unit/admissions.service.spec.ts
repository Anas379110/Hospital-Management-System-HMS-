import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdmissionsService } from '../../src/modules/admissions/admissions.service';
import { PrismaService } from '../../src/prisma/prisma.service';

interface TxMock {
  bed: { findUnique: jest.Mock; update: jest.Mock };
  admission: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
}

describe('AdmissionsService — UC-1 (SRS.md)', () => {
  let service: AdmissionsService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      bed: { findUnique: jest.fn(), update: jest.fn() },
      admission: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };

    // يحاكي prisma.$transaction الحقيقي: ينفّذ الـ callback مع كائن tx المموَّه
    prisma = {
      $transaction: jest.fn((callback: (txArg: TxMock) => unknown) => callback(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdmissionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdmissionsService);
  });

  const createDto = { patientId: 'patient-1', bedId: 'bed-1' };

  it('UC-1 Main Flow: يسكّن المريض عندما السرير متاح، ويحدّث حالته لمشغول ضمن نفس Transaction', async () => {
    tx.bed.findUnique.mockResolvedValue({ id: 'bed-1', status: 'available' });
    tx.admission.create.mockResolvedValue({ id: 'adm-1', patientId: 'patient-1', bedId: 'bed-1' });

    const result = (await service.create(createDto, 'nurse-1')) as { id: string };

    expect(result.id).toBe('adm-1');
    expect(tx.admission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { patientId: 'patient-1', bedId: 'bed-1', admittedBy: 'nurse-1' },
      }),
    );
    expect(tx.bed.update).toHaveBeenCalledWith({
      where: { id: 'bed-1' },
      data: { status: 'occupied' },
    });
  });

  it('UC-1 Alternative Flow: يرفض بـ409 عندما السرير مشغول بالفعل، ولا يُنشئ Admission', async () => {
    tx.bed.findUnique.mockResolvedValue({ id: 'bed-1', status: 'occupied' });

    await expect(service.create(createDto, 'nurse-1')).rejects.toThrow(ConflictException);
    expect(tx.admission.create).not.toHaveBeenCalled();
    expect(tx.bed.update).not.toHaveBeenCalled();
  });

  it('يرفض بـ409 عندما السرير تحت الصيانة', async () => {
    tx.bed.findUnique.mockResolvedValue({ id: 'bed-1', status: 'maintenance' });

    await expect(service.create(createDto, 'nurse-1')).rejects.toThrow(ConflictException);
  });

  it('يرمي 404 عند سرير غير موجود إطلاقاً', async () => {
    tx.bed.findUnique.mockResolvedValue(null);

    await expect(service.create(createDto, 'nurse-1')).rejects.toThrow(NotFoundException);
    expect(tx.admission.create).not.toHaveBeenCalled();
  });

  it('discharge: يفرّغ السرير ويحدّث حالته لمتاح ضمن نفس Transaction', async () => {
    tx.admission.findUnique.mockResolvedValue({ id: 'adm-1', bedId: 'bed-1', dischargedAt: null });
    tx.admission.update.mockResolvedValue({ id: 'adm-1', dischargedAt: new Date() });

    await service.discharge('adm-1', 'تحسّن وخرج بحالة مستقرة');

    expect(tx.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dischargeNotes: 'تحسّن وخرج بحالة مستقرة' }),
      }),
    );
    expect(tx.bed.update).toHaveBeenCalledWith({
      where: { id: 'bed-1' },
      data: { status: 'available' },
    });
  });

  it('discharge: يرفض بـ409 إن كان المريض مُفرَّغاً بالفعل', async () => {
    tx.admission.findUnique.mockResolvedValue({
      id: 'adm-1',
      bedId: 'bed-1',
      dischargedAt: new Date(),
    });

    await expect(service.discharge('adm-1')).rejects.toThrow(ConflictException);
    expect(tx.bed.update).not.toHaveBeenCalled();
  });

  it('discharge: يرمي 404 لسجل تسكين غير موجود', async () => {
    tx.admission.findUnique.mockResolvedValue(null);
    await expect(service.discharge('missing')).rejects.toThrow(NotFoundException);
  });
});
