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

const statusColor: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
  scheduled: 'default',
  completed: 'success',
  no_show: 'warning',
  cancelled: 'error',
};

export default function AppointmentsPage() {
  const { i18n } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [doctorId, setDoctorId] = useState('');
  const { data: appointments, isLoading } = useAppointments(doctorId || undefined, date);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [formDoctorId, setFormDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const createAppointment = useCreateAppointment();
  const cancelAppointment = useCancelAppointment();

  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';

  async function handleCreate() {
    setFormError(null);
    try {
      await createAppointment.mutateAsync({
        patientId,
        doctorId: formDoctorId,
        departmentId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setDialogOpen(false);
      setPatientId('');
      setFormDoctorId('');
      setDepartmentId('');
      setScheduledAt('');
    } catch (err) {
      // FR-3.2: رسالة واضحة عند تعارض الحجز (409) — راجع API.md
      setFormError(getApiErrorMessage(err, 'تعذَّر حجز الموعد'));
    }
  }

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          المواعيد
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          حجز موعد جديد
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          type="date"
          label="اليوم"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {/* ملاحظة MVP: فلترة بمعرف الطبيب مباشرة — لا توجد بعد شاشة قائمة أطباء منفصلة (خارج نطاق Slice 3) */}
        <TextField
          label="معرّف الطبيب (اختياري)"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        />
      </Box>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && appointments && appointments.length === 0 && (
        <Typography color="text.secondary">لا توجد مواعيد بهذا اليوم</Typography>
      )}

      {!isLoading && appointments && appointments.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>الوقت</TableCell>
                <TableCell>الحالة</TableCell>
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
                    <Chip label={appt.status} size="small" color={statusColor[appt.status]} />
                  </TableCell>
                  <TableCell>
                    {appt.status === 'scheduled' && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => cancelAppointment.mutate({ id: appt.id })}
                      >
                        إلغاء
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>حجز موعد جديد</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="معرّف المريض"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="معرّف الطبيب"
            value={formDoctorId}
            onChange={(e) => setFormDoctorId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="معرّف القسم"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            type="datetime-local"
            label="الموعد"
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
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createAppointment.isPending}>
            حجز
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
