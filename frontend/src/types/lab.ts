export interface PendingTestOrder {
  id: string;
  testType: 'lab' | 'radiology';
  testName: string;
  orderedAt: string;
  patient: { fullName: string; mrn: string };
  orderedByUser: { fullName: string };
}

export interface TestResult {
  id: string;
  testType: 'lab' | 'radiology';
  testName: string;
  result: string;
  resultNotes?: string | null;
  completedAt: string;
}
