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
    enabled: search.length >= 2, // لا بحث لحرف/حرفين فقط لتقليل الحمل — راجع ARCHITECTURE.md §8
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
