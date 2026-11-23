export interface AppointmentFields {
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledAt: string;
}
export type AppointmentFieldErrors = Partial<Record<keyof AppointmentFields, 'required' | 'uuid' | 'datetime'>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAppointment(fields: AppointmentFields): AppointmentFieldErrors {
  const errors: AppointmentFieldErrors = {};
  for (const name of ['patientId', 'doctorId', 'departmentId'] as const) {
    if (!fields[name].trim()) errors[name] = 'required';
    else if (!uuid.test(fields[name].trim())) errors[name] = 'uuid';
  }
  if (!fields.scheduledAt) errors.scheduledAt = 'required';
  else {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(fields.scheduledAt);
    const date = new Date(fields.scheduledAt);
    if (!match || !Number.isFinite(date.valueOf()) ||
      date.getFullYear() !== Number(match[1]) || date.getMonth() + 1 !== Number(match[2]) ||
      date.getDate() !== Number(match[3]) || date.getHours() !== Number(match[4]) || date.getMinutes() !== Number(match[5])) {
      errors.scheduledAt = 'datetime';
    }
  }
  return errors;
}

export function localDateInput(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
