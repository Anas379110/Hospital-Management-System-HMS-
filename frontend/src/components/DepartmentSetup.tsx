import { setupError } from './setupError';
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import type { Department, Bed } from '../types/departments';

type Target = { mode: 'createDepartment' | 'renameDepartment' | 'deleteDepartment' | 'createBed' | 'renameBed' | 'deleteBed' | 'maintenance'; bed?: Bed; status?: 'available' | 'maintenance' };
export default function DepartmentSetup({ department, beds, onDeleted }: { department?: Department; beds?: Bed[]; onDeleted: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [nameAr, setAr] = useState(''), [nameEn, setEn] = useState(''), [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mutation = useMutation({ mutationFn: async () => {
    if (!target) return;
    const path = '/departments' + (department ? '/' + department.id : '');
    if (target.mode === 'createDepartment') return apiClient.post('/departments', { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    if (target.mode === 'renameDepartment') return apiClient.patch(path, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    if (target.mode === 'deleteDepartment') return apiClient.delete(path);
    if (target.mode === 'createBed') return apiClient.post(path + '/beds', { bedNumber: number.trim() });
    if (target.mode === 'renameBed') return apiClient.patch(path + '/beds/' + target.bed!.id, { bedNumber: number.trim() });
    if (target.mode === 'deleteBed') return apiClient.delete(path + '/beds/' + target.bed!.id);
    return apiClient.patch(path + '/beds/' + target.bed!.id + '/maintenance', { status: target.status });
  }, retry: false });
  function open(next: Target) { setNotice(''); setTarget(next); setAr(next.mode === 'createDepartment' ? '' : department?.nameAr ?? ''); setEn(next.mode === 'createDepartment' ? '' : department?.nameEn ?? ''); setNumber(next.bed?.bedNumber ?? ''); setError(''); }
  const names = target?.mode === 'createDepartment' || target?.mode === 'renameDepartment';
  const label = target?.mode === 'createBed' || target?.mode === 'renameBed';
  async function save() {
    try {
      await mutation.mutateAsync();
      if (target?.mode === 'deleteDepartment') onDeleted();
      setTarget(null); setError('');
      await client.invalidateQueries({ queryKey: ['departments'] });
    } catch (e) {
      const failure = setupError(e);
      if (failure.close) { setNotice(t(failure.key)); setTarget(null); }
      else setError(t(failure.key));
      await client.invalidateQueries({ queryKey: ['departments'] });
    }
  }
  return <Box sx={{ mb: 3 }}>
    {notice && <Alert severity="warning" sx={{ mb: 2 }}>{notice}</Alert>}
    <Typography variant="h6" mb={1}>{t('setup.title')}</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Button onClick={() => open({ mode: 'createDepartment' })}>{t('setup.createDepartment')}</Button>
      {department && <>
        <Button onClick={() => open({ mode: 'renameDepartment' })}>{t('setup.renameDepartment')}</Button>
        <Button onClick={() => open({ mode: 'createBed' })}>{t('setup.createBed')}</Button>
        <Button color="error" onClick={() => open({ mode: 'deleteDepartment' })}>{t('setup.deleteDepartment')}</Button>
      </>}
    </Stack>
    {department && <Typography color="text.secondary">{t('setup.actualCount')} {beds?.length ?? '…'}</Typography>}
    {beds?.map(bed => <Stack key={bed.id} direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mt: 1 }}>
      <Typography sx={{ overflowWrap: 'anywhere' }}><bdi>{bed.bedNumber}</bdi> {t('departments.' + bed.status)}</Typography>
      <Button onClick={() => open({ mode: 'renameBed', bed })}>{t('setup.renameBed')}</Button>
      {bed.status !== 'occupied' && <>
        <Button onClick={() => open({ mode: 'maintenance', bed, status: bed.status === 'maintenance' ? 'available' : 'maintenance' })}>{t(bed.status === 'maintenance' ? 'setup.makeAvailable' : 'setup.makeMaintenance')}</Button>
        <Button color="error" onClick={() => open({ mode: 'deleteBed', bed })}>{t('setup.deleteBed')}</Button>
      </>}
    </Stack>)}
    <Dialog open={!!target} onClose={() => { if (!mutation.isPending) setTarget(null); }} fullWidth maxWidth="sm">
      <DialogTitle>{t(target?.mode === 'maintenance' ? target.status === 'maintenance' ? 'setup.makeMaintenance' : 'setup.makeAvailable' : 'setup.' + (target?.mode ?? 'title'))}</DialogTitle>
      <DialogContent>
        <Typography mb={2}>{t('setup.safety')}</Typography>
        {target?.bed && <Typography><bdi>{target.bed.bedNumber}</bdi></Typography>}
        {names && <><TextField autoFocus fullWidth margin="normal" label={t('setup.nameAr')} value={nameAr} inputProps={{ maxLength: 120 }} onChange={e => setAr(e.target.value)} /><TextField fullWidth margin="normal" label={t('setup.nameEn')} value={nameEn} inputProps={{ maxLength: 120 }} onChange={e => setEn(e.target.value)} /></>}
        {label && <TextField autoFocus fullWidth margin="normal" label={t('setup.bedNumber')} value={number} inputProps={{ maxLength: 40 }} onChange={e => setNumber(e.target.value)} />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={() => setTarget(null)}>{t('departments.cancel')}</Button><Button variant="contained" disabled={mutation.isPending || !!(names && (!nameAr.trim() || !nameEn.trim())) || !!(label && !number.trim())} onClick={() => void save()}>{t('setup.confirm')}</Button></DialogActions>
    </Dialog>
  </Box>;
}
