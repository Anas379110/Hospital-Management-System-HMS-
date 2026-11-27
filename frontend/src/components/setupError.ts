import { getApiErrorCode, isUnknownWriteOutcome } from '../api/client';

export function setupError(error: unknown): { key: string; close: boolean } {
  const code = getApiErrorCode(error);
  if (code === 'AUDIT_PERSISTENCE_FAILED') return { key: 'departments.auditFailure', close: false };
  if (isUnknownWriteOutcome(error)) return { key: 'errors.writeUnknown', close: true };
  if (['SETUP_HAS_HISTORY','BED_OCCUPIED','BED_STATE_CHANGED','DEPARTMENT_NOT_FOUND','BED_NOT_FOUND'].includes(code ?? '')) return { key: 'setup.conflict', close: true };
  if (code === 'BED_NUMBER_EXISTS') return { key: 'setup.duplicate', close: false };
  if (['FORBIDDEN_ROLE','AUDIT_ACTOR_FORBIDDEN','UNAUTHORIZED','AUDIT_ACTOR_REQUIRED'].includes(code ?? '')) return { key: 'setup.forbidden', close: false };
  if (['VALIDATION_ERROR','BAD_REQUEST'].includes(code ?? '')) return { key: 'setup.invalid', close: false };
  return { key: 'errors.generic', close: false };
}
