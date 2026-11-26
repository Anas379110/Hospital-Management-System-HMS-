import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { requireActor, writeCombinedAudit } from '../../common/transaction-audit';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

interface InvoiceTotals {
  subtotal: number;
  patientResponsibility: number;
  totalPaid: number;
  remaining: number;
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * راجع Decision 021: لا نثق بحقل status كمصدر وحيد — الإجمالي والمتبقي
   * يُحسبان دائماً فعلياً من البنود والدفعات الحقيقية وقت القراءة، لتفادي
   * أي احتمال تعارض (Desync) لو فشل تحديث الحقل يوماً بمكان ما.
   */
  private computeTotals(
    items: { quantity: number; unitPrice: number }[],
    payments: { amount: number }[],
    insuranceCoveragePercent: number,
  ): InvoiceTotals {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const patientResponsibility = Math.round((subtotal * (100 - insuranceCoveragePercent)) / 100);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = patientResponsibility - totalPaid;
    return { subtotal, patientResponsibility, totalPaid, remaining };
  }

  private assertSafeItems(items: { quantity: number; unitPrice: number }[]) {
    let sum = 0;
    for (const item of items) {
      const product = item.quantity * item.unitPrice;
      sum += product;
      if (!Number.isSafeInteger(product) || !Number.isSafeInteger(sum) || sum > Math.floor(Number.MAX_SAFE_INTEGER / 100)) throw new ConflictException({ error: { code: 'INVOICE_TOTAL_OUT_OF_RANGE', message: 'إجمالي الفاتورة يتجاوز الدقة المدعومة', details: [] } });
    }
  }

  private deriveStatus(totals: InvoiceTotals): 'unpaid' | 'partial' | 'paid' {
    if (totals.remaining <= 0 && totals.patientResponsibility > 0) return 'paid';
    if (totals.totalPaid > 0) return 'partial';
    return 'unpaid';
  }

  // FR-8.1
  async createInvoice(dto: CreateInvoiceDto, createdBy: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, createdBy, [Role.billing_clerk, Role.admin]);
    if (!await tx.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] } });
    if (dto.admissionId) {
      const admission = await tx.admission.findUnique({ where: { id: dto.admissionId }, select: { patientId: true } });
      if (!admission) throw new NotFoundException({ error: { code: 'ADMISSION_NOT_FOUND', message: 'سجل التسكين غير موجود', details: [] } });
      if (admission.patientId !== dto.patientId) throw new ConflictException({ error: { code: 'PATIENT_ADMISSION_MISMATCH', message: 'التسكين لا يخص المريض المحدد', details: [] } });
    }
    this.assertSafeItems(dto.items);
    const invoice = await tx.invoice.create({
      data: {
        patientId: dto.patientId,
        admissionId: dto.admissionId,
        insuranceCoveragePercent: dto.insuranceCoveragePercent ?? 0,
        createdBy,
        items: { create: dto.items },
      },
      include: { items: true, payments: true },
    });
    await writeCombinedAudit(tx, createdBy, 'INVOICE_CREATED', 'Invoice', invoice.id, [{ type: 'Invoice', before: null, after: invoice }, ...invoice.items.map(item => ({ type: 'InvoiceItem', before: null, after: item }))]);
    return { ...invoice, ...this.computeTotals(invoice.items, invoice.payments, invoice.insuranceCoveragePercent) };
    });
  }

  private async findInvoiceOrThrow(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        error: { code: 'INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة', details: [] },
      });
    }
    return invoice;
  }

  async getInvoice(id: string) {
    const invoice = await this.findInvoiceOrThrow(id);
    return { ...invoice, ...this.computeTotals(invoice.items, invoice.payments, invoice.insuranceCoveragePercent) };
  }

  // FR-8.2
  async addItem(invoiceId: string, dto: AddInvoiceItemDto, actor: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.billing_clerk, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`);
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, payments: true } });
    if (!invoice) throw new NotFoundException({ error: { code: 'INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة', details: [] } });
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new ConflictException({
        error: {
          code: 'INVOICE_LOCKED',
          message: 'لا يمكن إضافة بنود لفاتورة مدفوعة بالكامل أو ملغاة',
          details: [{ currentStatus: invoice.status }],
        },
      });
    }
    this.assertSafeItems([...invoice.items, dto]);
    const item = await tx.invoiceItem.create({ data: { invoiceId, ...dto } });
    await writeCombinedAudit(tx, actor, 'INVOICE_ITEM_ADDED', 'InvoiceItem', item.id, [{ type: 'Invoice', before: invoice, after: invoice }, { type: 'InvoiceItem', before: null, after: item }]);
    return item;
    });
  }

  /**
   * FR-8.4/FR-8.5: تسجيل دفعة ضمن Transaction ذرية — رفض أي دفعة تتجاوز
   * المتبقي فعلياً، وتحديث حالة الفاتورة بنفس المعاملة (راجع computeTotals).
   */
  async recordPayment(invoiceId: string, dto: RecordPaymentDto, recordedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await requireActor(tx, recordedBy, [Role.billing_clerk, Role.admin]);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });
      if (!invoice) {
        throw new NotFoundException({
          error: { code: 'INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة', details: [] },
        });
      }

      if (invoice.status === 'cancelled') throw new ConflictException({ error: { code: 'INVOICE_LOCKED', message: 'الفاتورة ملغاة ولا تقبل دفعات', details: [] } });
      const totals = this.computeTotals(invoice.items, invoice.payments, invoice.insuranceCoveragePercent);

      if (dto.amount > totals.remaining) {
        throw new ConflictException({
          error: {
            code: 'PAYMENT_EXCEEDS_REMAINING',
            message: `المبلغ (${dto.amount}) أكبر من المتبقي فعلياً (${totals.remaining})`,
            details: [{ remaining: totals.remaining }],
          },
        });
      }

      const payment = await tx.payment.create({
        data: { invoiceId, amount: dto.amount, method: dto.method, recordedBy },
      });

      const newTotals = this.computeTotals(
        invoice.items,
        [...invoice.payments, payment],
        invoice.insuranceCoveragePercent,
      );
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: this.deriveStatus(newTotals) },
      });

      await writeCombinedAudit(tx, recordedBy, 'PAYMENT_RECORDED', 'Payment', payment.id, [{ type: 'Invoice', before: invoice, after: updatedInvoice }, { type: 'Payment', before: null, after: payment }]);
      return payment;
    });
  }
}
