import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestOrderDto } from './dto/create-test-order.dto';
import { RecordResultDto } from './dto/record-result.dto';

@Injectable()
export class LabService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-7.1
  async createOrder(dto: CreateTestOrderDto, orderedBy: string) {
    // إصلاح أمني/سلامة مريض حقيقي (راجع docs/security/SECURITY-REVIEW.md Finding #7):
    // patientId وencounterId كانا يُقبَلان بلا أي تحقق من ترابطهما فعلياً —
    // إدخال خاطئ (أو متعمَّد) كان يمكن أن يُنسب نتيجة فحص لمريض غير صحيح.
    const encounter = await this.prisma.encounter.findUnique({ where: { id: dto.encounterId } });
    if (!encounter) {
      throw new NotFoundException({
        error: { code: 'ENCOUNTER_NOT_FOUND', message: 'الزيارة الطبية غير موجودة', details: [] },
      });
    }
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException({
        error: {
          code: 'PATIENT_ENCOUNTER_MISMATCH',
          message: 'الزيارة المحددة لا تخص هذا المريض — تحقق من صحة المعرِّفات',
          details: [],
        },
      });
    }

    return this.prisma.testOrder.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        orderedBy,
        testType: dto.testType,
        testName: dto.testName,
      },
    });
  }

  // FR-7.2
  async pendingOrders() {
    return this.prisma.testOrder.findMany({
      where: { status: 'pending' },
      include: { patient: true, orderedByUser: true },
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
    const order = await this.findOrderOrThrow(id);
    if (order.status !== 'pending') {
      throw new ConflictException({
        error: {
          code: 'TEST_ORDER_ALREADY_PROCESSED',
          message: 'تم التعامل مع هذا الطلب مسبقاً',
          details: [{ currentStatus: order.status }],
        },
      });
    }

    return this.prisma.testOrder.update({
      where: { id },
      data: {
        result: dto.result,
        resultNotes: dto.resultNotes,
        status: 'completed',
        completedBy,
        completedAt: new Date(),
      },
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
