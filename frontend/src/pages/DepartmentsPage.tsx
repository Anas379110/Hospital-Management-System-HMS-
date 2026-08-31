import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useDepartments, useDepartmentBeds, useAdmitPatient } from '../hooks/useDepartments';
import { getApiErrorMessage } from '../api/client';
import type { Bed } from '../types/departments';

const statusStyles: Record<Bed['status'], { bg: string; label: string }> = {
  available: { bg: '#e8f5e9', label: 'متاح' },
  occupied: { bg: '#ffebee', label: 'مشغول' },
  maintenance: { bg: '#fff8e1', label: 'صيانة' },
};

export default function DepartmentsPage() {
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const [selectedDept, setSelectedDept] = useState('');
  const { data: beds, isLoading: loadingBeds } = useDepartmentBeds(selectedDept || undefined);

  const [admitDialogBed, setAdmitDialogBed] = useState<Bed | null>(null);
  const [patientId, setPatientId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const admitPatient = useAdmitPatient();

  async function handleAdmit() {
    if (!admitDialogBed || !patientId) return;
    setError(null);
    try {
      await admitPatient.mutateAsync({ patientId, bedId: admitDialogBed.id });
      setAdmitDialogBed(null);
      setPatientId('');
    } catch (err) {
      // FR-5.2 / UC-1 Alternative Flow: رسالة واضحة عند شغل السرير بين لحظة العرض والتأكيد
      setError(getApiErrorMessage(err, 'تعذَّر التسكين'));
    }
  }

  return (
    <Box p={4}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        الأقسام والأسرّة
      </Typography>

      {loadingDepts && <CircularProgress />}

      {departments && (
        <TextField
          select
          label="اختر القسم"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          sx={{ mb: 3, minWidth: 240 }}
        >
          {departments.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.nameAr} / {d.nameEn}
            </MenuItem>
          ))}
        </TextField>
      )}

      {loadingBeds && <CircularProgress />}

      {beds && (
        <Grid container spacing={2}>
          {beds.map((bed) => {
            const style = statusStyles[bed.status];
            return (
              <Grid item xs={6} sm={4} md={3} key={bed.id}>
                <Card sx={{ bgcolor: style.bg }}>
                  <CardActionArea
                    disabled={bed.status !== 'available'}
                    onClick={() => setAdmitDialogBed(bed)}
                    sx={{ p: 2, textAlign: 'center' }}
                  >
                    <Typography fontWeight={700}>{bed.bedNumber}</Typography>
                    <Typography variant="caption">{style.label}</Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* FR-5.2 / UC-1: تسكين مريض في سرير متاح */}
      <Dialog open={!!admitDialogBed} onClose={() => setAdmitDialogBed(null)}>
        <DialogTitle>تسكين مريض — سرير {admitDialogBed?.bedNumber}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="معرّف المريض"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdmitDialogBed(null)}>إلغاء</Button>
          <Button variant="contained" onClick={handleAdmit} disabled={admitPatient.isPending}>
            تأكيد التسكين
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
