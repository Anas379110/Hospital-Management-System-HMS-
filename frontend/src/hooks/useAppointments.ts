import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Appointment } from '../types/appointments';

export function useAppointments(doctorId?: string, date?: string) {
  return useQuery({
    queryKey: ['appointments', doctorId, date],
    queryFn: async () => {
      const res = await apiClient.get<Appointment[]>('/appointments', {
        params: { doctor_id: doctorId, date },
      });
      return res.data;
    },
    enabled: !!date, // راجع US-3 — الجدول يُعرض ليوم محدد دائماً
  });
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledAt: string;
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const res = await apiClient.post<Appointment>('/appointments', input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post(`/appointments/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
