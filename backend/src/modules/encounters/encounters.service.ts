import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-4.1
  async create(dto: CreateEncounterDto, doctorId: string) {
    return this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        doctorId,
        appointmentId: dto.appointmentId,
        chiefComplaint: dto.chiefComplaint,
        diagnosis: dto.diagnosis,
        notes: dto.notes,
      },
    });
  }

  async findOne(id: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { prescriptions: true },
    });
    if (!encounter || encounter.deletedAt) {
      throw new NotFoundException({
        error: { code: 'ENCOUNTER_NOT_FOUND', message: 'الزيارة الطبية غير موجودة', details: [] },
      });
    }
    return encounter;
  }

  // FR-4.2
  async addPrescription(encounterId: string, dto: CreatePrescriptionDto) {
    await this.findOne(encounterId); // يرمي 404 إن لم توجد أو كانت محذوفة منطقياً
    return this.prisma.prescription.create({
      data: {
        encounterId,
        medicationName: dto.medicationName,
        dosage: dto.dosage,
        duration: dto.duration,
        notes: dto.notes,
      },
    });
  }

  /**
   * FR-4.4: Soft Delete فقط — لا حذف نهائي لبيانات طبية أبداً.
   * يُسمح للطبيب صاحب السجل فقط، أو Admin — راجع API.md.
   */
  async softDelete(
    id: string,
    reason: string,
    requester: { userId: string; role: string },
  ) {
    const encounter = await this.findOne(id);

    const isOwner = encounter.doctorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN_ENCOUNTER_DELETE',
          message: 'لا يمكنك حذف سجل طبي لا يخصك',
          details: [],
        },
      });
    }

    return this.prisma.encounter.update({
      where: { id },
      data: { deletedAt: new Date(), deleteReason: reason },
    });
  }
}
