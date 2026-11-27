import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { canManageBilling } from '../auth/permissions';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useState } from 'react';
import {
  Autocomplete,
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
import { useCreateInvoice, useInvoice, useRecordPayment, useAddInvoiceItem } from '../hooks/useBilling';
import { getApiErrorCode, getApiErrorMessage, isUnknownWriteOutcome } from '../api/client';

import { decimalInteger } from './billingNumbers';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lockKey = 'hms-billing-unknown'; // Same-tab lock survives role switching and reload.

  const [unknownWrite, setUnknownWrite] = useState(() => import.meta.env.VITE_PUBLIC_DEMO === 'true' && sessionStorage.getItem(lockKey) === 'true');
  const writable = !!user && canManageBilling(user.role) && !unknownWrite;
  function holdUnknown(error: unknown) { if (import.meta.env.VITE_PUBLIC_DEMO === 'true' && isUnknownWriteOutcome(error)) { sessionStorage.setItem(lockKey, 'true'); setUnknownWrite(true); } }

  const displayError = (error: unknown) => getApiErrorCode(error) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(error, t('errors.generic'));
  const [newItem, setNewItem] = useState<ItemRow>({ description: '', quantity: '1', unitPrice: '' });
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemSuccess, setItemSuccess] = useState(false);
  const addInvoiceItem = useAddInvoiceItem();
  const [saved, setSaved] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientSearch,setPatientSearch]=useState('');
  const patientLookup=useQuery({queryKey:['billing-patient',patientSearch],enabled:writable&&patientSearch.trim().length>=2,queryFn:async()=>(await apiClient.get<{id:string;mrn:string;fullName:string}[]>('/patients/billing-lookup',{params:{search:patientSearch}})).data});
  const [insurancePercent, setInsurancePercent] = useState('0');
  const [items, setItems] = useState<ItemRow[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('invoice'));
  const [lookupId, setLookupId] = useState(() => new URLSearchParams(window.location.search).get('invoice') ?? '');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'insurance'>('cash');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  const invoiceQuery = useInvoice(activeInvoiceId ?? undefined);

  const { data: invoice, isLoading } = invoiceQuery;
  const validNewItem = newItem.description.trim() && decimalInteger(newItem.quantity) && Number(newItem.quantity) > 0 && Number(newItem.quantity) <= 2147483647 && decimalInteger(newItem.unitPrice) && Number(newItem.unitPrice) <= 2147483647;
  const validItems = items.length > 0 && items.length <= 50 && items.every(item => item.description.trim() && decimalInteger(item.quantity) && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 && Number(item.quantity) <= 2147483647 && decimalInteger(item.unitPrice) && Number.isInteger(Number(item.unitPrice)) && Number(item.unitPrice) >= 0 && Number(item.unitPrice) <= 2147483647);
  const validInsurance = decimalInteger(insurancePercent) && Number.isInteger(Number(insurancePercent)) && Number(insurancePercent) >= 0 && Number(insurancePercent) <= 100;
  const number = (value: number) => value.toLocaleString(i18n.language === 'ar' ? 'ar-SY' : 'en-US');

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function handleCreate() {
    setCreateError(null); setSaved(false);
    if (!writable || !validItems || !validInsurance) return;
    try {
      const invoice = await createInvoice.mutateAsync({
        patientId,
        insuranceCoveragePercent: Number(insurancePercent),
        items: items
          .map((it) => ({
            description: it.description.trim(),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
      });
      setActiveInvoiceId(invoice.id); setSaved(true); setPaymentSuccess(false); setPaymentError(null); setPaymentAmount(''); setItemSuccess(false); setItemError(null);
    } catch (err) {
      holdUnknown(err); setCreateError(displayError(err));
    }
  }

  async function handleAddItem() {
    if (!writable || !invoice || invoice.status === 'paid' || invoice.status === 'cancelled' || !validNewItem) return;
    setItemError(null); setItemSuccess(false);
    try {
      await addInvoiceItem.mutateAsync({ invoiceId: invoice.id, item: { description: newItem.description.trim(), quantity: Number(newItem.quantity), unitPrice: Number(newItem.unitPrice) } });
      setNewItem({ description: '', quantity: '1', unitPrice: '' }); setItemSuccess(true);
    } catch (error) { holdUnknown(error); setItemError(displayError(error)); }
  }

  async function handlePayment() {
    if (!writable || !activeInvoiceId || !paymentAmount || !decimalInteger(paymentAmount) || !Number.isInteger(Number(paymentAmount)) || Number(paymentAmount) <= 0) return;
    setPaymentError(null); setPaymentSuccess(false);
    try {
      await recordPayment.mutateAsync({
        invoiceId: activeInvoiceId,
        amount: Number(paymentAmount),
        method: paymentMethod,
      });
      setPaymentAmount(''); setPaymentError(null); setPaymentSuccess(true);
    } catch (err) {
      // FR-8.4: رسالة "المبلغ أكبر من المتبقي" تظهر هنا حرفياً كما بالـ Backend
      holdUnknown(err); setPaymentError(displayError(err));
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={720} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('billing.title')}
      </Typography>

      {unknownWrite && <Alert severity="warning" role="alert" sx={{mb:2}}>
        {t('errors.writeUnknown')} {t('billing.unknownHold')}
        <Button onClick={() => { sessionStorage.removeItem(lockKey); setUnknownWrite(false); }}>{t('billing.reconciled')}</Button>
      </Alert>}
      {/* تحميل فاتورة موجودة بمعرِّفها مباشرة */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              fullWidth
              size="small"
              label={t('billing.lookup')}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <Button variant="outlined" disabled={!lookupId.trim() || createInvoice.isPending || recordPayment.isPending || addInvoiceItem.isPending} onClick={() => { setActiveInvoiceId(lookupId.trim()); setSaved(false); setPaymentSuccess(false); setPaymentError(null); setPaymentAmount(''); setItemSuccess(false); setItemError(null); }}>
              {t('billing.open')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {writable && <>
      {/* FR-8.1: إنشاء فاتورة جديدة */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            {t('billing.new')}
          </Typography>
          <Autocomplete openText={t('billing.showPatientOptions')} closeText={t('billing.closePatientOptions')} options={patientLookup.data??[]} getOptionLabel={p=>p.mrn+' '+p.fullName} filterOptions={x=>x}
            onInputChange={(_,value,reason)=>{if(reason==='input'){setPatientSearch(value);setPatientId('');}}}
            onChange={(_,value)=>setPatientId(value?.id??'')} isOptionEqualToValue={(a,b)=>a.id===b.id}
            renderInput={params=><TextField {...params} margin="normal" label={t('billing.patientLookup')} helperText={t('billing.patientLookupHint')} error={patientLookup.isError}/>}/>
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label={t('billing.insurance')}
            value={insurancePercent}
            onChange={(e) => setInsurancePercent(e.target.value)}
          />

          <Typography variant="subtitle2" mt={2} mb={1}>
            {t('billing.items')}
          </Typography>
          {items.map((item, idx) => (
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1} key={idx} mb={1} alignItems="center">
              <TextField
                fullWidth
                label={t('billing.description')}
                size="small"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <TextField
                label={t('billing.quantity')}
                size="small"
                type="number"
                sx={{ width: { xs: '100%', sm: 110 }, flexShrink: 0 }}
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              />
              <TextField
                label={t('billing.unitPrice')}
                size="small"
                type="number"
                sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
              />
              <IconButton
                size="small"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                aria-label={t('billing.remove')} disabled={items.length === 1 || createInvoice.isPending}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            disabled={items.length >= 50 || createInvoice.isPending}
            onClick={() => setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }])}
          >
            {t('billing.add')}
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
            disabled={createInvoice.isPending || recordPayment.isPending || addInvoiceItem.isPending || !patientId.trim() || !validItems || !validInsurance}
          >
            {t('billing.create')}
          </Button>
        </CardContent>
      </Card>

      </>}
      {saved && <Alert severity="success">{t('billing.saved')}</Alert>}
      {invoiceQuery.isError && <Alert severity="error" action={<Button onClick={() => void invoiceQuery.refetch()}>{t('billing.retry')}</Button>}>{displayError(invoiceQuery.error)}</Alert>}
      {/* عرض الفاتورة النشطة وتسجيل الدفعات */}
      {isLoading && <Typography>{t('billing.loading')}</Typography>}

      {paymentSuccess && <Alert severity="success" role="status">{t('billing.paymentSaved')}</Alert>}
      {invoice && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>
              {t('billing.invoice')} #{invoice.id.slice(0, 8)} {t(`billing.states.${invoice.status}`)}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Box component="section" aria-label={t('billing.invoiceItems')} mb={2}>
              <Typography variant="subtitle2">{t('billing.invoiceItems')}</Typography>
              {invoice.items.map(item => <Typography key={item.id}>{item.description} {number(item.quantity)} × {number(item.unitPrice)} {t('billing.currency')}</Typography>)}
            </Box>
            <Stack gap={0.5}>
              <Typography>{t('billing.subtotal')}: {number(invoice.subtotal)} {t('billing.currency')}</Typography>
              <Typography>
                {t('billing.insurance')}: {invoice.insuranceCoveragePercent}% {t('billing.responsibility')}: {number(invoice.patientResponsibility)} {t('billing.currency')}
              </Typography>
              <Typography data-testid="billing-paid">{t('billing.paid')}: {number(invoice.totalPaid)} {t('billing.currency')}</Typography>
              <Typography data-testid="billing-remaining" fontWeight={700}>
                {t('billing.remaining')}: {number(invoice.remaining)} {t('billing.currency')}
              </Typography>
            </Stack>

            <Box component="section" aria-label={t('billing.paymentHistory')} mt={2}>
              <Typography variant="subtitle2">{t('billing.paymentHistory')}</Typography>
              {invoice.payments.length === 0 ? <Typography>{t('billing.noPayments')}</Typography> : invoice.payments.map(payment => <Typography key={payment.id}>{number(payment.amount)} {t('billing.currency')} {t(`billing.${payment.method === 'insurance' ? 'insuranceMethod' : payment.method}`)}</Typography>)}
            </Box>
            {writable && invoice.status !== 'paid' && invoice.status !== 'cancelled' && <Box component="section" aria-label={t('billing.addExistingItem')} mt={3}>
              <Typography variant="subtitle2" mb={1}>{t('billing.addExistingItem')}</Typography>
              <Stack gap={1}>
                <TextField label={t('billing.description')} value={newItem.description} onChange={event => setNewItem({ ...newItem, description: event.target.value })} />
                <TextField type="number" label={t('billing.quantity')} value={newItem.quantity} onChange={event => setNewItem({ ...newItem, quantity: event.target.value })} />
                <TextField type="number" label={t('billing.unitPrice')} value={newItem.unitPrice} onChange={event => setNewItem({ ...newItem, unitPrice: event.target.value })} />
                <Button variant="outlined" onClick={handleAddItem} disabled={!validNewItem || addInvoiceItem.isPending || recordPayment.isPending || createInvoice.isPending}>{t('billing.addExistingItem')}</Button>
              </Stack>
              {itemError && <Alert severity="error">{itemError}</Alert>}
              {itemSuccess && <Alert severity="success" role="status">{t('billing.itemSaved')}</Alert>}
            </Box>}
            {writable && invoice.remaining > 0 && invoice.status !== 'cancelled' && (
              <Box mt={3} pt={2} borderTop="1px dashed #ccc">
                <Typography variant="subtitle2" mb={1}>
                  {t('billing.payment')}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap" alignItems="center">
                  <TextField
                    label={t('billing.amount')}
                    type="number"
                    size="small"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <TextField
                    select
                    label={t('billing.method')}
                    size="small"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' } }}
                  >
                    <MenuItem value="cash">{t('billing.cash')}</MenuItem>
                    <MenuItem value="card">{t('billing.card')}</MenuItem>
                    <MenuItem value="insurance">{t('billing.insuranceMethod')}</MenuItem>
                  </TextField>
                  <Button variant="contained" onClick={handlePayment} disabled={recordPayment.isPending || addInvoiceItem.isPending || createInvoice.isPending || !paymentAmount || !decimalInteger(paymentAmount) || !Number.isInteger(Number(paymentAmount)) || Number(paymentAmount) <= 0 || Number(paymentAmount) > invoice.remaining}>
                    {t('billing.record')}
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
