import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  private deriveStatus(totals: InvoiceTotals): 'unpaid' | 'partial' | 'paid' {
    if (totals.remaining <= 0 && totals.patientResponsibility > 0) return 'paid';
    if (totals.totalPaid > 0) return 'partial';
    return 'unpaid';
  }

  // FR-8.1
  async createInvoice(dto: CreateInvoiceDto, createdBy: string) {
    const invoice = await this.prisma.invoice.create({
      data: {
        patientId: dto.patientId,
        admissionId: dto.admissionId,
        insuranceCoveragePercent: dto.insuranceCoveragePercent ?? 0,
        createdBy,
        items: { create: dto.items },
      },
      include: { items: true, payments: true },
    });
    return { ...invoice, ...this.computeTotals(invoice.items, invoice.payments, invoice.insuranceCoveragePercent) };
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
  async addItem(invoiceId: string, dto: AddInvoiceItemDto) {
    const invoice = await this.findInvoiceOrThrow(invoiceId);
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new ConflictException({
        error: {
          code: 'INVOICE_LOCKED',
          message: 'لا يمكن إضافة بنود لفاتورة مدفوعة بالكامل أو ملغاة',
          details: [{ currentStatus: invoice.status }],
        },
      });
    }
    return this.prisma.invoiceItem.create({ data: { invoiceId, ...dto } });
  }

  /**
   * FR-8.4/FR-8.5: تسجيل دفعة ضمن Transaction ذرية — رفض أي دفعة تتجاوز
   * المتبقي فعلياً، وتحديث حالة الفاتورة بنفس المعاملة (راجع computeTotals).
   */
  async recordPayment(invoiceId: string, dto: RecordPaymentDto, recordedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });
      if (!invoice) {
        throw new NotFoundException({
          error: { code: 'INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة', details: [] },
        });
      }

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
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: this.deriveStatus(newTotals) },
      });

      return payment;
    });
  }
}
