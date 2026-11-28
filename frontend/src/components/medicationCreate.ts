export interface MedicationDraft { name: string; unit: string; currentStock: string; reorderThreshold: string }
export interface CreateMedicationInput { name: string; unit: string; currentStock: number; reorderThreshold?: number }
export const emptyMedicationDraft: MedicationDraft = { name: '', unit: '', currentStock: '', reorderThreshold: '' };
function stockNumber(value: string) { return value.trim() !== '' && /^\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) <= 2147483647; }
/** Mirror the existing DTO; do not normalize medication text or invent clinical rules. */
export function medicationInput(draft: MedicationDraft): CreateMedicationInput | null {
  if (draft.name.length < 2 || !draft.unit || !stockNumber(draft.currentStock) || (draft.reorderThreshold !== '' && !stockNumber(draft.reorderThreshold))) return null;
  return { name: draft.name, unit: draft.unit, currentStock: Number(draft.currentStock), ...(draft.reorderThreshold === '' ? {} : { reorderThreshold: Number(draft.reorderThreshold) }) };
}
export function medicationCreateKey(userId: string) { return 'hms_medication_create_unknown:' + userId; }
export function medicationCreateHeld(userId: string) { try { return sessionStorage.getItem(medicationCreateKey(userId)) === 'true'; } catch { return true; } }
export function beginMedicationCreate(userId: string) { const key = medicationCreateKey(userId); if (sessionStorage.getItem(key) === 'true') throw new Error('Medication creation already held');sessionStorage.setItem(key, 'true'); return key; }
export function finishMedicationCreate(key: string, current: boolean, status?: number) { if (current && status !== undefined && status >= 400 && status < 500) sessionStorage.removeItem(key); }
