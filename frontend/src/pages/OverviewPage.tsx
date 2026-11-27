import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, Grid, Stack, TextField, Typography, Card, CardContent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import { appointmentDayRange } from '../hooks/appointmentRange';

type Overview = { start: string; end: string; appointmentCount: number; departments: { id: string; nameAr: string; nameEn: string; total: number; available: number; occupied: number; maintenance: number }[] };
export default function OverviewPage() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; });
  const overview = useQuery({ queryKey: ['overview', date], queryFn: async () => (await apiClient.get<Overview>('/departments/overview', { params: appointmentDayRange(date) })).data, enabled: !!date, refetchInterval: 60000, refetchIntervalInBackground: false });
  return <Box sx={{ p: { xs: 2, sm: 4 } }}>
    <Typography component="h1" variant="h5" fontWeight={700} mb={2}>{t('overview.title')}</Typography>
    <Typography color="text.secondary" mb={2}>{t('overview.description')}</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2}>
      <TextField type="date" label={t('overview.day')} value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      <Button variant="outlined" disabled={!date || overview.isFetching} onClick={() => void overview.refetch()} sx={{ minHeight: 44 }}>{t('overview.refresh')}</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary" mb={2}>{t('appointments.timezone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</Typography>
    {overview.isLoading && <CircularProgress aria-label={t('patients.loading')} />}
    {overview.isError && <Alert severity="error" action={<Button onClick={() => void overview.refetch()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}
    {overview.data && <>
      <Typography role="status" variant="body2" mb={2}>{t('overview.updated', { time: new Date(overview.dataUpdatedAt).toLocaleTimeString(i18n.language === 'ar' ? 'ar-SY' : 'en-US') })}</Typography>
      <Card variant="outlined" sx={{ mb: 3 }}><CardContent><Typography component="h2" variant="h6">{t('overview.appointments')}</Typography><Typography data-testid="appointment-count" variant="h4">{overview.data.appointmentCount}</Typography><Typography variant="body2">{t('overview.allStates')}</Typography></CardContent></Card>
      <Typography component="h2" variant="h6" mb={2}>{t('overview.beds')}</Typography>
      {overview.data.departments.length === 0 && <Alert severity="info">{t('departments.empty')}</Alert>}
      <Grid container spacing={2}>{overview.data.departments.map(department => <Grid item xs={12} md={6} key={department.id}><Card variant="outlined"><CardContent>
        <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere', mb: 1 }}>{i18n.language === 'ar' ? department.nameAr : department.nameEn}</Typography>
        <Box component="dl" sx={{ m: 0 }}>{(['total', 'available', 'occupied', 'maintenance'] as const).map(status => <Stack key={status} direction="row" justifyContent="space-between" gap={2}><Typography component="dt">{t(status === 'total' ? 'overview.total' : `departments.${status}`)}</Typography><Typography component="dd" sx={{ m: 0 }}>{department[status]}</Typography></Stack>)}</Box>
      </CardContent></Card></Grid>)}</Grid>
    </>}
  </Box>;
}
