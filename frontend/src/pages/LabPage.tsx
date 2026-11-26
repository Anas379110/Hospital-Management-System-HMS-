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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { usePendingTestOrders, useRecordTestResult } from '../hooks/useLab';
import { useTranslation } from 'react-i18next';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import type { PendingTestOrder } from '../types/lab';



export default function LabPage() {
  const { t } = useTranslation();
  const { data: pending, isLoading } = usePendingTestOrders();
  const recordResult = useRecordTestResult();

  const [dialogOrder, setDialogOrder] = useState<PendingTestOrder | null>(null);
  const [result, setResult] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!dialogOrder || !result) return;
    setError(null);
    try {
      await recordResult.mutateAsync({ orderId: dialogOrder.id, result, resultNotes });
      setDialogOrder(null);
      setResult('');
      setResultNotes('');
    } catch (err) {
      setError(getApiErrorCode(err) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(err, t('errors.generic')));
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('lab.title')}
      </Typography>

      {isLoading && <CircularProgress />}

      {!isLoading && pending && pending.length === 0 && (
        <Typography color="text.secondary">{t('lab.empty')}</Typography>
      )}

      <Stack gap={2}>
        {pending?.map((order) => (
          <Card key={order.id} variant="outlined">
            <CardContent
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Box>
                <Typography fontWeight={600}>
                  {order.patient.fullName} — {order.patient.mrn}
                </Typography>
                <Typography color="text.secondary">{order.testName}</Typography>
                <Stack direction="row" gap={1} mt={1}>
                  <Chip label={t(`emr.${order.testType}`)} size="small" />
                  <Chip label={`${t('pharmacy.doctor')}: ${order.orderedByUser.fullName}`} size="small" />
                </Stack>
              </Box>
              <Button variant="contained" onClick={() => setDialogOrder(order)}>
                {t('lab.record')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!dialogOrder} onClose={() => setDialogOrder(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('lab.record')} {dialogOrder?.testName}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label={t('lab.result')}
            multiline
            minRows={3}
            value={result}
            onChange={(e) => setResult(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('lab.notes')}
            value={resultNotes}
            onChange={(e) => setResultNotes(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOrder(null)}>{t('lab.cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={recordResult.isPending || !result.trim()}>
            {t('lab.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
