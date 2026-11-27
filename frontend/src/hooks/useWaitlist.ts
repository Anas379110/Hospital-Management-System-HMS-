import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useFreshRead } from './useFreshRead';
export type WaitlistItem = { id: string; departmentId: string; requestedAt: string; status: 'pending'; patient: { id: string; fullName: string; mrn: string } };
export function useWaitlist(departmentId: string, page: number) {
  return useFreshRead({ queryKey: ['departments', departmentId, 'waitlist', page], enabled: !!departmentId, queryFn: async ({ signal }) => (await apiClient.get<{ items: WaitlistItem[]; page: number; total: number }>(`/departments/${departmentId}/waitlist`, { signal, params: { page } })).data });
}
export function useWaitlistWrite(departmentId: string) {
  const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (action: { patientId: string } | { cancelId: string }) => {
    const path = `/departments/${departmentId}/waitlist`;
    return 'cancelId' in action ? apiClient.post(`${path}/${action.cancelId}/cancel`, {}) : apiClient.post(path, { patientId: action.patientId });
  }, onSettled: () => { void client.invalidateQueries({ queryKey: ['departments', departmentId] }); } });
}
