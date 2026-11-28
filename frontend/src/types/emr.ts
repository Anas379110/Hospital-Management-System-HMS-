export interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  duration: string;
  notes?: string | null;
  createdAt: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  chiefComplaint: string;
  diagnosis: string;
  notes?: string | null;
  encounterDate: string;
  prescriptions: Prescription[];
}
