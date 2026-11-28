import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireAdmissionActor, writeAdmissionAudit } from './admission-audit';
import { writeEntityAudit } from '../../common/transaction-audit';
import { CreateAdmissionDto } from './dto/create-admission.dto';

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-5.2 / UC-1: admission, bed transition and redacted audit share one
   * transaction. See ARCHITECTURE.md section4 and docs/architecture/data-flow.mmd
   * for design context; actual failure/concurrency behavior is tested separately.
   */
  async create(dto: CreateAdmissionDto, admittedBy: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await requireAdmissionActor(tx, admittedBy);
      if (!await tx.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } })) {
        throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found', details: [] } });
      }
      let bed = await tx.bed.findUnique({ where: { id: dto.bedId } });
      if (!bed) {
        throw new NotFoundException({
          error: { code: 'BED_NOT_FOUND', message: 'السرير غير موجود', details: [] },
        });
      }
      // Shared department-first lock serializes queue add/cancel/admit and setup.
      await tx.$queryRaw`SELECT id FROM departments WHERE id=${bed.departmentId} FOR UPDATE`;
      bed = await tx.bed.findUnique({ where: { id: dto.bedId } });
      if (!bed) throw new NotFoundException({ error: { code: 'BED_NOT_FOUND', message: 'Bed not found', details: [] } });
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

      const claim = await tx.bed.updateMany({
        where: { id: dto.bedId, status: 'available' }, data: { status: 'occupied' },
      });
      if (claim.count !== 1) {
        throw new ConflictException({ error: {
          code: 'BED_NOT_AVAILABLE', message: 'السرير مشغول أو تحت الصيانة — اختر سريراً آخر', details: [],
        } });
      }
      const admission = await tx.admission.create({
        data: { patientId: dto.patientId, bedId: dto.bedId, admittedBy },
      });
      await writeAdmissionAudit(tx, admittedBy, 'PATIENT_ADMITTED', null, admission, bed, { id: bed.id, status: 'occupied' });
      const pending = await tx.waitlistRequest.findFirst({ where: { patientId: dto.patientId, departmentId: bed.departmentId, status: 'pending' } });
      if (pending) {
        const closed = await tx.waitlistRequest.update({ where: { id: pending.id }, data: { status: 'admitted', closedBy: admittedBy, closedAt: new Date(), admissionId: admission.id } });
        await writeEntityAudit(tx, admittedBy, 'WAITLIST_ADMITTED', 'WaitlistRequest', pending, closed);
      }
      return admission;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        if ((Array.isArray(target) && target.includes('bed_id')) || (target == null && error.meta?.modelName === 'Admission')) {
          throw new ConflictException({ error: {
            code: 'BED_NOT_AVAILABLE', message: 'السرير مشغول أو تحت الصيانة — اختر سريراً آخر', details: [],
          } });
        }
      }
      throw error;
    });
  }

  /** FR-5.3: تفريغ سرير عند خروج المريض — Transaction ذرية أيضاً */
  async discharge(admissionId: string, dischargeNotes: string | undefined, actor: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await requireAdmissionActor(tx, actor);
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

      const discharge = await tx.admission.updateMany({
        where: { id: admissionId, dischargedAt: null },
        data: { dischargedAt: new Date(), dischargeNotes },
      });
      if (discharge.count !== 1) {
        throw new ConflictException({ error: {
          code: 'ALREADY_DISCHARGED', message: 'تم تفريغ هذا المريض مسبقاً', details: [],
        } });
      }
      const updated = await tx.admission.findUnique({ where: { id: admissionId } });

      const bedBefore = await tx.bed.findUniqueOrThrow({ where: { id: admission.bedId } });
      if (bedBefore.status !== 'occupied') throw new ConflictException({ error: { code: 'BED_STATE_CHANGED', message: 'Bed state changed; reload before discharge', details: [] } });
      const release = await tx.bed.updateMany({ where: { id: admission.bedId, status: bedBefore.status }, data: { status: 'available' } });
      if (release.count !== 1) throw new ConflictException({ error: { code: 'BED_STATE_CHANGED', message: 'Bed state changed; reload before discharge', details: [] } });
      const bedAfter = { id: bedBefore.id, status: 'available' }; 
      if (!updated) throw new Error('Admission disappeared during transaction');
      await writeAdmissionAudit(tx, actor, 'PATIENT_DISCHARGED', admission, updated, bedBefore, bedAfter);

      return updated;
    });
  }
}
