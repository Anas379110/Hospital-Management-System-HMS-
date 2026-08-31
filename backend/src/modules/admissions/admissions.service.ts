import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-5.2 / UC-1 (SRS.md): تسكين مريض في سرير — يطابق تماماً التسلسل
   * الموصوف في ARCHITECTURE.md §4 وdocs/architecture/data-flow.mmd:
   * تحقق من توفر السرير + إنشاء Admission + تحديث حالة السرير، كل ذلك
   * ضمن Transaction ذرية واحدة — لا تسكين جزئي عند فشل أي خطوة (مثال:
   * انقطاع الاتصال أثناء الحفظ، راجع Error Flow في UC-1).
   */
  async create(dto: CreateAdmissionDto, admittedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const bed = await tx.bed.findUnique({ where: { id: dto.bedId } });
      if (!bed) {
        throw new NotFoundException({
          error: { code: 'BED_NOT_FOUND', message: 'السرير غير موجود', details: [] },
        });
      }
      if (bed.status !== 'available') {
        // UC-1 Alternative Flow: لا سرير متاح — الواجهة تعرض قائمة انتظار بدل رسالة خطأ فقط
        throw new ConflictException({
          error: {
            code: 'BED_NOT_AVAILABLE',
            message: 'السرير مشغول أو تحت الصيانة — اختر سريراً آخر',
            details: [{ bedId: bed.id, currentStatus: bed.status }],
          },
        });
      }

      const admission = await tx.admission.create({
        data: { patientId: dto.patientId, bedId: dto.bedId, admittedBy },
      });

      await tx.bed.update({ where: { id: dto.bedId }, data: { status: 'occupied' } });

      return admission;
    });
  }

  /** FR-5.3: تفريغ سرير عند خروج المريض — Transaction ذرية أيضاً */
  async discharge(admissionId: string, dischargeNotes?: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const admission = await tx.admission.findUnique({ where: { id: admissionId } });
      if (!admission) {
        throw new NotFoundException({
          error: { code: 'ADMISSION_NOT_FOUND', message: 'سجل التسكين غير موجود', details: [] },
        });
      }
      if (admission.dischargedAt) {
        throw new ConflictException({
          error: {
            code: 'ALREADY_DISCHARGED',
            message: 'تم تفريغ هذا المريض مسبقاً',
            details: [],
          },
        });
      }

      const updated = await tx.admission.update({
        where: { id: admissionId },
        data: { dischargedAt: new Date(), dischargeNotes },
      });

      await tx.bed.update({ where: { id: admission.bedId }, data: { status: 'available' } });

      return updated;
    });
  }
}
