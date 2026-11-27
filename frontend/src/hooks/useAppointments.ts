import { appointmentDayRange } from './appointmentRange';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Appointment } from '../types/appointments';

export function useAppointments(doctorId?: string, date?: string, page = 1, days = 1) {
  return useQuery({
    queryKey: ['appointments', doctorId, date, page, days],
    queryFn: async () => {
      const res = await apiClient.get<Appointment[]>('/appointments', {
        params: { page, doctor_id: doctorId, ...(date ? appointmentDayRange(date, days) : {}) },
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

export function useAppointmentOptions() {
  return useQuery({ queryKey: ['appointments', 'options'], queryFn: async () => (await apiClient.get<{ doctors: { id: string; fullName: string }[]; departments: { id: string; nameAr: string; nameEn: string }[] }>('/appointments/options')).data });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; departmentId: string; scheduledAt: string }) => (await apiClient.patch<Appointment>(`/appointments/${id}`, input)).data,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['appointments'] }); },
  });
}

export function useRecordAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'completed' | 'no_show' }) => (await apiClient.post<Appointment>(`/appointments/${id}/attendance`, { status })).data,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['appointments'] }); },
  });
}
