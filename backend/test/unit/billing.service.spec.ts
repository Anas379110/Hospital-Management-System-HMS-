import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingService } from '../../src/modules/billing/billing.service';
import { PrismaService } from '../../src/prisma/prisma.service';

interface TxMock {
  invoice: { findUnique: jest.Mock; update: jest.Mock };
  payment: { create: jest.Mock };
}

describe('BillingService', () => {
  let service: BillingService;
  let tx: TxMock;
  let prisma: {
    $transaction: jest.Mock;
    invoice: { create: jest.Mock; findUnique: jest.Mock };
    invoiceItem: { create: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      invoice: { findUnique: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((callback: (txArg: TxMock) => unknown) => callback(tx)),
      invoice: { create: jest.fn(), findUnique: jest.fn() },
      invoiceItem: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [BillingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BillingService);
  });

  describe('createInvoice — FR-8.1', () => {
    it('يحسب subtotal وpatientResponsibility بشكل صحيح بلا تأمين', async () => {
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-1',
        insuranceCoveragePercent: 0,
        items: [{ quantity: 2, unitPrice: 1000 }],
        payments: [],
      });

      const result = await service.createInvoice(
        { patientId: 'p1', items: [{ description: 'كشف', quantity: 2, unitPrice: 1000 }] },
        'clerk-1',
      );

      expect(result.subtotal).toBe(2000);
      expect(result.patientResponsibility).toBe(2000);
      expect(result.remaining).toBe(2000);
    });

    it('يطبّق نسبة تغطية التأمين بشكل صحيح على المستحق', async () => {
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-2',
        insuranceCoveragePercent: 50,
        items: [{ quantity: 1, unitPrice: 10000 }],
        payments: [],
      });

      const result = await service.createInvoice(
        {
          patientId: 'p1',
          insuranceCoveragePercent: 50,
          items: [{ description: 'عملية', quantity: 1, unitPrice: 10000 }],
        },
        'clerk-1',
      );

      expect(result.patientResponsibility).toBe(5000); // 50% تأمين يغطي النصف
    });
  });

  describe('recordPayment — FR-8.4/FR-8.5', () => {
    it('يقبل دفعة ضمن المتبقي، ويحدّث الحالة لـpartial', async () => {
      tx.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        insuranceCoveragePercent: 0,
        items: [{ quantity: 1, unitPrice: 10000 }],
        payments: [],
      });
      tx.payment.create.mockResolvedValue({ id: 'pay-1', amount: 4000 });

      await service.recordPayment('inv-1', { amount: 4000, method: 'cash' }, 'clerk-1');

      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'partial' },
      });
    });

    it('يحدّث الحالة لـpaid عندما تُغطى القيمة كاملة', async () => {
      tx.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        insuranceCoveragePercent: 0,
        items: [{ quantity: 1, unitPrice: 10000 }],
        payments: [{ amount: 6000 }], // دُفع 6000 مسبقاً
      });
      tx.payment.create.mockResolvedValue({ id: 'pay-2', amount: 4000 });

      await service.recordPayment('inv-1', { amount: 4000, method: 'cash' }, 'clerk-1');

      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'paid' },
      });
    });

    it('يرفض بـ409 دفعة تتجاوز المتبقي فعلياً، ولا يُنشئ الدفعة', async () => {
      tx.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        insuranceCoveragePercent: 0,
        items: [{ quantity: 1, unitPrice: 5000 }],
        payments: [],
      });

      await expect(
        service.recordPayment('inv-1', { amount: 6000, method: 'cash' }, 'clerk-1'),
      ).rejects.toThrow(ConflictException);
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.invoice.update).not.toHaveBeenCalled();
    });

    it('يرمي 404 لفاتورة غير موجودة', async () => {
      tx.invoice.findUnique.mockResolvedValue(null);
      await expect(
        service.recordPayment('missing', { amount: 100, method: 'cash' }, 'clerk-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addItem — FR-8.2', () => {
    it('يرفض إضافة بند لفاتورة مدفوعة بالكامل', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        items: [],
        payments: [],
      });

      await expect(
        service.addItem('inv-1', { description: 'بند إضافي', quantity: 1, unitPrice: 100 }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.invoiceItem.create).not.toHaveBeenCalled();
    });
  });
});
