import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { PendingTestOrder, TestResult } from '../types/lab';

export function usePendingTestOrders() {
  return useQuery({
    queryKey: ['test-orders', 'pending'],
    queryFn: async () => (await apiClient.get<PendingTestOrder[]>('/test-orders/pending')).data,
  });
}

export function usePatientTestResults(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patients', patientId, 'test-results'],
    queryFn: async () =>
      (await apiClient.get<TestResult[]>(`/patients/${patientId}/test-results`)).data,
    enabled: !!patientId,
  });
}

export function useRecordTestResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      result,
      resultNotes,
    }: {
      orderId: string;
      result: string;
      resultNotes?: string;
    }) => (await apiClient.post(`/test-orders/${orderId}/result`, { result, resultNotes })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-orders', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useCreateTestOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      patientId: string;
      encounterId: string;
      testType: 'lab' | 'radiology';
      testName: string;
    }) => (await apiClient.post('/test-orders', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-orders'] });
    },
  });
}
