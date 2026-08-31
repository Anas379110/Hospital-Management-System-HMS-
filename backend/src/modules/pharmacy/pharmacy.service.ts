import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-6.1
  async createMedication(dto: CreateMedicationDto) {
    return this.prisma.medication.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        currentStock: dto.currentStock,
        reorderThreshold: dto.reorderThreshold ?? 10,
      },
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

  async adjustStock(id: string, delta: number, reason: string) {
    const medication = await this.findMedicationOrThrow(id);
    const newStock = medication.currentStock + delta;
    if (newStock < 0) {
      throw new ConflictException({
        error: {
          code: 'STOCK_CANNOT_BE_NEGATIVE',
          message: 'لا يمكن أن يكون رصيد المخزون سالباً بعد هذا التعديل',
          details: [{ currentStock: medication.currentStock, requestedDelta: delta }],
        },
      });
    }
    const updated = await this.prisma.medication.update({ where: { id }, data: { currentStock: newStock } });
    // إصلاح حقيقي (راجع SECURITY-REVIEW.md Finding #8): سبب التعديل كان يُتحقَّق
    // منه بالـ DTO لكن لا يُخزَّن بأي مكان — فجوة تدقيق حقيقية بمخزون دواء
    // (تعديلات المخزون اليدوية قناة محتملة لتسريب/سرقة أدوية بلا أثر واضح).
    // نُرفقه ضمن نتيجة الـ Endpoint بحيث يلتقطه AuditInterceptor تلقائياً
    // كجزء من newValue بسجل audit_logs، دون حاجة لتعديل Schema (Expand لاحقاً
    // بحقل مخصص لو استدعت الحاجة تقارير مفصَّلة لاحقاً).
    return { ...updated, adjustmentReason: reason, adjustmentDelta: delta };
  }

  // FR-6.2
  async pendingPrescriptions() {
    return this.prisma.prescription.findMany({
      where: { status: 'pending' },
      include: { encounter: { include: { patient: true, doctor: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * FR-6.3/FR-6.4: صرف وصفة — خصم المخزون وتحديث حالة الوصفة ضمن Transaction
   * ذرية واحدة، بنفس نمط AdmissionsService (راجع ARCHITECTURE.md §4).
   * لا خصم جزئي عند نقص المخزون أو أي فشل بمنتصف العملية.
   */
  async dispense(prescriptionId: string, dto: DispensePrescriptionDto, dispensedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      await tx.medication.update({
        where: { id: dto.medicationId },
        data: { currentStock: medication.currentStock - dto.quantityDispensed },
      });

      return tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: 'dispensed',
          medicationId: dto.medicationId,
          quantityDispensed: dto.quantityDispensed,
          dispensedAt: new Date(),
          dispensedBy,
        },
      });
    });
  }
}
