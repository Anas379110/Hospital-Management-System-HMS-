import { ForbiddenException, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

type Row = Record<string, unknown>;
export const PATIENT_WRITE_ROLES = [Role.admin, Role.receptionist];
export async function requireActor(tx: Prisma.TransactionClient, actor: string, roles: Role[]) {
  if (typeof actor !== 'string' || !actor.trim()) throw new UnauthorizedException({ error: { code: 'AUDIT_ACTOR_REQUIRED', message: 'يلزم مستخدم موثّق لتنفيذ العملية', details: [] } });
  const user = await tx.user.findUnique({ where: { id: actor }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive || !roles.includes(user.role)) throw new ForbiddenException({ error: { code: 'AUDIT_ACTOR_FORBIDDEN', message: 'المستخدم غير نشط أو غير مخوّل لهذه العملية', details: [] } });
  return user;
}
// Entity-specific fields only. Patient demographics and contact values never enter audit.
export const policies: Record<string, { fields: string[]; visible: string[] }> = {
  Appointment: { fields: ['id','patientId','doctorId','departmentId','scheduledAt','status','cancelReason','createdAt','updatedAt'], visible: ['id','patientId','doctorId','departmentId','scheduledAt','status','createdAt','updatedAt'] },
  User: { fields: ['id','username','fullName','role','isActive','createdAt','updatedAt'], visible: ['id','role','isActive','createdAt','updatedAt'] },
  TestOrder: { fields: ['id','patientId','encounterId','orderedBy','testType','testName','status','result','resultNotes','orderedAt','completedBy','completedAt'], visible: ['id','patientId','encounterId','orderedBy','testType','status','orderedAt','completedBy','completedAt'] },
  Medication: { fields: ['id','name','unit','currentStock','reorderThreshold','createdAt','updatedAt'], visible: ['id','currentStock','reorderThreshold','createdAt','updatedAt'] },
  Invoice: { fields: ['id','patientId','admissionId','insuranceCoveragePercent','status','createdBy','createdAt'], visible: ['id','patientId','admissionId','insuranceCoveragePercent','status','createdBy','createdAt'] },
  InvoiceItem: { fields: ['id','invoiceId','description','quantity','unitPrice'], visible: ['id','invoiceId','quantity','unitPrice'] },
  Payment: { fields: ['id','invoiceId','amount','method','recordedBy','paidAt'], visible: ['id','invoiceId','amount','method','recordedBy','paidAt'] },
  Encounter: { fields: ['id', 'patientId', 'doctorId', 'appointmentId', 'chiefComplaint', 'diagnosis', 'notes', 'encounterDate', 'deletedAt', 'deleteReason'], visible: ['id', 'patientId', 'doctorId', 'appointmentId', 'encounterDate', 'deletedAt'] },
  Prescription: { fields: ['id', 'encounterId', 'medicationId', 'medicationName', 'dosage', 'duration', 'notes', 'status', 'createdAt', 'quantityDispensed', 'dispensedAt', 'dispensedBy'], visible: ['id', 'encounterId', 'medicationId', 'status', 'createdAt', 'quantityDispensed', 'dispensedAt', 'dispensedBy'] },
  Patient: {
    fields: ['id', 'mrn', 'fullName', 'dateOfBirth', 'gender', 'nationalId', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'createdBy', 'createdAt', 'updatedAt'],
    visible: ['id', 'createdBy', 'createdAt', 'updatedAt'],
  },
};
function normalize(value: unknown) { return value instanceof Date ? value.toISOString() : value ?? null; }
export async function writeEntityAudit(tx: Prisma.TransactionClient, actor: string, action: string, entityType: string, before: Row | null, after: Row) {
  const policy = policies[entityType];
  if (!policy) throw new Error('Entity audit policy missing');
  const changedFields = policy.fields.filter(key => JSON.stringify(normalize(before?.[key])) !== JSON.stringify(normalize(after[key])));
  const project = (row: Row) => Object.fromEntries(policy.fields.map(key => [key, policy.visible.includes(key) ? normalize(row[key]) : row[key] == null ? null : '[REDACTED]']));
  try {
    await tx.auditLog.create({ data: {
      userId: actor, action, entityType, entityId: after.id as string,
      oldValue: before ? project(before) : Prisma.DbNull,
      newValue: { ...project(after), changedFields },
    } });
  } catch (error: unknown) {
    const failure = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'AUDIT_STORAGE_ERROR';
    new Logger('TransactionAudit').error({ code: 'AUDIT_INSERT_FAILED', failure, action, entityId: after.id });
    throw new ServiceUnavailableException({ error: { code: 'AUDIT_PERSISTENCE_FAILED', message: 'Operation was not performed because its audit record could not be saved. You can retry.', details: [] } });
  }
}

// One audit row for a domain operation involving several entity transitions.
export async function writeCombinedAudit(tx: Prisma.TransactionClient, actor: string, action: string, entityType: string, entityId: string, changes: { type: string; before: Row | null; after: Row }[], context: Row = {}) {
  if (changes.length > 51) throw new Error('Combined audit entity bound exceeded');
  const snapshots = changes.map(change => {
    const policy = policies[change.type];
    if (!policy) throw new Error('Entity audit policy missing');
    const project = (row: Row) => Object.fromEntries(policy.fields.map(key => [key, policy.visible.includes(key) ? normalize(row[key]) : row[key] == null ? null : '[REDACTED]']));
    return { entityType: change.type, before: change.before ? project(change.before) : null, after: project(change.after), changedFields: policy.fields.filter(key => JSON.stringify(normalize(change.before?.[key])) !== JSON.stringify(normalize(change.after[key]))) };
  });
  try {
    await tx.auditLog.create({ data: { userId: actor, action, entityType, entityId,
      oldValue: { entities: snapshots.map(row => ({ entityType: row.entityType, value: row.before })) },
      newValue: { entities: snapshots.map(row => ({ entityType: row.entityType, value: row.after, changedFields: row.changedFields })), context: context as Prisma.InputJsonObject },
    } });
  } catch (error: unknown) {
    const failure = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'AUDIT_STORAGE_ERROR';
    new Logger('TransactionAudit').error({ code: 'AUDIT_INSERT_FAILED', failure, action, entityId });
    throw new ServiceUnavailableException({ error: { code: 'AUDIT_PERSISTENCE_FAILED', message: 'Operation was not performed because its audit record could not be saved. You can retry.', details: [] } });
  }
}
