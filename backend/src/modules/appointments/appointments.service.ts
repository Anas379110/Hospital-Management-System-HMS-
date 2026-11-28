import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-3.2: منع تعارض موعدين لنفس الطبيب بنفس الوقت.
   * هذا الفحص هو خط الدفاع التطبيقي؛ يُستكمل بـ Unique Partial Index على
   * (doctor_id, scheduled_at) WHERE status != 'cancelled' يُضاف يدوياً بملف
   * Migration SQL (راجع DATABASE.md §3 و schema.prisma تعليق appointments)
   * كخط دفاع ثانٍ ضد تعارض التزامن (Race Condition) الذي لا يغطيه هذا الفحص وحده.
   */
  private async assertNoConflict(doctorId: string, scheduledAt: Date, excludeId: string | undefined, tx: Prisma.TransactionClient) {
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt,
        status: { not: 'cancelled' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException({
        error: {
          code: 'APPOINTMENT_CONFLICT',
          message: 'الطبيب لديه موعد آخر محجوز بنفس التوقيت',
          details: [{ conflictingAppointmentId: conflict.id }],
        },
      });
    }
  }

  private rethrowSlotConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target;
      if ((Array.isArray(target) && target.includes('doctor_id') && target.includes('scheduled_at')) || target === 'appointments_doctor_time_unique' || (target == null && error.meta?.modelName === 'Appointment')) {
        throw new ConflictException({ error: {
          code: 'APPOINTMENT_CONFLICT', message: 'الطبيب لديه موعد آخر محجوز بنفس التوقيت', details: [],
        } });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new ConflictException({ error: { code: 'APPOINTMENT_REFERENCE_CHANGED', message: 'An appointment reference changed. Refresh before trying again.', details: [] } });
    throw error;
  }

  // FR-3.1
  async create(dto: CreateAppointmentDto, actor: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.receptionist, Role.admin]);
    if (!await tx.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود', details: [] } });
    const doctor = await tx.user.findUnique({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException({ error: { code: 'DOCTOR_NOT_FOUND', message: 'الطبيب غير موجود', details: [] } });
    if (!doctor.isActive || doctor.role !== Role.doctor) throw new ConflictException({ error: { code: 'INVALID_APPOINTMENT_DOCTOR', message: 'يلزم طبيب نشط للموعد', details: [] } });
    if (!await tx.department.findUnique({ where: { id: dto.departmentId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'DEPARTMENT_NOT_FOUND', message: 'القسم غير موجود', details: [] } });
    const scheduledAt = new Date(dto.scheduledAt);
    await this.assertNoConflict(dto.doctorId, scheduledAt, undefined, tx);

    const appointment = await tx.appointment.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        departmentId: dto.departmentId,
        scheduledAt,
      },
    });
    await writeEntityAudit(tx, actor, 'APPOINTMENT_CREATED', 'Appointment', null, appointment);
    return appointment;
    }).catch((error: unknown) => this.rethrowSlotConflict(error));
  }

  async options() {
    const [doctors, departments] = await Promise.all([
      this.prisma.user.findMany({ where: { role: Role.doctor, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
      this.prisma.department.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameEn: 'asc' } }),
    ]);
    return { doctors, departments };
  }

  // FR-3.4: جدول مواعيد طبيب ليوم/فترة محددة
  async findByDoctorAndDate(doctorId?: string, date?: string, start?: string, end?: string, page?: number) {
    if ((!!start !== !!end) || (start && end && (!/(Z|[+-]\d{2}:\d{2})$/.test(start) || !/(Z|[+-]\d{2}:\d{2})$/.test(end) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start) || Date.parse(end) - Date.parse(start) > 31 * 86400000))) throw new BadRequestException({ error: { code: 'INVALID_APPOINTMENT_RANGE', message: 'Provide a valid timezone-qualified start/end range of at most 31 days.', details: [] } });
    const selectedDate = date ?? new Date().toISOString().slice(0, 10);
    const appointments = await this.prisma.appointment.findMany({
      take: page ? 100 : 501,
      ...(page ? { skip: (page - 1) * 100 } : {}),
      include: { patient: { select: { fullName: true, mrn: true } }, doctor: { select: { fullName: true } }, department: { select: { nameAr: true, nameEn: true } }, encounter: { select: { id: true } } },
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(start && end ? { scheduledAt: { gte: new Date(start), lt: new Date(end) } } : selectedDate
          ? {
              scheduledAt: {
                gte: new Date(`${selectedDate}T00:00:00.000Z`),
                lt: new Date(new Date(`${selectedDate}T00:00:00.000Z`).getTime() + 86400000),
              },
            }
          : {}),
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });
    if (appointments.length > 500) throw new BadRequestException({ error: { code: 'APPOINTMENT_RANGE_TOO_LARGE', message: 'Too many appointments. Choose a shorter range or a doctor.', details: [] } });
    return appointments;
  }

  private async findOneOrThrow(id: string, tx: Prisma.TransactionClient) {
    const appointment = await tx.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException({
        error: { code: 'APPOINTMENT_NOT_FOUND', message: 'الموعد غير موجود', details: [] },
      });
    }
    return appointment;
  }

  // FR-3.3
  async update(id: string, dto: UpdateAppointmentDto, actor: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.receptionist, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`);
    const existing = await this.findOneOrThrow(id, tx);
    if (existing.status !== 'scheduled' || await tx.encounter.findUnique({ where: { appointmentId: id }, select: { id: true } })) throw new ConflictException({ error: { code: 'APPOINTMENT_LOCKED', message: 'لا يمكن تعديل موعد غير مجدول أو مرتبط بزيارة', details: [] } });

    if (dto.departmentId && !await tx.department.findUnique({ where: { id: dto.departmentId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'DEPARTMENT_NOT_FOUND', message: 'القسم غير موجود', details: [] } });
    const newScheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;
    if (dto.scheduledAt) {
      await this.assertNoConflict(existing.doctorId, newScheduledAt, id, tx);
    }

    const updated = await tx.appointment.update({
      where: { id },
      data: {
        scheduledAt: newScheduledAt,
        departmentId: dto.departmentId ?? existing.departmentId,
      },
    });
    await writeEntityAudit(tx, actor, 'APPOINTMENT_UPDATED', 'Appointment', existing, updated);
    return updated;
    }).catch((error: unknown) => this.rethrowSlotConflict(error));
  }

  // FR-3.3 (إلغاء) + FR-3.5
  async cancel(id: string, reason: string | undefined, actor: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.receptionist, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`);
    const existing = await this.findOneOrThrow(id, tx);
    if (existing.status !== 'scheduled' || await tx.encounter.findUnique({ where: { appointmentId: id }, select: { id: true } })) throw new ConflictException({ error: { code: 'APPOINTMENT_LOCKED', message: 'لا يمكن تعديل موعد غير مجدول أو مرتبط بزيارة', details: [] } });
    const updated = await tx.appointment.update({
      where: { id },
      data: { status: 'cancelled', cancelReason: reason },
    });
    await writeEntityAudit(tx, actor, 'APPOINTMENT_CANCELLED', 'Appointment', existing, updated);
    return updated;
    });
  }
  async recordAttendance(id: string, dto: RecordAttendanceDto, actor: string) {
    if (!['completed', 'no_show'].includes(dto.status)) throw new BadRequestException({ error: { code: 'INVALID_ATTENDANCE_STATUS', message: 'Attendance must be completed or no_show.', details: [] } });
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, [Role.receptionist, Role.admin]);
      // Same row lock as encounter creation prevents concurrent no-show/visit contradiction.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`);
      const existing = await this.findOneOrThrow(id, tx);
      if (existing.status !== 'scheduled') throw new ConflictException({ error: { code: 'APPOINTMENT_FINAL', message: 'Final appointment attendance cannot be reopened or replaced.', details: [] } });
      if (dto.status === 'no_show' && await tx.encounter.findUnique({ where: { appointmentId: id }, select: { id: true } })) throw new ConflictException({ error: { code: 'APPOINTMENT_HAS_ENCOUNTER', message: 'An appointment with a linked encounter cannot be marked no-show.', details: [] } });
      const updated = await tx.appointment.update({ where: { id }, data: { status: dto.status } });
      await writeEntityAudit(tx, actor, 'APPOINTMENT_ATTENDANCE_RECORDED', 'Appointment', existing, updated);
      return updated;
    });
  }

}
