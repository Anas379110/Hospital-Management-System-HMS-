import { ForbiddenException, UnauthorizedException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

// Deliberate entity policy: identifiers, workflow timestamps and bed status only.
// Clinical discharge notes are never copied, but an actual change is recorded.
export const ADMISSION_ROLES = [Role.doctor, Role.nurse] as const;
const admissionFields = ['id', 'patientId', 'bedId', 'admittedBy', 'admittedAt', 'dischargedAt', 'dischargeNotes'] as const;
const bedFields = ['id', 'status'] as const;
type Row = Record<string, unknown>;
function scalar(value: unknown): Prisma.InputJsonValue | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value as string;
}
function section(before: Row | null, after: Row, fields: readonly string[]) {
  const changedFields = fields.filter(key => JSON.stringify(scalar(before?.[key])) !== JSON.stringify(scalar(after[key])));
  const project = (row: Row) => Object.fromEntries(fields.map(key => [key, key === 'dischargeNotes' ? (row[key] == null ? null : '[REDACTED]') : scalar(row[key])]));
  return { before: before ? project(before) : null, after: project(after), changedFields };
}
export async function requireAdmissionActor(tx: Prisma.TransactionClient, actor: string) {
  if (typeof actor !== 'string' || !actor.trim()) throw new UnauthorizedException('Authenticated actor required');
  const user = await tx.user.findUnique({ where: { id: actor }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive || !ADMISSION_ROLES.some(role => role === user.role)) throw new ForbiddenException('Active clinical actor required');
}
export async function writeAdmissionAudit(tx: Prisma.TransactionClient, actor: string, action: string, before: Row | null, after: Row, bedBefore: Row, bedAfter: Row) {
  const admission = section(before, after, admissionFields);
  const bed = section(bedBefore, bedAfter, bedFields);
  try { await tx.auditLog.create({ data: {
    userId: actor, action, entityType: 'Admission', entityId: after.id as string,
    oldValue: { admission: admission.before, bed: bed.before },
    newValue: { admission: admission.after, bed: bed.after, changedFields: { admission: admission.changedFields, bed: bed.changedFields } },
  } }); } catch {
    new Logger('AdmissionAudit').error({ code: 'AUDIT_INSERT_FAILED', action, entityId: after.id });
    throw new ServiceUnavailableException({ error: { code: 'AUDIT_PERSISTENCE_FAILED', message: 'Operation was not performed because its audit record could not be saved. You can retry.', details: [] } });
  }
}
