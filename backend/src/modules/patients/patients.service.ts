import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PATIENT_WRITE_ROLES, requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const MAX_MRN_RETRIES = 3;

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-2.2: MRN فريد بصيغة HMS-000001 يُولَّد تلقائياً */
  private async generateMrn(tx: Prisma.TransactionClient): Promise<string> {
    // Serialize the human-readable MRN allocation in this transaction. Count is
    // insufficient after deletions/imports; use the highest conforming suffix.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(18472931)`;
    const rows = await tx.$queryRaw<{ next: bigint }[]>`SELECT COALESCE(MAX(SUBSTRING(mrn FROM 5)::bigint), 0) + 1 AS next FROM patients WHERE mrn ~ '^HMS-[0-9]{1,15}$'`;
    const next = rows[0].next.toString();
    return `HMS-${next.padStart(6, '0')}`;
  }

  /** FR-2.5: تحقق من احتمال وجود المريض مسبقاً — تنبيه لا حجب */
  async findPotentialDuplicate(fullName: string, dateOfBirth: string) {
    return this.prisma.patient.findFirst({
      where: { fullName, dateOfBirth: new Date(dateOfBirth) },
    });
  }

  /**
   * FR-2.1: تسجيل مريض جديد.
   * force=false (افتراضي): إن وُجد تطابق محتمل، تُرفض العملية بـ409 مع بيانات المرشح
   *   ليقرر الموظف يدوياً (متابعة أم لا) — راجع US-1.
   * force=true: يتجاوز التنبيه ويُنشئ السجل مباشرة (قرار الموظف بعد رؤية التنبيه).
   */
  async create(dto: CreatePatientDto, createdBy: string, force = false) {
    for (let attempt = 0; attempt < MAX_MRN_RETRIES; attempt++) {
      try { return await this.prisma.$transaction(async tx => {
    await requireActor(tx, createdBy, PATIENT_WRITE_ROLES);
    if (!force) {
      const duplicate = await tx.patient.findFirst({ where: { fullName: dto.fullName, dateOfBirth: new Date(dto.dateOfBirth) } });
      if (duplicate) {
        throw new ConflictException({
          error: {
            code: 'POSSIBLE_DUPLICATE_PATIENT',
            message: 'قد يكون هذا المريض مسجَّلاً مسبقاً — راجع السجل أو أعد الإرسال بتأكيد المتابعة',
            details: [{ existingPatientId: duplicate.id, mrn: duplicate.mrn }],
          },
        });
      }
    }

        const mrn = await this.generateMrn(tx);
        const patient = await tx.patient.create({
          data: {
            mrn,
            fullName: dto.fullName,
            dateOfBirth: new Date(dto.dateOfBirth),
            gender: dto.gender,
            nationalId: dto.nationalId,
            phone: dto.phone,
            address: dto.address,
            emergencyContactName: dto.emergencyContactName,
            emergencyContactPhone: dto.emergencyContactPhone,
            createdBy,
          },
        });
        await writeEntityAudit(tx, createdBy, 'PATIENT_CREATED', 'Patient', null, patient);
        return patient;
      }); } catch (err: unknown) {
        const error = err as { code?: string; meta?: { target?: string[] } };
        if (error.code !== 'P2002' || !error.meta?.target?.includes('mrn') || attempt === MAX_MRN_RETRIES - 1) throw err;
      }
    }
    throw new Error('MRN retry limit reached');
  }

  async search(query: string) {
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { mrn: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      take: 20,
    });
  }

  async billingLookup(query: string) {
    const search=query.trim().slice(0,80);
    if (search.length<2) return [];
    return this.prisma.patient.findMany({where:{OR:[{mrn:{contains:search,mode:'insensitive'}},{fullName:{contains:search,mode:'insensitive'}}]},take:20,select:{id:true,mrn:true,fullName:true}});
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException({
        error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] },
      });
    }
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, PATIENT_WRITE_ROLES);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM patients WHERE id = ${id} FOR UPDATE`);
      const before = await tx.patient.findUnique({ where: { id } });
      if (!before) throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] } });
      const after = await tx.patient.update({ where: { id }, data: dto });
      await writeEntityAudit(tx, actor, 'PATIENT_UPDATED', 'Patient', before, after);
      return after;
    });
  }

  /** FR-4.3: السجل الطبي الكامل — قراءة فقط، مرتَّب زمنياً من الأحدث للأقدم */
  async getMedicalRecords(id: string) {
    await this.findOne(id); // يرمي 404 إن لم يوجد
    return this.prisma.encounter.findMany({
      where: { patientId: id, deletedAt: null },
      include: { prescriptions: true },
      orderBy: { encounterDate: 'desc' },
    });
  }
}
