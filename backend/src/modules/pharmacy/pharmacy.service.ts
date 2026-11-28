import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { requireActor, writeCombinedAudit, writeEntityAudit } from '../../common/transaction-audit';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockReasonCode } from './dto/adjust-stock.dto';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-6.1
  async createMedication(dto: CreateMedicationDto, actor: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.pharmacist, Role.admin]);
    const medication = await tx.medication.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        currentStock: dto.currentStock,
        reorderThreshold: dto.reorderThreshold ?? 10,
      },
    });
    await writeEntityAudit(tx, actor, 'MEDICATION_CREATED', 'Medication', null, medication);
    return medication;
    });
  }

  async listMedications() {
    return this.prisma.medication.findMany({ orderBy: { name: 'asc' } });
  }

  // FR-6.5
  async lowStock() {
    const medications = await this.prisma.medication.findMany();
    return medications.filter(
      (m: { currentStock: number; reorderThreshold: number }) => m.currentStock <= m.reorderThreshold,
    );
  }

  private async findMedicationOrThrow(id: string) {
    const medication = await this.prisma.medication.findUnique({ where: { id } });
    if (!medication) {
      throw new NotFoundException({
        error: { code: 'MEDICATION_NOT_FOUND', message: 'الدواء غير موجود بالمخزون', details: [] },
      });
    }
    return medication;
  }

  async adjustStock(id: string, delta: number, reason: string | undefined, actor: string, reasonCode: StockReasonCode = 'correction') {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.pharmacist, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM medications WHERE id = ${id} FOR UPDATE`);
    const medication = await tx.medication.findUnique({ where: { id } });
    if (!medication) throw new NotFoundException({ error: { code: 'MEDICATION_NOT_FOUND', message: 'الدواء غير موجود بالمخزون', details: [] } });
    if ((reasonCode === 'restock' && delta <= 0) || (reasonCode === 'disposal' && delta >= 0)) throw new ConflictException({ error: { code: 'STOCK_REASON_DIRECTION', message: 'اتجاه الكمية لا يطابق سبب التعديل', details: [] } });
    const newStock = medication.currentStock + delta;
    if (!Number.isSafeInteger(delta) || delta === 0 || !Number.isSafeInteger(newStock) || newStock > 2147483647) throw new ConflictException({ error: { code: 'STOCK_OUT_OF_RANGE', message: 'الكمية خارج حدود التخزين المدعومة', details: [] } });
    if (newStock < 0) {
      throw new ConflictException({
        error: {
          code: 'STOCK_CANNOT_BE_NEGATIVE',
          message: 'لا يمكن أن يكون رصيد المخزون سالباً بعد هذا التعديل',
          details: [{ currentStock: medication.currentStock, requestedDelta: delta }],
        },
      });
    }
    const updated = await tx.medication.update({ where: { id }, data: { currentStock: newStock } });
    await writeCombinedAudit(tx, actor, 'MEDICATION_STOCK_ADJUSTED', 'Medication', id, [{ type: 'Medication', before: medication, after: updated }], { adjustmentDelta: delta, reasonCode, adjustmentReason: reason ? '[REDACTED]' : null });
    // Structured stock reason retained, optional free text never copied into audit.
    return { ...updated, adjustmentReason: reason, adjustmentDelta: delta };
    });
  }

  // FR-6.2
  async pendingPrescriptions() {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM prescriptions
        WHERE status = 'pending'::"PrescriptionStatus"
        ORDER BY created_at ASC
      `);
      if (ids.length === 0) return [];
      return tx.prescription.findMany({
        where: { id: { in: ids.map(row => row.id) } },
        include: { encounter: { select: { patient: { select: { fullName: true, mrn: true } }, doctor: { select: { fullName: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  /**
   * FR-6.3/FR-6.4: صرف وصفة — خصم المخزون وتحديث حالة الوصفة ضمن Transaction
   * ذرية واحدة، بنفس نمط AdmissionsService.
   * تراجع المعاملة عند نقص المخزون أو فشل كتابة سجل التدقيق.
   */
  async dispense(prescriptionId: string, dto: DispensePrescriptionDto, dispensedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await requireActor(tx, dispensedBy, [Role.pharmacist, Role.admin]);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM prescriptions WHERE id = ${prescriptionId} FOR UPDATE`);
      const prescription = await tx.prescription.findUnique({ where: { id: prescriptionId } });
      if (!prescription) {
        throw new NotFoundException({
          error: { code: 'PRESCRIPTION_NOT_FOUND', message: 'الوصفة غير موجودة', details: [] },
        });
      }
      if (prescription.status !== 'pending') {
        throw new ConflictException({
          error: {
            code: 'PRESCRIPTION_ALREADY_PROCESSED',
            message: 'تم التعامل مع هذه الوصفة مسبقاً',
            details: [{ currentStatus: prescription.status }],
          },
        });
      }

      await tx.$queryRaw(Prisma.sql`SELECT id FROM medications WHERE id = ${dto.medicationId} FOR UPDATE`);
      const medication = await tx.medication.findUnique({ where: { id: dto.medicationId } });
      if (!medication) {
        throw new NotFoundException({
          error: { code: 'MEDICATION_NOT_FOUND', message: 'الدواء غير موجود بالمخزون', details: [] },
        });
      }

      // FR-6.4: رفض كامل عند نقص المخزون — لا صرف جزئي أبداً
      if (medication.currentStock < dto.quantityDispensed) {
        throw new ConflictException({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `الكمية المتوفرة (${medication.currentStock}) أقل من الكمية المطلوبة (${dto.quantityDispensed})`,
            details: [{ available: medication.currentStock, requested: dto.quantityDispensed }],
          },
        });
      }

      const medicationAfter = await tx.medication.update({
        where: { id: dto.medicationId },
        data: { currentStock: medication.currentStock - dto.quantityDispensed },
      });

      const prescriptionAfter = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: 'dispensed',
          medicationId: dto.medicationId,
          quantityDispensed: dto.quantityDispensed,
          dispensedAt: new Date(),
          dispensedBy,
        },
      });
      await writeCombinedAudit(tx, dispensedBy, 'PRESCRIPTION_DISPENSED', 'Prescription', prescriptionId, [{ type: 'Prescription', before: prescription, after: prescriptionAfter }, { type: 'Medication', before: medication, after: medicationAfter }]);
      return prescriptionAfter;
    });
  }
}
