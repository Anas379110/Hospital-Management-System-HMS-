import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Department, Bed } from '../types/departments';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiClient.get<Department[]>('/departments');
      return res.data;
    },
  });
}

export function useDepartmentBeds(departmentId: string | undefined) {
  return useQuery({
    queryKey: ['departments', departmentId, 'beds'],
    queryFn: async () => {
      const res = await apiClient.get<Bed[]>(`/departments/${departmentId}/beds`);
      return res.data;
    },
    enabled: !!departmentId,
  });
}

export function useAdmitPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, bedId }: { patientId: string; bedId: string }) => {
      const res = await apiClient.post('/admissions', { patientId, bedId });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['admissions', variables.bedId] });
    },
  });
}
