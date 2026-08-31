import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const MAX_MRN_RETRIES = 3;

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-2.2: MRN فريد بصيغة HMS-000001 يُولَّد تلقائياً */
  private async generateMrn(): Promise<string> {
    const count = await this.prisma.patient.count();
    const next = count + 1;
    return `HMS-${String(next).padStart(6, '0')}`;
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
    if (!force) {
      const duplicate = await this.findPotentialDuplicate(dto.fullName, dto.dateOfBirth);
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

    // إعادة محاولة بسيطة عند تعارض نادر على MRN بسبب تزامن طلبين (Race Condition)
    for (let attempt = 0; attempt < MAX_MRN_RETRIES; attempt++) {
      try {
        const mrn = await this.generateMrn();
        return await this.prisma.patient.create({
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
      } catch (err: unknown) {
        // فحص "duck-typed" لخطأ Prisma P2002 (unique constraint) بدل الاعتماد على
        // instanceof Prisma.PrismaClientKnownRequestError لتقليل الترابط مع تفاصيل توليد العميل.
        const prismaErr = err as { code?: string; meta?: { target?: string[] } };
        const isUniqueMrnClash =
          prismaErr?.code === 'P2002' && prismaErr.meta?.target?.includes('mrn');
        if (!isUniqueMrnClash || attempt === MAX_MRN_RETRIES - 1) throw err;
      }
    }
    throw new Error('تعذَّر توليد رقم ملف طبي فريد بعد عدة محاولات');
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

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException({
        error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] },
      });
    }
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id); // يرمي 404 إن لم يوجد
    return this.prisma.patient.update({ where: { id }, data: dto });
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
