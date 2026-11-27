import { Alert, Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
type ReadState = { dataUpdatedAt: number; isFetching: boolean; freshness: { active: boolean; online: boolean; stale: boolean; refresh: () => unknown } };
export default function ReadFreshness({ reads }: { reads: ReadState[] }) {
  const { t, i18n } = useTranslation();
  const stale = reads.some(read => read.freshness.stale), busy = reads.some(read => read.isFetching);
  const updatedAt = Math.min(...reads.map(read => read.dataUpdatedAt));
  const online = reads.every(read => read.freshness.online), active = reads.every(read => read.freshness.active);
  return <Box sx={{ mb: 2 }} data-testid="read-freshness">
    <Button variant="outlined" disabled={!active || busy} onClick={() => reads.forEach(read => { void read.freshness.refresh(); })} sx={{ minHeight: 44, mb: 1 }}>{t(busy ? 'freshness.refreshing' : 'freshness.refresh')}</Button>
    <Typography variant="body2">{t('freshness.cadence')}</Typography>
    {!!updatedAt && <Typography variant="body2">{t('freshness.updated', { time: new Date(updatedAt).toLocaleTimeString(i18n.language === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US') })}</Typography>}
    {stale && <Alert severity="warning" role="status" sx={{ mt: 1 }}>{t(!online ? 'freshness.offline' : !active ? 'freshness.hidden' : 'freshness.stale')}</Alert>}
  </Box>;
}
