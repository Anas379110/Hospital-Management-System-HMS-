export interface Medication {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
}

export interface PendingPrescription {
  id: string;
  medicationName: string;
  dosage: string;
  duration: string;
  encounter: {
    patient: { fullName: string; mrn: string };
    doctor: { fullName: string };
  };
}
