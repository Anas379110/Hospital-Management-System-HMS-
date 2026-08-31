import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Encounter } from '../types/emr';

export function usePatientRecords(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patients', patientId, 'records'],
    queryFn: async () => {
      const res = await apiClient.get<Encounter[]>(`/patients/${patientId}/records`);
      return res.data;
    },
    enabled: !!patientId,
  });
}

export interface CreateEncounterInput {
  patientId: string;
  chiefComplaint: string;
  diagnosis: string;
  notes?: string;
}

export function useCreateEncounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEncounterInput) => {
      const res = await apiClient.post<Encounter>('/encounters', input);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients', variables.patientId, 'records'] });
    },
  });
}

export interface CreatePrescriptionInput {
  encounterId: string;
  medicationName: string;
  dosage: string;
  duration: string;
  notes?: string;
}

export function useAddPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ encounterId, ...input }: CreatePrescriptionInput) => {
      const res = await apiClient.post(`/encounters/${encounterId}/prescriptions`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
