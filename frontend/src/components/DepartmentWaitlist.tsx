import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useWaitlist, useWaitlistWrite, type WaitlistItem } from '../hooks/useWaitlist';
import { usePatientsSearch } from '../hooks/usePatients';
import { getApiErrorCode, getApiErrorMessage, isUnknownWriteOutcome } from '../api/client';
import type { Patient } from '../types/api';
import ReadFreshness from './ReadFreshness';
export default function DepartmentWaitlist({ departmentId, departmentName, noAvailableBeds }: { departmentId: string; departmentName: string; noAvailableBeds: boolean }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(0);
  const queue = useWaitlist(departmentId, page), write = useWaitlistWrite(departmentId);
  const [target, setTarget] = useState<'add' | WaitlistItem | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null), [search, setSearch] = useState(''), [debounced, setDebounced] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [unknown, setUnknown] = useState<{ action: 'add' | 'cancel'; patient: string; mrn: string } | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search), 300); return () => window.clearTimeout(timer); }, [search]);
  const patients = usePatientsSearch(target === 'add' ? debounced : '');
  function open(next: typeof target) { setTarget(next); setPatient(null); setSearch(''); setDebounced(''); setError(''); }
  async function save() {
    if (!target || (target === 'add' && !patient)) return;
    setError('');
    try {
      await write.mutateAsync(target === 'add' ? { patientId: patient!.id } : { cancelId: target.id });
      setNotice(t(target === 'add' ? 'waitlist.added' : 'waitlist.cancelled')); setTarget(null);
    } catch (failure) {
      const code = getApiErrorCode(failure);
      if (isUnknownWriteOutcome(failure)) { const affected = target === 'add' ? patient! : target.patient;
        setUnknown({ action: target === 'add' ? 'add' : 'cancel', patient: affected.fullName, mrn: affected.mrn }); setNotice(''); setTarget(null); }
      else if (['WAITLIST_ALREADY_PENDING','WAITLIST_ALREADY_CLOSED','ALREADY_ADMITTED_TO_DEPARTMENT','WAITLIST_NOT_FOUND','PATIENT_NOT_FOUND','DEPARTMENT_NOT_FOUND'].includes(code ?? '')) { setTarget(null); setNotice(t('waitlist.changed')); }
      else setError(getApiErrorMessage(failure, t('errors.generic')));
    }
  }
  const items = queue.data?.items ?? [], total = queue.data?.total ?? 0;
  return <Box component="section" aria-labelledby="waitlist-title" sx={{ mt: 4 }}>
    <Divider sx={{ mb: 3 }} />
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
      <Box><Typography id="waitlist-title" variant="h6" component="h2">{t('waitlist.title')}</Typography><Typography color="text.secondary">{t('waitlist.manual')}</Typography></Box>
      <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => open('add')}>{t('waitlist.add')}</Button>
    </Stack>
    {noAvailableBeds && <Alert severity="info" sx={{ mt: 2 }}>{t('waitlist.noBeds')}</Alert>}
    <ReadFreshness reads={[queue]} />
    {unknown && <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => setUnknown(null)}>{t('waitlist.checked')}</Button>}>
      <Typography fontWeight={600}>{t(unknown.action === 'add' ? 'waitlist.add' : 'waitlist.cancel')}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{unknown.patient} <bdi>{unknown.mrn}</bdi></Typography>
      {t('errors.writeUnknown')}
    </Alert>}
    {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
    {queue.isLoading && <CircularProgress aria-label={t('patients.loading')} />}
    {queue.isError && <Alert severity="error">{t('errors.generic')}</Alert>}
    {queue.data && <Typography sx={{ mb: 2 }}>{t('waitlist.pendingCount', { count: total })}</Typography>}
    {queue.data && items.length === 0 && <Alert severity="info">{t(page === 0 ? 'waitlist.empty' : 'waitlist.emptyPage')}</Alert>}
    <Stack gap={1}>{items.map((item) => <Box key={item.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Typography fontWeight={600}>{item.patient.fullName}</Typography>
          <Typography variant="body2" color="text.secondary"><bdi>{item.patient.mrn}</bdi></Typography>
          <Typography variant="body2">{t('waitlist.pending')} {new Date(item.requestedAt).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en')}</Typography>
        </Box>
        <Button color="error" sx={{ minHeight: 44 }} onClick={() => open(item)}>{t('waitlist.cancel')}</Button>
      </Stack>
    </Box>)}</Stack>
    {queue.data && <Stack direction="row" alignItems="center" gap={2} sx={{ mt: 2 }}>
      <Button disabled={page === 0 || queue.isFetching} onClick={() => setPage(p => p - 1)}>{t('appointments.previous')}</Button>
      <Typography>{t('waitlist.page', { page: page + 1 })}</Typography>
      <Button disabled={(page + 1) * 100 >= total || queue.isFetching || page >= 10000} onClick={() => setPage(p => p + 1)}>{t('appointments.next')}</Button>
    </Stack>}
    <Dialog open={!!target} onClose={() => { if (!write.isPending) setTarget(null); }} fullWidth maxWidth="sm">
      <DialogTitle>{t(target === 'add' ? 'waitlist.add' : 'waitlist.cancel')}</DialogTitle>
      <DialogContent>
        <Typography fontWeight={600}>{departmentName}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{t(target === 'add' ? 'waitlist.addSafety' : 'waitlist.cancelSafety')}</Typography>
        {target === 'add' ? <Autocomplete options={patients.data ?? []} value={patient} onChange={(_, value) => setPatient(value)} inputValue={search} onInputChange={(_, value) => setSearch(value)} filterOptions={options => options} getOptionLabel={option => `${option.fullName} (${option.mrn})`} isOptionEqualToValue={(a,b) => a.id === b.id} loading={patients.isFetching} noOptionsText={t(search.length < 2 ? 'patients.startSearch' : 'patients.noResults')} renderInput={params => <TextField {...params} autoFocus margin="normal" label={t('patients.searchLabel')} />} /> : target && <Typography sx={{ mt: 2, overflowWrap: 'anywhere' }}>{target.patient.fullName} <bdi>{target.patient.mrn}</bdi></Typography>}
        {patients.isError && target === 'add' && <Alert severity="error">{t('errors.generic')}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={write.isPending} onClick={() => setTarget(null)}>{t(target === 'add' ? 'waitlist.dismissAdd' : 'waitlist.keep')}</Button><Button variant="contained" disabled={write.isPending || (target === 'add' && !patient)} onClick={() => void save()}>{t(write.isPending ? 'departments.saving' : target === 'add' ? 'waitlist.confirmAdd' : 'waitlist.confirmCancel')}</Button></DialogActions>
    </Dialog>
  </Box>;
}
