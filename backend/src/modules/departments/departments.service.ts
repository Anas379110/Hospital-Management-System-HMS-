import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getBeds(departmentId: string) {
    await this.assertExists(departmentId);
    return this.prisma.bed.findMany({ where: { departmentId } });
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
