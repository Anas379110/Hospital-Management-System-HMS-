import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { DepartmentNamesDto } from './dto/setup.dto';

const conflict = (code: string) => new ConflictException({ error: { code, message: 'Setup changed or has linked history. Refresh before trying again.', details: [] } });
const missing = (code: string) => new NotFoundException({ error: { code, message: 'Setup record not found.', details: [] } });
@Injectable()
export class DepartmentSetupService {
  constructor(private readonly prisma: PrismaService) {}
  private async department(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM departments WHERE id=${id} FOR UPDATE`;
    const row = await tx.department.findUnique({ where: { id } });
    if (!row) throw missing('DEPARTMENT_NOT_FOUND');
    return row;
  }
  private async bed(tx: Prisma.TransactionClient, departmentId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM beds WHERE id=${id} AND department_id=${departmentId} FOR UPDATE`;
    const row = await tx.bed.findFirst({ where: { id, departmentId } });
    if (!row) throw missing('BED_NOT_FOUND');
    return row;
  }
  private async write<T>(actor: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async tx => { await requireActor(tx, actor, [Role.admin]); return fn(tx); }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw conflict('SETUP_HAS_HISTORY');
      throw e;
    });
  }
  createDepartment(dto: DepartmentNamesDto, actor: string) {
    return this.write(actor, async tx => {
      const row = await tx.department.create({ data: { nameAr: dto.nameAr.trim(), nameEn: dto.nameEn.trim(), totalBeds: 0 } });
      await writeEntityAudit(tx, actor, 'DEPARTMENT_CREATED', 'Department', null, row);
      return row;
    });
  }
  renameDepartment(id: string, dto: DepartmentNamesDto, actor: string) {
    return this.write(actor, async tx => {
      const before = await this.department(tx, id);
      const after = await tx.department.update({ where: { id }, data: { nameAr: dto.nameAr.trim(), nameEn: dto.nameEn.trim() } });
      await writeEntityAudit(tx, actor, 'DEPARTMENT_UPDATED', 'Department', before, after);
      return after;
    });
  }
  deleteDepartment(id: string, actor: string) {
    return this.write(actor, async tx => {
      const before = await this.department(tx, id);
      if (await tx.bed.count({ where: { departmentId: id } }) || await tx.appointment.count({ where: { departmentId: id } })) throw conflict('SETUP_HAS_HISTORY');
      await tx.department.delete({ where: { id } });
      await writeEntityAudit(tx, actor, 'DEPARTMENT_DELETED', 'Department', before, { ...before, deleted: true });
      return { id, deleted: true };
    });
  }
  createBed(departmentId: string, bedNumber: string, actor: string) {
    return this.write(actor, async tx => {
      await this.department(tx, departmentId);
      const label = bedNumber.trim();
      if (await tx.bed.findFirst({ where: { departmentId, bedNumber: label } })) throw conflict('BED_NUMBER_EXISTS');
      const row = await tx.bed.create({ data: { departmentId, bedNumber: label, status: 'available' } });
      await tx.department.update({ where: { id: departmentId }, data: { totalBeds: await tx.bed.count({ where: { departmentId } }) } });
      await writeEntityAudit(tx, actor, 'BED_CREATED', 'Bed', null, row);
      return row;
    });
  }
  updateBed(departmentId: string, id: string, change: { bedNumber: string } | { status: 'available' | 'maintenance' }, actor: string) {
    return this.write(actor, async tx => {
      await this.department(tx, departmentId);
      const before = await this.bed(tx, departmentId, id);
      if ('status' in change && (before.status === 'occupied' || await tx.admission.count({ where: { bedId: id, dischargedAt: null } }))) throw conflict('BED_OCCUPIED');
      const data = 'bedNumber' in change ? { bedNumber: change.bedNumber.trim() } : { status: change.status };
      if ('bedNumber' in data && await tx.bed.findFirst({ where: { departmentId, bedNumber: data.bedNumber, id: { not: id } } })) throw conflict('BED_NUMBER_EXISTS');
      const changed = await tx.bed.updateMany({ where: { id, departmentId, status: before.status }, data });
      if (changed.count !== 1) throw conflict('BED_STATE_CHANGED');
      const after = await tx.bed.findUniqueOrThrow({ where: { id } });
      await writeEntityAudit(tx, actor, 'BED_UPDATED', 'Bed', before, after);
      return after;
    });
  }
  deleteBed(departmentId: string, id: string, actor: string) {
    return this.write(actor, async tx => {
      await this.department(tx, departmentId);
      const before = await this.bed(tx, departmentId, id);
      if (before.status === 'occupied' || await tx.admission.count({ where: { bedId: id } })) throw conflict('SETUP_HAS_HISTORY');
      await tx.bed.delete({ where: { id } });
      await tx.department.update({ where: { id: departmentId }, data: { totalBeds: await tx.bed.count({ where: { departmentId } }) } });
      await writeEntityAudit(tx, actor, 'BED_DELETED', 'Bed', before, { ...before, deleted: true });
      return { id, deleted: true };
    });
  }
}
