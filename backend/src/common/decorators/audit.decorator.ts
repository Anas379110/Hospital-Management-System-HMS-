import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit_action';

/**
 * يُستخدم فوق أي Handler لعملية حساسة (Create/Update/Delete على بيانات
 * مريض/طبية) ليتم تسجيلها تلقائياً في audit_logs عبر AuditInterceptor.
 * مثال: @Audit('PATIENT_CREATED', 'Patient')
 */
export const Audit = (action: string, entityType: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType });
