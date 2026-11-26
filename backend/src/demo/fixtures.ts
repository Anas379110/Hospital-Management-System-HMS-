/** Synthetic records only. No names, dates of birth, contacts or imported data. */
export const demoCatalog = {
  fictional: true,
  readOnly: true,
  timeZone: 'UTC',
  snapshotDate: '2026-11-25',
  modules: [
    { id: 'patients', records: [
      { id: 'DEMO-P001', label: 'Patient A', state: 'outpatient' },
      { id: 'DEMO-P002', label: 'Patient B', state: 'inpatient' },
    ] },
    { id: 'appointments', records: [
      { id: 'DEMO-A001', label: 'Patient A / Demo clinician A / 2026-11-25 09:00 UTC', state: 'scheduled' },
      { id: 'DEMO-A002', label: 'Patient B / Demo clinician B / 2026-11-25 10:00 UTC', state: 'completed' },
    ] },
    { id: 'departments', records: [
      { id: 'DEMO-B001', label: 'Demo ward / Bed A', state: 'available' },
      { id: 'DEMO-B002', label: 'Demo ward / Bed B', state: 'occupied' },
    ] },
    { id: 'pharmacy', records: [
      { id: 'DEMO-M001', label: 'Fictional stock item A / 40 units', state: 'simulation' },
    ] },
    { id: 'lab', records: [
      { id: 'DEMO-L001', label: 'Patient A / Fictional test A', state: 'pending' },
    ] },
    { id: 'billing', records: [
      { id: 'DEMO-I001', label: 'Patient A / 100 demo units / No real currency', state: 'simulated' },
    ] },
  ],
} as const;
