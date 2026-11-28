import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(start: string, end: string) {
    const from = new Date(start), to = new Date(end);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 26 * 60 * 60 * 1000) throw new BadRequestException({ error: { code: 'INVALID_OVERVIEW_RANGE', message: 'Provide a valid local-day interval, at most 26 hours.', details: [] } });
    return this.prisma.$transaction(async tx => {
      const departments = await tx.department.findMany({ select: { id: true, nameAr: true, nameEn: true, beds: { select: { status: true } } }, orderBy: { nameEn: 'asc' } });
      const appointmentCount = await tx.appointment.count({ where: { scheduledAt: { gte: from, lt: to } } });
      return { start: from.toISOString(), end: to.toISOString(), appointmentCount, departments: departments.map(({ beds, ...department }) => ({ ...department, total: beds.length, available: beds.filter(b => b.status === 'available').length, occupied: beds.filter(b => b.status === 'occupied').length, maintenance: beds.filter(b => b.status === 'maintenance').length })) };
    }, { isolationLevel: 'RepeatableRead' });
  }

  // FR-5.1
  async findAll() {
    return this.prisma.department.findMany();
  }

  private async assertExists(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException({
        error: { code: 'DEPARTMENT_NOT_FOUND', message: 'القسم غير موجود', details: [] },
      });
    }
    return department;
  }

  async getBeds(departmentId: string, includeActivePatient = false) {
    await this.assertExists(departmentId);
    return this.prisma.bed.findMany({
      where: { departmentId },
      select: {
        id: true, departmentId: true, bedNumber: true, status: true,
        ...(includeActivePatient ? { admissions: {
          where: { dischargedAt: null },
          select: { id: true, patient: { select: { id: true, mrn: true, fullName: true } } },
        } } : {}),
      },
    });
  }

  // US-5 / FR-5.4: إحصائية سريعة لحالة الأسرّة
  async getBedsSummary(departmentId: string) {
    await this.assertExists(departmentId);
    const beds = await this.prisma.bed.findMany({ where: { departmentId } });

    const summary = { total: beds.length, available: 0, occupied: 0, maintenance: 0 };
    for (const bed of beds) {
      if (bed.status === 'available') summary.available += 1;
      else if (bed.status === 'occupied') summary.occupied += 1;
      else if (bed.status === 'maintenance') summary.maintenance += 1;
    }
    return summary;
  }
}
