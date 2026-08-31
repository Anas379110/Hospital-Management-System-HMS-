export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';
  cancelReason?: string | null;
}
