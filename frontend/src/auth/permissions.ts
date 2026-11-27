import type { Role } from '../types/api';

export const allRoles: readonly Role[] = [
  'admin', 'receptionist', 'doctor', 'nurse', 'manager', 'pharmacist', 'lab_tech', 'billing_clerk',
];

// Matches read permissions in the current backend controllers. This is UX only;
// the API remains responsible for authorization of each operation.
export const pageRoles: Record<string, readonly Role[]> = {
  audit: ['admin'],
  users: ['admin'],
  registration: ['admin', 'receptionist'],
  patients: ['admin', 'receptionist', 'doctor', 'nurse', 'manager'],
  appointments: ['admin', 'receptionist', 'doctor'],
  departments: ['admin', 'receptionist', 'doctor', 'nurse', 'manager'],
  pharmacy: ['admin', 'pharmacist'],
  lab: ['admin', 'lab_tech'],
  billing: ['admin', 'billing_clerk', 'manager'],
};

export function canAccessPage(role: Role, page: string): boolean {
  return pageRoles[page]?.includes(role) ?? false;
}

export function landingPath(role: Role): string {
  if (role === 'pharmacist') return '/pharmacy';
  if (role === 'lab_tech') return '/lab';
  if (role === 'billing_clerk') return '/billing';
  return '/patients';
}

export function canViewBeds(role: Role): boolean {
  return ['admin', 'doctor', 'nurse', 'manager'].includes(role);
}

export function canAdmitPatient(role: Role): boolean {
  return ['doctor', 'nurse'].includes(role);
}

export function canManageAppointments(role: Role): boolean {
  return ['admin', 'receptionist'].includes(role);
}

export function canManageBilling(role: Role): boolean { return ['admin', 'billing_clerk'].includes(role); }
