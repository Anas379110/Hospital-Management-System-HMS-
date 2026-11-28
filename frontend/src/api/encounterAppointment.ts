import { apiClient } from './client';
import type { Appointment } from '../types/appointments';
export interface EncounterAppointmentSelection { id: string; scheduledAt: string }
export function appointmentSelection(search: string): EncounterAppointmentSelection | null {
 const q=new URLSearchParams(search);if(!q.has('appointment')&&!q.has('appointmentAt'))return null;
 return { id:q.get('appointment')??'',scheduledAt:q.get('appointmentAt')??'' };
}
export function validAppointmentSelection(selection: EncounterAppointmentSelection): boolean {
 return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(selection.id)&&Number.isFinite(Date.parse(selection.scheduledAt));
}
export function eligibleEncounterAppointment(row: Appointment, selection: EncounterAppointmentSelection, patientId: string, doctorId: string): boolean {
 return row.id===selection.id&&row.patientId===patientId&&row.doctorId===doctorId&&Date.parse(row.scheduledAt)===Date.parse(selection.scheduledAt)&&['scheduled','completed'].includes(row.status)&&row.encounter===null;
}
export async function loadEncounterAppointment(selection: EncounterAppointmentSelection, patientId: string, doctorId: string): Promise<Appointment> {
 if(!validAppointmentSelection(selection))throw new Error('Invalid appointment selection');
 const start=new Date(selection.scheduledAt).toISOString(),end=new Date(Date.parse(start)+1).toISOString();
 const response=await apiClient.get<Appointment[]>('/appointments',{params:{doctor_id:doctorId,start,end,page:1}});
 if(response.status!==200||!Array.isArray(response.data))throw new Error('Unverified appointment list');
 const matches=response.data.filter(row=>eligibleEncounterAppointment(row,selection,patientId,doctorId));
 if(matches.length!==1)throw new Error('Appointment is no longer eligible');return matches[0];
}
