import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  useMedications,
  usePendingPrescriptions,
  useDispensePrescription,
} from '../hooks/usePharmacy';
import { getApiErrorMessage } from '../api/client';
import type { PendingPrescription } from '../types/pharmacy';

export default function PharmacyPage() {
  const { data: pending, isLoading: loadingPending } = usePendingPrescriptions();
  const { data: medications } = useMedications();
  const dispense = useDispensePrescription();

  const [dialogRx, setDialogRx] = useState<PendingPrescription | null>(null);
  const [medicationId, setMedicationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleDispense() {
    if (!dialogRx || !medicationId || !quantity) return;
    setError(null);
    try {
      await dispense.mutateAsync({
        prescriptionId: dialogRx.id,
        medicationId,
        quantityDispensed: Number(quantity),
      });
      setDialogRx(null);
      setMedicationId('');
      setQuantity('');
    } catch (err) {
      // FR-6.4: رسالة نقص المخزون الواضحة تظهر هنا حرفياً كما بالـ Backend
      setError(getApiErrorMessage(err, 'تعذَّر الصرف'));
    }
  }

  return (
    <Box p={4} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        الصيدلية — وصفات بانتظار الصرف
      </Typography>

      {loadingPending && <CircularProgress />}

      {!loadingPending && pending && pending.length === 0 && (
        <Typography color="text.secondary">لا توجد وصفات معلَّقة حالياً</Typography>
      )}

      <Stack gap={2}>
        {pending?.map((rx) => (
          <Card key={rx.id} variant="outlined">
            <CardContent
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Box>
                <Typography fontWeight={600}>
                  {rx.encounter.patient.fullName} — {rx.encounter.patient.mrn}
                </Typography>
                <Typography color="text.secondary">
                  {rx.medicationName} — {rx.dosage} ({rx.duration})
                </Typography>
                <Chip label={`الطبيب: ${rx.encounter.doctor.fullName}`} size="small" sx={{ mt: 1 }} />
              </Box>
              <Button variant="contained" onClick={() => setDialogRx(rx)}>
                صرف
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!dialogRx} onClose={() => setDialogRx(null)} fullWidth maxWidth="sm">
        <DialogTitle>صرف وصفة — {dialogRx?.medicationName}</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="الدواء من المخزون"
            value={medicationId}
            onChange={(e) => setMedicationId(e.target.value)}
          >
            {medications?.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name} — متوفر: {m.currentStock} {m.unit}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="الكمية المصروفة"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogRx(null)}>إلغاء</Button>
          <Button variant="contained" onClick={handleDispense} disabled={dispense.isPending}>
            تأكيد الصرف
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
