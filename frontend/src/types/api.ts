export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

export type Role = 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'manager' | 'pharmacist' | 'lab_tech' | 'billing_clerk';

export interface CurrentUser {
  userId: string;
  username: string;
  role: Role;
}

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  nationalId?: string | null;
  phone: string;
  address?: string | null;
}
