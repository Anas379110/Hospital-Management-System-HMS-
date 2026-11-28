import { sendPrescriptionCreate, type PrescriptionRequest } from '../api/prescriptionCreateWrite';
import { sendEncounterCreate, type EncounterIdentity } from '../api/encounterCreateWrite';
import { responseIsCurrent } from '../api/sessionIsolation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Encounter } from '../types/emr';

export function usePatientRecords(patientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['patients', patientId, 'records'],
    queryFn: async () => {
      const res = await apiClient.get<Encounter[]>(`/patients/${patientId}/records`);
      return res.data;
    },
    enabled: !!patientId && enabled,
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
    retry: false,
    mutationFn: (request: EncounterIdentity & { input: CreateEncounterInput }) => sendEncounterCreate(request),
    onSuccess: (data, variables) => { if (responseIsCurrent(data)) void queryClient.invalidateQueries({ queryKey: ['patients', variables.patientId, 'records'] }); },
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
    retry: false,
    mutationFn: (request: PrescriptionRequest) => sendPrescriptionCreate(request),
    onSuccess: (data, request) => { if (responseIsCurrent(data)) void queryClient.invalidateQueries({ queryKey: ['patients', request.patientId, 'records'] }); },
  });
}
