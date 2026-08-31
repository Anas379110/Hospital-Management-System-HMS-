import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCreateInvoice, useInvoice, useRecordPayment } from '../hooks/useBilling';
import { getApiErrorMessage } from '../api/client';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

export default function BillingPage() {
  const [patientId, setPatientId] = useState('');
  const [insurancePercent, setInsurancePercent] = useState('0');
  const [items, setItems] = useState<ItemRow[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'insurance'>('cash');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  const { data: invoice, isLoading } = useInvoice(activeInvoiceId ?? undefined);

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function handleCreate() {
    setCreateError(null);
    try {
      const invoice = await createInvoice.mutateAsync({
        patientId,
        insuranceCoveragePercent: Number(insurancePercent) || 0,
        items: items
          .filter((it) => it.description && it.unitPrice)
          .map((it) => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice),
          })),
      });
      setActiveInvoiceId(invoice.id);
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'تعذَّر إنشاء الفاتورة'));
    }
  }

  async function handlePayment() {
    if (!activeInvoiceId || !paymentAmount) return;
    setPaymentError(null);
    try {
      await recordPayment.mutateAsync({
        invoiceId: activeInvoiceId,
        amount: Number(paymentAmount),
        method: paymentMethod,
      });
      setPaymentAmount('');
    } catch (err) {
      // FR-8.4: رسالة "المبلغ أكبر من المتبقي" تظهر هنا حرفياً كما بالـ Backend
      setPaymentError(getApiErrorMessage(err, 'تعذَّر تسجيل الدفعة'));
    }
  }

  return (
    <Box p={4} maxWidth={720} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        الفوترة والتأمين
      </Typography>

      {/* تحميل فاتورة موجودة بمعرِّفها مباشرة */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" gap={2}>
            <TextField
              fullWidth
              size="small"
              label="فتح فاتورة موجودة بمعرِّفها"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <Button variant="outlined" onClick={() => setActiveInvoiceId(lookupId)}>
              فتح
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* FR-8.1: إنشاء فاتورة جديدة */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            فاتورة جديدة
          </Typography>
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
            type="number"
            label="نسبة تغطية التأمين % (اختياري)"
            value={insurancePercent}
            onChange={(e) => setInsurancePercent(e.target.value)}
          />

          <Typography variant="subtitle2" mt={2} mb={1}>
            البنود
          </Typography>
          {items.map((item, idx) => (
            <Stack direction="row" gap={1} key={idx} mb={1} alignItems="center">
              <TextField
                label="الوصف"
                size="small"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <TextField
                label="الكمية"
                size="small"
                type="number"
                sx={{ width: 90 }}
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              />
              <TextField
                label="سعر الوحدة"
                size="small"
                type="number"
                sx={{ width: 120 }}
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
              />
              <IconButton
                size="small"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                disabled={items.length === 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            onClick={() => setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }])}
          >
            + إضافة بند
          </Button>

          {createError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {createError}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleCreate}
            disabled={createInvoice.isPending || !patientId}
          >
            إنشاء الفاتورة
          </Button>
        </CardContent>
      </Card>

      {/* عرض الفاتورة النشطة وتسجيل الدفعات */}
      {isLoading && <Typography>جارِ التحميل...</Typography>}

      {invoice && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>
              فاتورة #{invoice.id.slice(0, 8)} — الحالة: {invoice.status}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Stack gap={0.5}>
              <Typography>الإجمالي الفرعي: {invoice.subtotal.toLocaleString()} ل.س</Typography>
              <Typography>
                نسبة التأمين: {invoice.insuranceCoveragePercent}% — مستحق على المريض:{' '}
                {invoice.patientResponsibility.toLocaleString()} ل.س
              </Typography>
              <Typography>المدفوع: {invoice.totalPaid.toLocaleString()} ل.س</Typography>
              <Typography fontWeight={700}>
                المتبقي: {invoice.remaining.toLocaleString()} ل.س
              </Typography>
            </Stack>

            {invoice.remaining > 0 && (
              <Box mt={3} pt={2} borderTop="1px dashed #ccc">
                <Typography variant="subtitle2" mb={1}>
                  تسجيل دفعة
                </Typography>
                <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
                  <TextField
                    label="المبلغ"
                    type="number"
                    size="small"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <TextField
                    select
                    label="طريقة الدفع"
                    size="small"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="cash">نقداً</MenuItem>
                    <MenuItem value="card">بطاقة</MenuItem>
                    <MenuItem value="insurance">تأمين</MenuItem>
                  </TextField>
                  <Button variant="contained" onClick={handlePayment} disabled={recordPayment.isPending}>
                    تسجيل الدفعة
                  </Button>
                </Stack>
                {paymentError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {paymentError}
                  </Alert>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
