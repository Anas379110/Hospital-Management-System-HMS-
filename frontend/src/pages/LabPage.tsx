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
import { getApiErrorMessage } from '../api/client';
import type { PendingTestOrder } from '../types/lab';

const typeLabel: Record<PendingTestOrder['testType'], string> = {
  lab: 'مختبر',
  radiology: 'أشعة',
};

export default function LabPage() {
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
      setError(getApiErrorMessage(err, 'تعذَّر حفظ النتيجة'));
    }
  }

  return (
    <Box p={4} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        المختبر والأشعة — طلبات بانتظار التنفيذ
      </Typography>

      {isLoading && <CircularProgress />}

      {!isLoading && pending && pending.length === 0 && (
        <Typography color="text.secondary">لا توجد طلبات معلَّقة حالياً</Typography>
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
                  <Chip label={typeLabel[order.testType]} size="small" />
                  <Chip label={`الطبيب: ${order.orderedByUser.fullName}`} size="small" />
                </Stack>
              </Box>
              <Button variant="contained" onClick={() => setDialogOrder(order)}>
                تسجيل النتيجة
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!dialogOrder} onClose={() => setDialogOrder(null)} fullWidth maxWidth="sm">
        <DialogTitle>تسجيل نتيجة — {dialogOrder?.testName}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="النتيجة"
            multiline
            minRows={3}
            value={result}
            onChange={(e) => setResult(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="ملاحظات إضافية (اختياري)"
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
          <Button onClick={() => setDialogOrder(null)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={recordResult.isPending}>
            حفظ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
