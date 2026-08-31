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
}

export interface BedsSummary {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
}
