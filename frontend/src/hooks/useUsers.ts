import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Role } from '../types/api';
export interface ManagedUser { id: string; username: string; fullName: string; role: Role; isActive: boolean }
export function useUsers(search: string) {
  return useQuery({ queryKey: ['users', search], queryFn: async () => (await apiClient.get<ManagedUser[]>('/users', { params: { search } })).data, enabled: search.length >= 2 && search.length <= 100 });
}
export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: { username: string; password: string; fullName: string; role: Role }) => (await apiClient.post<ManagedUser>('/users', input)).data, onSuccess: () => { client.invalidateQueries({ queryKey: ['users'] }); } });
}
export function useSetUserStatus() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => (await apiClient.patch<ManagedUser>(`/users/${id}/status`, { isActive })).data, onSuccess: () => { client.invalidateQueries({ queryKey: ['users'] }); } });
}
