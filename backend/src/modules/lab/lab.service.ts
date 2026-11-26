import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestOrderDto } from './dto/create-test-order.dto';
import { RecordResultDto } from './dto/record-result.dto';

@Injectable()
export class LabService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-7.1
  async createOrder(dto: CreateTestOrderDto, orderedBy: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, orderedBy, [Role.doctor]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM encounters WHERE id = ${dto.encounterId} FOR UPDATE`);
    // Require the encounter to belong to the selected fictional patient.
    // patientId وencounterId كانا يُقبَلان بلا أي تحقق من ترابطهما فعلياً —
    // إدخال خاطئ (أو متعمَّد) كان يمكن أن يُنسب نتيجة فحص لمريض غير صحيح.
    const encounter = await tx.encounter.findUnique({ where: { id: dto.encounterId } });
    if (!encounter || encounter.deletedAt) {
      throw new NotFoundException({
        error: { code: 'ENCOUNTER_NOT_FOUND', message: 'الزيارة الطبية غير موجودة', details: [] },
      });
    }
    if (encounter.doctorId !== orderedBy) throw new ForbiddenException({ error: { code: 'FORBIDDEN_ENCOUNTER_WRITE', message: 'لا يمكنك تعديل زيارة طبيب آخر', details: [] } });
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException({
        error: {
          code: 'PATIENT_ENCOUNTER_MISMATCH',
          message: 'الزيارة المحددة لا تخص هذا المريض — تحقق من صحة المعرِّفات',
          details: [],
        },
      });
    }

    const order = await tx.testOrder.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        orderedBy,
        testType: dto.testType,
        testName: dto.testName,
      },
    });
    await writeEntityAudit(tx, orderedBy, 'TEST_ORDERED', 'TestOrder', null, order);
    return order;
    });
  }

  // FR-7.2
  async pendingOrders() {
    return this.prisma.testOrder.findMany({
      where: { status: 'pending' },
      include: { patient: { select: { fullName: true, mrn: true } }, orderedByUser: { select: { fullName: true } } },
      orderBy: { orderedAt: 'asc' },
    });
  }

  private async findOrderOrThrow(id: string) {
    const order = await this.prisma.testOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException({
        error: { code: 'TEST_ORDER_NOT_FOUND', message: 'طلب الفحص غير موجود', details: [] },
      });
    }
    return order;
  }

  // FR-7.3
  async recordResult(id: string, dto: RecordResultDto, completedBy: string) {
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, completedBy, [Role.lab_tech, Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM test_orders WHERE id = ${id} FOR UPDATE`);
    const order = await tx.testOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException({ error: { code: 'TEST_ORDER_NOT_FOUND', message: 'طلب الفحص غير موجود', details: [] } });
    if (order.status !== 'pending') {
      throw new ConflictException({
        error: {
          code: 'TEST_ORDER_ALREADY_PROCESSED',
          message: 'تم التعامل مع هذا الطلب مسبقاً',
          details: [{ currentStatus: order.status }],
        },
      });
    }

    const after = await tx.testOrder.update({
      where: { id },
      data: {
        result: dto.result,
        resultNotes: dto.resultNotes,
        status: 'completed',
        completedBy,
        completedAt: new Date(),
      },
    });
    await writeEntityAudit(tx, completedBy, 'TEST_RESULT_RECORDED', 'TestOrder', order, after);
    return after;
    });
  }

  // FR-7.4
  async getPatientResults(patientId: string) {
    return this.prisma.testOrder.findMany({
      where: { patientId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });
  }
}
