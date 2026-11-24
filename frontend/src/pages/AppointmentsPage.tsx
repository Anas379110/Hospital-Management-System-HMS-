import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  useAppointments,
  useCreateAppointment,
  useCancelAppointment,
} from '../hooks/useAppointments';
import { getApiErrorMessage } from '../api/client';
import { validateAppointment, localDateInput, type AppointmentFieldErrors } from '../lib/appointmentForm';

const statusColor: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
  scheduled: 'default',
  completed: 'success',
  no_show: 'warning',
  cancelled: 'error',
};

export default function AppointmentsPage() {
  const { i18n, t } = useTranslation();
  const today = localDateInput();

  const [date, setDate] = useState(today);
  const [doctorId, setDoctorId] = useState('');
  const { data: appointments, isLoading, isError, error, refetch, isFetching } = useAppointments(doctorId || undefined, date);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AppointmentFieldErrors>({});
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [formDoctorId, setFormDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const createAppointment = useCreateAppointment();
  const cancelAppointment = useCancelAppointment();

  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';
  const cancellationTarget = appointments?.find(appointment => appointment.id === cancelId);

  async function handleCreate() {
    if (createAppointment.isPending) return;
    setFormError(null);
    const errors = validateAppointment({ patientId, doctorId: formDoctorId, departmentId, scheduledAt });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      await createAppointment.mutateAsync({
        patientId: patientId.trim(),
        doctorId: formDoctorId.trim(),
        departmentId: departmentId.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setDialogOpen(false);
      setNotice('appointments.created');
      setPatientId('');
      setFormDoctorId('');
      setDepartmentId('');
      setScheduledAt('');
    } catch (err) {
      // FR-3.2: رسالة واضحة عند تعارض الحجز (409) — راجع API.md
      setFormError(getApiErrorMessage(err, t('appointments.createError')));
    }
  }


  async function handleCancel() {
    if (!cancelId || cancelAppointment.isPending) return;
    setCancelError(null);
    try {
      await cancelAppointment.mutateAsync({ id: cancelId });
      setCancelId(null);
      setNotice('appointments.cancelledSuccess');
    } catch (err) {
      setCancelError(getApiErrorMessage(err, t('appointments.cancelError')));
    }
  }
  const fieldMessage = (name: keyof AppointmentFieldErrors) => fieldErrors[name] ? t(`appointments.${fieldErrors[name] === 'datetime' ? 'invalidDate' : fieldErrors[name]}`) : '';

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>
          {t('appointments.title')}
        </Typography>
        <Button variant="contained" onClick={() => { setFormError(null); setFieldErrors({}); setDialogOpen(true); }}>
          {t('appointments.new')}
        </Button>
      </Box>

      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        <TextField
          type="date"
          label={t('appointments.day')}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {/* ملاحظة MVP: فلترة بمعرف الطبيب مباشرة — لا توجد بعد شاشة قائمة أطباء منفصلة (خارج نطاق Slice 3) */}
        <TextField
          label={t('appointments.doctorFilter')}
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        />
      </Box>

      {notice && <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{t(notice)}</Alert>}
      {!date && <Alert severity="info" sx={{ mb: 2 }}>{t('appointments.chooseDay')}</Alert>}
      {isError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => refetch()} disabled={isFetching}>{t('appointments.retry')}</Button>}>{getApiErrorMessage(error, t('appointments.loadError'))}</Alert>}
      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress aria-label={t('appointments.loading')} />
        </Box>
      )}

      {!isLoading && appointments && appointments.length === 0 && (
        <Typography color="text.secondary">{t('appointments.empty')}</Typography>
      )}

      {!isLoading && appointments && appointments.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('appointments.time')}</TableCell>
                <TableCell>{t('appointments.status')}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>
                    {new Date(appt.scheduledAt).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`appointments.${appt.status}`)} size="small" color={statusColor[appt.status]} />
                  </TableCell>
                  <TableCell>
                    {appt.status === 'scheduled' && (
                      <Button
                        size="small"
                        color="error"
                        disabled={cancelAppointment.isPending}
                        onClick={() => { setCancelError(null); setCancelId(appt.id); }}
                      >
                        {t('appointments.cancel')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary">{t('appointments.localTime')} {Intl.DateTimeFormat().resolvedOptions().timeZone}</Typography>
      <Dialog open={Boolean(cancelId)} onClose={() => { if (!cancelAppointment.isPending) setCancelId(null); }} fullWidth maxWidth="xs">
        <DialogTitle>{t('appointments.confirmTitle')}</DialogTitle>
        <DialogContent><Typography>{t('appointments.confirmBody')}</Typography>{cancellationTarget && <Typography sx={{ mt: 1 }}><time dateTime={cancellationTarget.scheduledAt}>{new Date(cancellationTarget.scheduledAt).toLocaleString(locale)}</time></Typography>}{cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}</DialogContent>
        <DialogActions><Button disabled={cancelAppointment.isPending} onClick={() => setCancelId(null)}>{t('appointments.close')}</Button><Button color="error" disabled={cancelAppointment.isPending} onClick={handleCancel}>{t('appointments.confirm')}</Button></DialogActions>
      </Dialog>
      <Dialog open={dialogOpen} onClose={() => { if (!createAppointment.isPending) setDialogOpen(false); }} fullWidth maxWidth="sm">
        <DialogTitle>{t('appointments.new')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label={t('appointments.patient')}
            required
            error={Boolean(fieldErrors.patientId)}
            helperText={fieldMessage('patientId')}
            disabled={createAppointment.isPending}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('appointments.doctor')}
            required
            error={Boolean(fieldErrors.doctorId)}
            helperText={fieldMessage('doctorId')}
            disabled={createAppointment.isPending}
            value={formDoctorId}
            onChange={(e) => setFormDoctorId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('appointments.department')}
            required
            error={Boolean(fieldErrors.departmentId)}
            helperText={fieldMessage('departmentId')}
            disabled={createAppointment.isPending}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            type="datetime-local"
            label={t('appointments.datetime')}
            required
            error={Boolean(fieldErrors.scheduledAt)}
            helperText={fieldMessage('scheduledAt')}
            disabled={createAppointment.isPending}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {formError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={createAppointment.isPending} onClick={() => setDialogOpen(false)}>{t('appointments.close')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createAppointment.isPending}>
            {t('appointments.book')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
                  }
