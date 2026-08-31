export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: 'cash' | 'card' | 'insurance';
  paidAt: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  insuranceCoveragePercent: number;
  items: InvoiceItem[];
  payments: Payment[];
  subtotal: number;
  patientResponsibility: number;
  totalPaid: number;
  remaining: number;
}
