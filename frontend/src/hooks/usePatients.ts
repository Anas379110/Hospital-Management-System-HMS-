import { responseIsCurrent } from '../api/sessionIsolation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Patient } from '../types/api';

export interface CreatePatientInput {
  fullName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  phone: string;
  nationalId?: string;
  address?: string;
}

export function usePatientsSearch(search: string) {
  return useQuery({
    queryKey: ['patients', 'search', search],
    queryFn: async () => {
      const res = await apiClient.get<Patient[]>('/patients', { params: { search } });
      return res.data;
    },
    enabled: search.length >= 2, // Search begins at two characters to avoid unbounded directory queries.
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, force }: { input: CreatePatientInput; force?: boolean }) => {
      const res = await apiClient.post<Patient>('/patients', input, {
        params: force ? { force: 'true' } : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function usePatientForEditing(id: string | undefined) {
  return useQuery({ queryKey: ['patients', 'edit', id], queryFn: async () => (await apiClient.get<Patient>(`/patients/${id}`)).data, enabled: !!id, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false });
}

export function usePatient(id: string | undefined) {
  return useQuery({ queryKey: ['patients', id], queryFn: async () => (await apiClient.get<Patient>(`/patients/${id}`)).data, enabled: !!id });
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: import('../pages/patientEdit').PatientPatch) => (await apiClient.patch<Patient>(`/patients/${id}`, input)).data,
    onSuccess: updated => {
      if (!responseIsCurrent(updated)) return;
      queryClient.setQueryData(['patients', 'edit', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['patients'], predicate: query => query.queryKey[1] !== 'edit' });
    },
  });
}
