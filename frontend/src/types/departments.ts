export interface Department {
  id: string;
  nameAr: string;
  nameEn: string;
  totalBeds: number;
}

export interface Bed {
  id: string;
  departmentId: string;
  bedNumber: string;
  status: 'available' | 'occupied' | 'maintenance';
  admissions?: { id: string; patient: { id: string; mrn: string; fullName: string } }[];
}

export interface BedsSummary {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
}
