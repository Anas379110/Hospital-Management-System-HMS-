import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PharmacyService } from '../../src/modules/pharmacy/pharmacy.service';
import { PrismaService } from '../../src/prisma/prisma.service';

interface TxMock {
  prescription: { findUnique: jest.Mock; update: jest.Mock };
  medication: { findUnique: jest.Mock; update: jest.Mock };
}

describe('PharmacyService', () => {
  let service: PharmacyService;
  let tx: TxMock;
  let prisma: {
    $transaction: jest.Mock;
    medication: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    prescription: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      prescription: { findUnique: jest.fn(), update: jest.fn() },
      medication: { findUnique: jest.fn(), update: jest.fn() },
    };

    prisma = {
      $transaction: jest.fn((callback: (txArg: TxMock) => unknown) => callback(tx)),
      medication: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      prescription: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PharmacyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PharmacyService);
  });

  describe('dispense — FR-6.3/FR-6.4', () => {
    const dispenseDto = { medicationId: 'med-1', quantityDispensed: 10 };

    it('يصرف الوصفة بنجاح ويخصم المخزون ضمن نفس Transaction', async () => {
      tx.prescription.findUnique.mockResolvedValue({ id: 'rx-1', status: 'pending' });
      tx.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 50 });
      tx.prescription.update.mockResolvedValue({ id: 'rx-1', status: 'dispensed' });

      await service.dispense('rx-1', dispenseDto, 'pharmacist-1');

      expect(tx.medication.update).toHaveBeenCalledWith({
        where: { id: 'med-1' },
        data: { currentStock: 40 },
      });
      expect(tx.prescription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'dispensed', quantityDispensed: 10 }),
        }),
      );
    });

    it('يرفض بـ409 عند نقص المخزون، ولا يخصم أي شيء', async () => {
      tx.prescription.findUnique.mockResolvedValue({ id: 'rx-1', status: 'pending' });
      tx.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 5 }); // أقل من المطلوب (10)

      await expect(service.dispense('rx-1', dispenseDto, 'pharmacist-1')).rejects.toThrow(
        ConflictException,
      );
      expect(tx.medication.update).not.toHaveBeenCalled();
      expect(tx.prescription.update).not.toHaveBeenCalled();
    });

    it('يرفض بـ409 لوصفة سبق صرفها', async () => {
      tx.prescription.findUnique.mockResolvedValue({ id: 'rx-1', status: 'dispensed' });

      await expect(service.dispense('rx-1', dispenseDto, 'pharmacist-1')).rejects.toThrow(
        ConflictException,
      );
      expect(tx.medication.findUnique).not.toHaveBeenCalled();
    });

    it('يرمي 404 لوصفة غير موجودة', async () => {
      tx.prescription.findUnique.mockResolvedValue(null);
      await expect(service.dispense('missing', dispenseDto, 'pharmacist-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('يرمي 404 لدواء غير موجود بالمخزون', async () => {
      tx.prescription.findUnique.mockResolvedValue({ id: 'rx-1', status: 'pending' });
      tx.medication.findUnique.mockResolvedValue(null);

      await expect(service.dispense('rx-1', dispenseDto, 'pharmacist-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adjustStock', () => {
    it('يزيد المخزون بنجاح (إعادة تعبئة)', async () => {
      prisma.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 20 });
      prisma.medication.update.mockResolvedValue({ id: 'med-1', currentStock: 70 });

      await service.adjustStock('med-1', 50, 'شحنة جديدة');

      expect(prisma.medication.update).toHaveBeenCalledWith({
        where: { id: 'med-1' },
        data: { currentStock: 70 },
      });
    });

    it('Finding #8 (RESOLVED): يُضمِّن سبب التعديل بالنتيجة ليلتقطه Audit Log — لا فقدان صامت لسبب تعديل المخزون', async () => {
      prisma.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 20 });
      prisma.medication.update.mockResolvedValue({ id: 'med-1', currentStock: 70 });

      const result = await service.adjustStock('med-1', 50, 'شحنة جديدة من المورِّد');

      expect(result).toEqual(
        expect.objectContaining({ adjustmentReason: 'شحنة جديدة من المورِّد', adjustmentDelta: 50 }),
      );
    });

    it('يرفض بـ409 إن أدى التعديل لرصيد سالب', async () => {
      prisma.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 5 });

      await expect(service.adjustStock('med-1', -10, 'تصحيح خاطئ')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.medication.update).not.toHaveBeenCalled();
    });
  });

  describe('lowStock — FR-6.5', () => {
    it('يعيد فقط الأدوية عند أو تحت حد إعادة الطلب', async () => {
      prisma.medication.findMany.mockResolvedValue([
        { id: 'm1', currentStock: 5, reorderThreshold: 10 },
        { id: 'm2', currentStock: 50, reorderThreshold: 10 },
        { id: 'm3', currentStock: 10, reorderThreshold: 10 },
      ]);

      const result = await service.lowStock();

      expect(result.map((m: { id: string }) => m.id)).toEqual(['m1', 'm3']);
    });
  });
});
