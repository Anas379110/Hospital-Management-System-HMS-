import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
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
  private async assertNoConflict(doctorId: string, scheduledAt: Date, excludeId?: string) {
    const conflict = await this.prisma.appointment.findFirst({
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

  // FR-3.1
  async create(dto: CreateAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    await this.assertNoConflict(dto.doctorId, scheduledAt);

    return this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        departmentId: dto.departmentId,
        scheduledAt,
      },
    });
  }

  // FR-3.4: جدول مواعيد طبيب ليوم/فترة محددة
  async findByDoctorAndDate(doctorId?: string, date?: string) {
    return this.prisma.appointment.findMany({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(date
          ? {
              scheduledAt: {
                gte: new Date(`${date}T00:00:00.000Z`),
                lt: new Date(`${date}T23:59:59.999Z`),
              },
            }
          : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private async findOneOrThrow(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException({
        error: { code: 'APPOINTMENT_NOT_FOUND', message: 'الموعد غير موجود', details: [] },
      });
    }
    return appointment;
  }

  // FR-3.3
  async update(id: string, dto: UpdateAppointmentDto) {
    const existing = await this.findOneOrThrow(id);

    const newScheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;
    if (dto.scheduledAt) {
      await this.assertNoConflict(existing.doctorId, newScheduledAt, id);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: newScheduledAt,
        departmentId: dto.departmentId ?? existing.departmentId,
      },
    });
  }

  // FR-3.3 (إلغاء) + FR-3.5
  async cancel(id: string, reason?: string) {
    await this.findOneOrThrow(id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled', cancelReason: reason },
    });
  }
}
