import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Invoice } from '../types/billing';

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', invoiceId],
    queryFn: async () => (await apiClient.get<Invoice>(`/invoices/${invoiceId}`)).data,
    enabled: !!invoiceId,
  });
}

export interface CreateInvoiceInput {
  patientId: string;
  insuranceCoveragePercent?: number;
  items: { description: string; quantity: number; unitPrice: number }[];
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) =>
      (await apiClient.post<Invoice>('/invoices', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      method,
    }: {
      invoiceId: string;
      amount: number;
      method: 'cash' | 'card' | 'insurance';
    }) => (await apiClient.post(`/invoices/${invoiceId}/payments`, { amount, method })).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.invoiceId] });
    },
  });
}
