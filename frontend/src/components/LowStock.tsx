import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLowStock } from '../hooks/usePharmacy';
export default function LowStock() {
  const { t } = useTranslation();
  const inventory = useLowStock();
  return <Card sx={{ mb: 3 }} component="section" aria-labelledby="low-stock-title"><CardContent>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
      <Box><Typography id="low-stock-title" variant="h6">{t('lowStock.title')}</Typography><Typography variant="body2">{t('lowStock.description')}</Typography></Box>
      <Button variant="outlined" disabled={inventory.isFetching} onClick={() => void inventory.refetch()}>{t('lowStock.refresh')}</Button>
    </Stack>
    {inventory.isFetching && <Stack direction="row" gap={1} alignItems="center" role="status" sx={{ mt: 2 }}><CircularProgress size={20} /><Typography>{t('lowStock.loading')}</Typography></Stack>}
    {inventory.isError ? <Alert severity="error" sx={{ mt: 2 }}>{t('lowStock.error')}</Alert> : inventory.isSuccess && <Stack gap={2} sx={{ mt: 2 }}>
      {inventory.data.length === 0 ? <Typography>{t('lowStock.empty')}</Typography> : inventory.data.map(row => <Box key={row.id} component="article" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{row.name}</Typography>
        <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {([['unit', row.unit], ['stock', row.currentStock], ['threshold', row.reorderThreshold]] as const).map(([key, value]) => <Box key={key}><Typography component="dt" variant="body2" color="text.secondary">{t('lowStock.' + key)}</Typography><Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{value}</Typography></Box>)}
        </Box>
      </Box>)}
    </Stack>}
  </CardContent></Card>;
}
