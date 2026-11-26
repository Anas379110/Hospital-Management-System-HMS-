import { canManageBilling } from './permissions';
import { canManageAppointments } from './permissions';
import { describe, expect, it } from 'vitest';
import { allRoles, canAccessPage, landingPath, canViewBeds, canAdmitPatient } from './permissions';

describe('controller-derived workspace access', () => {
  it('covers all eight backend roles with an accessible landing page', () => {
    expect(new Set(allRoles).size).toBe(8);
    for (const role of allRoles) expect(canAccessPage(role, landingPath(role).slice(1))).toBe(true);
  });
  it('restricts registration, pharmacy and lab to current controller roles', () => {
    for (const role of allRoles) {
      expect(canAccessPage(role, 'registration')).toBe(['admin', 'receptionist'].includes(role));
      expect(canAccessPage(role, 'pharmacy')).toBe(['admin', 'pharmacist'].includes(role));
      expect(canAccessPage(role, 'lab')).toBe(['admin', 'lab_tech'].includes(role));
    }
  });
  it('separates department directory, bed viewing and admission writes', () => {
    for (const role of allRoles) {
      expect(canAccessPage(role, 'departments')).toBe(['admin', 'receptionist', 'doctor', 'nurse', 'manager'].includes(role));
      expect(canViewBeds(role)).toBe(['admin', 'doctor', 'nurse', 'manager'].includes(role));
      expect(canAdmitPatient(role)).toBe(['doctor', 'nurse'].includes(role));
    }
  });
  it('fails closed for unknown pages and excludes a doctor from billing', () => {
    expect(canAccessPage('admin', 'unknown')).toBe(false);
    expect(canAccessPage('doctor', 'billing')).toBe(false);
  });
});

it('appointment management matches admin/receptionist only', () => {
  expect(allRoles.filter(canManageAppointments)).toEqual(['admin', 'receptionist']);
});

it('billing writes are admin or billing clerk, manager reads only', () => { expect(allRoles.filter(canManageBilling)).toEqual(['admin', 'billing_clerk']); });

it('user management is admin-only', () => { expect(allRoles.filter(role => canAccessPage(role, 'users'))).toEqual(['admin']); });
