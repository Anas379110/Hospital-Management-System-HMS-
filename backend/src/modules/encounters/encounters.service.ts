import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-4.1
  async create(dto: CreateEncounterDto, doctorId: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, doctorId, [Role.doctor]);
    if (!await tx.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] } });
    if (dto.appointmentId) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM appointments WHERE id = ${dto.appointmentId} FOR UPDATE`);
      const appointment = await tx.appointment.findUnique({ where: { id: dto.appointmentId } });
      if (!appointment) throw new NotFoundException({ error: { code: 'APPOINTMENT_NOT_FOUND', message: 'الموعد غير موجود', details: [] } });
      if (['cancelled', 'no_show'].includes(appointment.status)) throw new ConflictException({ error: { code: 'APPOINTMENT_NOT_ATTENDED', message: 'الموعد ملغى أو لم يحضر المريض. سجّل زيارة مستقلة أو صحّح الموعد أولاً', details: [] } });
      if (appointment.patientId !== dto.patientId || appointment.doctorId !== doctorId) throw new ConflictException({ error: { code: 'ENCOUNTER_APPOINTMENT_MISMATCH', message: 'الموعد لا يطابق المريض والطبيب', details: [] } });
      if (await tx.encounter.findUnique({ where: { appointmentId: dto.appointmentId } })) throw new ConflictException({ error: { code: 'APPOINTMENT_ENCOUNTER_EXISTS', message: 'سُجلت زيارة لهذا الموعد مسبقاً', details: [] } });
    }
    const encounter = await tx.encounter.create({
      data: {
        patientId: dto.patientId,
        doctorId,
        appointmentId: dto.appointmentId,
        chiefComplaint: dto.chiefComplaint,
        diagnosis: dto.diagnosis,
        notes: dto.notes,
      },
    });
    await writeEntityAudit(tx, doctorId, 'ENCOUNTER_CREATED', 'Encounter', null, encounter);
    return encounter;
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
  async addPrescription(encounterId: string, dto: CreatePrescriptionDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, [Role.doctor]);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM encounters WHERE id = ${encounterId} FOR UPDATE`);
      const encounter = await tx.encounter.findUnique({ where: { id: encounterId } });
      if (!encounter || encounter.deletedAt) throw new NotFoundException({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'الزيارة الطبية غير موجودة', details: [] } });
      if (encounter.doctorId !== actor) throw new ForbiddenException({ error: { code: 'FORBIDDEN_ENCOUNTER_WRITE', message: 'لا يمكنك تعديل زيارة طبيب آخر', details: [] } });
      const prescription = await tx.prescription.create({ data: { encounterId, medicationName: dto.medicationName, dosage: dto.dosage, duration: dto.duration, notes: dto.notes } });
      await writeEntityAudit(tx, actor, 'PRESCRIPTION_ADDED', 'Prescription', null, prescription);
      return prescription;
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
    return this.prisma.$transaction(async tx => {
    const actor = await requireActor(tx, requester.userId, [Role.doctor, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM encounters WHERE id = ${id} FOR UPDATE`);
    const encounter = await tx.encounter.findUnique({ where: { id } });
    if (!encounter || encounter.deletedAt) throw new NotFoundException({ error: { code: 'ENCOUNTER_NOT_FOUND', message: 'الزيارة الطبية غير موجودة', details: [] } });

    const isOwner = encounter.doctorId === requester.userId;
    const isAdmin = actor.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN_ENCOUNTER_DELETE',
          message: 'لا يمكنك حذف سجل طبي لا يخصك',
          details: [],
        },
      });
    }

    const after = await tx.encounter.update({
      where: { id },
      data: { deletedAt: new Date(), deleteReason: reason },
    });
    await writeEntityAudit(tx, requester.userId, 'ENCOUNTER_SOFT_DELETED', 'Encounter', encounter, after);
    return after;
    });
  }
}
