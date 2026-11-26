export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';
  patient?: { fullName: string; mrn: string };
  doctor?: { fullName: string };
  department?: { nameAr: string; nameEn: string };
  encounter?: { id: string } | null;
  cancelReason?: string | null;
}
