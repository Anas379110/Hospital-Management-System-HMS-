import { sendMedicationCreate } from '../api/medicationCreateWrite';
import { type CreateMedicationInput } from '../components/medicationCreate';
import { responseIsCurrent } from '../api/sessionIsolation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Medication, PendingPrescription } from '../types/pharmacy';

export function useMedications() {
  return useQuery({
    queryKey: ['medications'],
    queryFn: async () => (await apiClient.get<Medication[]>('/medications')).data,
  });
}

export function usePendingPrescriptions() {
  return useQuery({
    queryKey: ['prescriptions', 'pending'],
    queryFn: async () =>
      (await apiClient.get<PendingPrescription[]>('/prescriptions/pending')).data,
  });
}

export function useDispensePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      prescriptionId,
      medicationId,
      quantityDispensed,
    }: {
      prescriptionId: string;
      medicationId: string;
      quantityDispensed: number;
    }) => {
      const res = await apiClient.post(`/prescriptions/${prescriptionId}/dispense`, {
        medicationId,
        quantityDispensed,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; delta: number; reasonCode: 'restock' | 'correction' | 'disposal' }) => (await apiClient.patch(`/medications/${id}/stock`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medications'] }),
  });
}

export function useCreateMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (request: { input: CreateMedicationInput; userId: string; epoch: number }) => sendMedicationCreate(request),
    onSuccess: medication => { if (responseIsCurrent(medication)) void queryClient.invalidateQueries({ queryKey: ['medications'] }); },
  });
}
