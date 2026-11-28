import { Prisma } from '@prisma/client';

const safeStringFields = new Set(['id', 'patientId', 'doctorId', 'departmentId', 'bedId', 'encounterId', 'appointmentId', 'medicationId', 'prescriptionId', 'createdBy', 'admittedBy', 'dispensedBy', 'status', 'role', 'method', 'createdAt', 'updatedAt', 'dischargedAt', 'scheduledAt', 'dispensedAt', 'deletedAt']);
const sensitive = /password|token|secret|authorization|cookie|diagnosis|complaint|notes?|name|phone|address|national|birth|contact|dosage|duration|result|description|reason/i;

/** Bounded audit snapshot. Interim structural snapshot, not a trusted before/after change diff. */
export function auditSnapshot(value: unknown, depth = 0): Prisma.InputJsonValue {
  if (depth > 5) return '[DEPTH_LIMIT]';
  if (value === null || value === undefined) return null as unknown as Prisma.InputJsonValue;
  if (value instanceof Date) return '[REDACTED]';
  if (typeof value === 'string') return '[REDACTED]';
  if (typeof value === 'number') return '[REDACTED]';
  if (typeof value === 'boolean') return '[REDACTED]';
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map(item => auditSnapshot(item, depth + 1));
    if (value.length > 50) items.push('[ARRAY_TRUNCATED]');
    return items;
  }
  if (typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
      if (item instanceof Date) result[key] = safeStringFields.has(key) && Number.isFinite(item.getTime()) ? item.toISOString() : '[REDACTED]';
      else if (sensitive.test(key)) result[key] = '[REDACTED]';
      else if (typeof item === 'string') result[key] = safeStringFields.has(key) ? (item.length > 256 ? '[LONG_VALUE]' : item) : '[REDACTED]';
      else if (typeof item === 'number' || typeof item === 'boolean') result[key] = ['amount', 'quantity', 'currentStock', 'quantityDispensed', 'insuranceCoveragePercent', 'unitPrice', 'isActive', 'totalBeds'].includes(key) ? (typeof item === 'number' && !Number.isFinite(item) ? '[NON_FINITE]' : item) : '[REDACTED]';
      else result[key] = auditSnapshot(item, depth + 1);
    }
    if (Object.keys(value).length > 100) result._truncated = '[KEYS_TRUNCATED]';
    return result;
  }
  return '[UNSUPPORTED]';
}
