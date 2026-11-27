import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
const clinical = [Role.doctor, Role.nurse];
const conflict = (code: string) => new ConflictException({ error: { code, message: 'Waitlist changed. Refresh before trying again.', details: [] } });
@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}
  private async department(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM departments WHERE id=${id} FOR UPDATE`;
    if (!await tx.department.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException({ error: { code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.', details: [] } });
  }
  async list(departmentId: string, actor: string, page = 0) {
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, clinical);
      if (!await tx.department.findUnique({ where: { id: departmentId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.', details: [] } });
      const rows = await tx.waitlistRequest.findMany({ where: { departmentId, status: 'pending' }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }], take: 100, skip: page * 100 });
      const patients = await tx.patient.findMany({ where: { id: { in: rows.map(row => row.patientId) } }, select: { id: true, fullName: true, mrn: true } });
      return { items: rows.map(({ id, patientId, departmentId, requestedAt, status }) => ({ id, departmentId, requestedAt, status, patient: patients.find(patient => patient.id === patientId) })), page, total: await tx.waitlistRequest.count({ where: { departmentId, status: 'pending' } }) };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async create(departmentId: string, patientId: string, actor: string) {
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, clinical); await this.department(tx, departmentId);
      if (!await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } })) throw new NotFoundException({ error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.', details: [] } });
      const admitted = await tx.admission.findFirst({ where: { patientId, dischargedAt: null, bed: { departmentId } }, select: { id: true } });
      if (admitted) throw conflict('ALREADY_ADMITTED_TO_DEPARTMENT');
      if (await tx.waitlistRequest.findFirst({ where: { departmentId, patientId, status: 'pending' } })) throw conflict('WAITLIST_ALREADY_PENDING');
      const after = await tx.waitlistRequest.create({ data: { departmentId, patientId, requestedBy: actor } });
      await writeEntityAudit(tx, actor, 'WAITLIST_REQUESTED', 'WaitlistRequest', null, after); return after;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        if (Array.isArray(target) && ['workspace_id','patient_id','department_id'].every(column => target.includes(column)) && target.length === 3) throw conflict('WAITLIST_ALREADY_PENDING');
      }
      throw error;
    });
  }
  async cancel(departmentId: string, id: string, actor: string) {
    return this.prisma.$transaction(async tx => {
      await requireActor(tx, actor, clinical); await this.department(tx, departmentId);
      await tx.$queryRaw`SELECT id FROM waitlist_requests WHERE id=${id} AND department_id=${departmentId} FOR UPDATE`;
      const before = await tx.waitlistRequest.findFirst({ where: { id, departmentId } });
      if (!before) throw new NotFoundException({ error: { code: 'WAITLIST_NOT_FOUND', message: 'Request not found.', details: [] } });
      if (before.status !== 'pending') throw conflict('WAITLIST_ALREADY_CLOSED');
      const after = await tx.waitlistRequest.update({ where: { id }, data: { status: 'cancelled', closedAt: new Date(), closedBy: actor } });
      await writeEntityAudit(tx, actor, 'WAITLIST_CANCELLED', 'WaitlistRequest', before, after); return after;
    });
  }
}
