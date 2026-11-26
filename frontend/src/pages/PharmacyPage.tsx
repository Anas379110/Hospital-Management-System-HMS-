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
  useAdjustStock,
  useMedications,
  usePendingPrescriptions,
  useDispensePrescription,
} from '../hooks/usePharmacy';
import { useTranslation } from 'react-i18next';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import type { PendingPrescription } from '../types/pharmacy';

export default function PharmacyPage() {
  const { t } = useTranslation();
  const adjustStock = useAdjustStock();
  const [stockId, setStockId] = useState('');
  const [delta, setDelta] = useState('');
  const [reasonCode, setReasonCode] = useState<'restock' | 'correction' | 'disposal'>('correction');
  const [stockSuccess, setStockSuccess] = useState(false);
  async function handleAdjustStock() {
    setError(null); setStockSuccess(false);
    try { await adjustStock.mutateAsync({ id: stockId, delta: Number(delta), reasonCode }); setStockSuccess(true); setDelta(''); }
    catch (err) { setError(getApiErrorCode(err) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(err, t('errors.generic'))); }
  }
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
      setError(getApiErrorCode(err) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(err, t('errors.generic')));
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('pharmacy.title')}
      </Typography>

      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant="h6">{t('stock.title')}</Typography>
        <TextField fullWidth select margin="normal" label={t('stock.medication')} value={stockId} onChange={e => setStockId(e.target.value)}>{medications?.map(m => <MenuItem key={m.id} value={m.id}>{m.name} ({m.currentStock})</MenuItem>)}</TextField>
        <TextField fullWidth type="number" margin="normal" label={t('stock.delta')} value={delta} onChange={e => setDelta(e.target.value)} />
        <TextField fullWidth select margin="normal" label={t('stock.reason')} value={reasonCode} onChange={e => setReasonCode(e.target.value as typeof reasonCode)}>{(['restock','correction','disposal'] as const).map(code => <MenuItem key={code} value={code}>{t(`stock.${code}`)}</MenuItem>)}</TextField>
        <Typography variant="body2" sx={{ my: 1 }}>{t('stock.noPersonalText')}</Typography>
        {stockSuccess && <Alert severity="success" role="status">{t('stock.saved')}</Alert>}
        {error && !dialogRx && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" onClick={handleAdjustStock} disabled={!stockId || !Number.isInteger(Number(delta)) || !delta || Number(delta) === 0 || adjustStock.isPending}>{t('stock.apply')}</Button>
      </CardContent></Card>
      {loadingPending && <CircularProgress />}

      {!loadingPending && pending && pending.length === 0 && (
        <Typography color="text.secondary">{t('pharmacy.empty')}</Typography>
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
                <Chip label={`${t('pharmacy.doctor')}: ${rx.encounter.doctor.fullName}`} size="small" sx={{ mt: 1 }} />
              </Box>
              <Button variant="contained" onClick={() => setDialogRx(rx)}>
                {t('pharmacy.dispense')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!dialogRx} onClose={() => setDialogRx(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('pharmacy.dispense')} {dialogRx?.medicationName}</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label={t('pharmacy.medication')}
            value={medicationId}
            onChange={(e) => setMedicationId(e.target.value)}
          >
            {medications?.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name} {t('pharmacy.available')}: {m.currentStock} {m.unit}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label={t('pharmacy.quantity')}
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
          <Button onClick={() => setDialogRx(null)}>{t('pharmacy.cancel')}</Button>
          <Button variant="contained" onClick={handleDispense} disabled={dispense.isPending || !medicationId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1}>
            {t('pharmacy.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
