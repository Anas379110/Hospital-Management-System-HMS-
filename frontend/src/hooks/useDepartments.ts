import { useFreshRead } from './useFreshRead';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Department, Bed } from '../types/departments';

export function useDepartments(live = false) {
  return useFreshRead({
    queryKey: ['departments'],
    live,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<Department[]>('/departments', { signal });
      return res.data;
    },
  });
}

export function useDepartmentBeds(departmentId: string | undefined) {
  return useFreshRead({
    queryKey: ['departments', departmentId, 'beds'],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<Bed[]>(`/departments/${departmentId}/beds`, { signal });
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

export function useDischargePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ admissionId, dischargeNotes }: { admissionId: string; dischargeNotes: string }) => {
      const res = await apiClient.post(`/admissions/${admissionId}/discharge`, { dischargeNotes });
      return res.data;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['departments'] }); },
  });
}
