import type { Appointment } from '../types/appointments';
import { useState } from 'react';
import { Card, CardContent, Autocomplete, MenuItem, Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppointments, useCreateAppointment, useCancelAppointment, useAppointmentOptions, useUpdateAppointment } from '../hooks/useAppointments';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import { usePatientsSearch } from '../hooks/usePatients';
import type { Patient } from '../types/api';
import { useAuth } from '../hooks/useAuth';
import { canManageAppointments } from '../auth/permissions';

const statusColor: Record<string, 'default' | 'success' | 'error' | 'warning'> = { scheduled: 'default', completed: 'success', no_show: 'warning', cancelled: 'error' };


export default function AppointmentsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const writable = !!user && canManageAppointments(user.role);
  const [date, setDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; });
  const [doctorId, setDoctorId] = useState('');
  const [page, setPage] = useState(1);
  const appointments = useAppointments(doctorId || undefined, date, page);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatientsSearch(patientSearch);
  const options = useAppointmentOptions();
  const patientId = selectedPatient?.id ?? ''; 
  const [formDoctorId, setFormDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const [editing, setEditing] = useState<Appointment | null>(null);
  const pendingSave = createAppointment.isPending || updateAppointment.isPending;
  const cancelAppointment = useCancelAppointment();
  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';
  const errorMessage = (error: unknown) => {
    const code = getApiErrorCode(error);
    if (code === 'AUDIT_PERSISTENCE_FAILED') return t('departments.auditFailure');
    if (code === 'APPOINTMENT_RANGE_TOO_LARGE') return t('appointments.tooMany');
    if (code === 'APPOINTMENT_LOCKED') return t('appointments.locked');
    if (code === 'APPOINTMENT_CONFLICT') return t('appointments.conflict');
    return getApiErrorMessage(error, t('errors.generic'));
  };
  async function handleCreate() {
    setFormError(null); setSuccess(null);
    try {
      if (editing) await updateAppointment.mutateAsync({ id: editing.id, departmentId, scheduledAt: new Date(scheduledAt).toISOString() });
      else await createAppointment.mutateAsync({ patientId: patientId.trim(), doctorId: formDoctorId.trim(), departmentId: departmentId.trim(), scheduledAt: new Date(scheduledAt).toISOString() });
      setSuccess(t('appointments.created', { time: new Date(scheduledAt).toLocaleString(locale) }));
      setDialogOpen(false); setSelectedPatient(null); setPatientSearch(''); setFormDoctorId(''); setDepartmentId(''); setScheduledAt('');
    } catch (error) { setFormError(errorMessage(error)); }
  }
  async function handleCancel() {
    if (!cancelTarget) return;
    setActionError(null); setSuccess(null);
    try {
      await cancelAppointment.mutateAsync({ id: cancelTarget, reason: reason.trim() || undefined });
      setCancelTarget(null); setReason(''); setSuccess(t('appointments.cancelledSuccess'));
    } catch (error) { setActionError(errorMessage(error)); }
  }
  const validDate = scheduledAt && Number.isFinite(new Date(scheduledAt).getTime());
  return <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={1100} mx="auto">
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between" mb={3}>
      <Typography variant="h5" fontWeight={700}>{t('appointments.title')}</Typography>
      {writable && <Button variant="contained" onClick={() => { setEditing(null); setDialogOpen(true); setFormError(null); setSelectedPatient(null); setPatientSearch(''); setFormDoctorId(''); setDepartmentId(''); setScheduledAt(''); }}>{t('appointments.new')}</Button>}
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2}>
      <TextField type="date" label={t('appointments.day')} value={date} onChange={e => { setDate(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
      <TextField select sx={{ minWidth: 220 }} label={t('appointments.filterDoctor')} value={doctorId} onChange={e => { setDoctorId(e.target.value); setPage(1); }}><MenuItem value="">{t('appointments.allDoctors')}</MenuItem>{options.data?.doctors.map(doctor => <MenuItem key={doctor.id} value={doctor.id}>{doctor.fullName}</MenuItem>)}</TextField>
    </Stack>
    <Typography variant="body2" color="text.secondary" mb={2}>{t('appointments.timezone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</Typography>
    {success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{success}</Alert>}
    {appointments.isLoading && <CircularProgress aria-label={t('appointments.loading')} />}
    {appointments.isError && <Alert severity="error" action={<Button onClick={() => void appointments.refetch()}>{t('appointments.retry')}</Button>}>{getApiErrorCode(appointments.error) === 'APPOINTMENT_RANGE_TOO_LARGE' ? t('appointments.tooMany') : t('appointments.loadError')}</Alert>}
    {!appointments.isLoading && !appointments.isError && appointments.data?.length === 0 && <Typography color="text.secondary">{t('appointments.empty')}</Typography>}
    <Stack gap={2}>{appointments.data?.map(appt => <Card key={appt.id}><CardContent>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Typography variant="h6">{appt.patient?.fullName ?? t('appointments.patientId')}</Typography>
          <Typography variant="body2">{appt.patient?.mrn}</Typography>
          <Typography>{new Date(appt.scheduledAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
          <Typography variant="body2">{t('appointments.doctorId')}: {appt.doctor?.fullName}</Typography>
          <Typography variant="body2">{t('appointments.departmentId')}: {i18n.language === 'ar' ? appt.department?.nameAr : appt.department?.nameEn}</Typography>
        </Box>
        <Stack alignItems="flex-start" gap={1}>
          <Chip label={t(`appointments.states.${appt.status}`)} size="small" color={statusColor[appt.status]} />
          {appt.encounter && <Typography variant="caption">{t('appointments.linked')}</Typography>}
          {writable && appt.status === 'scheduled' && !appt.encounter && <Button onClick={() => { setEditing(appt); setFormError(null); setDepartmentId(appt.departmentId); setFormDoctorId(appt.doctorId); const time = new Date(appt.scheduledAt); setScheduledAt(new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0,16)); setDialogOpen(true); }}>{t('appointments.edit')}</Button>}
          {writable && appt.status === 'scheduled' && !appt.encounter && <Button size="small" color="error" onClick={() => { setCancelTarget(appt.id); setActionError(null); setReason(''); }}>{t('appointments.cancelAppointment')}</Button>}
        </Stack>
      </Stack>
    </CardContent></Card>)}</Stack>
    <Stack direction="row" gap={2} alignItems="center" justifyContent="center" sx={{ my: 2 }}>
      <Button disabled={page === 1 || appointments.isFetching} onClick={() => setPage(value => value - 1)}>{t('appointments.previous')}</Button>
      <Typography>{t('appointments.page', { page })}</Typography>
      <Button disabled={appointments.isFetching || (appointments.data?.length ?? 0) < 100} onClick={() => setPage(value => value + 1)}>{t('appointments.next')}</Button>
    </Stack>
    <Dialog open={dialogOpen} onClose={() => { if (!pendingSave) setDialogOpen(false); }} fullWidth maxWidth="sm">
      <DialogTitle>{t(editing ? 'appointments.edit' : 'appointments.new')}</DialogTitle><DialogContent>
        {options.isError && <Alert severity="error" action={<Button onClick={() => void options.refetch()}>{t('appointments.retry')}</Button>}>{t('appointments.optionsError')}</Alert>}
        {patients.isError && <Alert severity="error">{t('appointments.patientError')}</Alert>}
        {!editing && <Autocomplete options={patients.data ?? []} value={selectedPatient} onChange={(_, value) => setSelectedPatient(value)} onInputChange={(_, value) => setPatientSearch(value)} filterOptions={values => values} getOptionLabel={patient => `${patient.fullName} (${patient.mrn})`} isOptionEqualToValue={(a,b) => a.id === b.id} loading={patients.isFetching} disabled={pendingSave} noOptionsText={t('appointments.searchHint')} renderInput={params => <TextField {...params} fullWidth margin="normal" label={t('appointments.patientId')} />} />}
        {editing && <Typography sx={{ overflowWrap: 'anywhere' }}>{editing.patient?.fullName} ({editing.patient?.mrn})</Typography>}
        {selectedPatient && <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 1 }}>{selectedPatient.fullName} ({selectedPatient.mrn})</Typography>}
        <TextField id="appointment-doctor" select fullWidth margin="normal" label={t('appointments.doctorId')} value={formDoctorId} onChange={e => setFormDoctorId(e.target.value)} disabled={!!editing || pendingSave || options.isLoading}>{options.data?.doctors.map(doctor => <MenuItem key={doctor.id} value={doctor.id}>{doctor.fullName}</MenuItem>)}</TextField>
        <TextField id="appointment-department" select fullWidth margin="normal" label={t('appointments.departmentId')} value={departmentId} onChange={e => setDepartmentId(e.target.value)} disabled={pendingSave || options.isLoading}>{options.data?.departments.map(department => <MenuItem key={department.id} value={department.id}>{i18n.language === 'ar' ? department.nameAr : department.nameEn}</MenuItem>)}</TextField>
        <TextField fullWidth margin="normal" type="datetime-local" label={t('appointments.time')} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} InputLabelProps={{ shrink: true }} disabled={pendingSave} />
        <Typography variant="body2">{t('appointments.timezone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</Typography>
        {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
      </DialogContent><DialogActions>
        <Button onClick={() => setDialogOpen(false)} disabled={pendingSave}>{t('appointments.close')}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={pendingSave || (!editing && !patientId.trim()) || !formDoctorId.trim() || !departmentId.trim() || !validDate}>{t(editing ? 'appointments.save' : 'appointments.book')}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={!!cancelTarget} onClose={() => { if (!cancelAppointment.isPending) setCancelTarget(null); }} fullWidth maxWidth="sm">
      <DialogTitle>{t('appointments.cancelAppointment')}</DialogTitle><DialogContent>
        <Typography>{t('appointments.cancelConfirm')}</Typography>
        <TextField fullWidth margin="normal" label={t('appointments.reason')} value={reason} onChange={e => setReason(e.target.value)} disabled={cancelAppointment.isPending} inputProps={{ maxLength: 500 }} />
        {actionError && <Alert severity="error">{actionError}</Alert>}
      </DialogContent><DialogActions>
        <Button disabled={cancelAppointment.isPending} onClick={() => setCancelTarget(null)}>{t('appointments.close')}</Button>
        <Button disabled={cancelAppointment.isPending} color="error" variant="contained" onClick={handleCancel}>{t('appointments.confirmCancel')}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
