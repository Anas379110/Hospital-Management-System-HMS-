import DepartmentWaitlist from '../components/DepartmentWaitlist';
import ReadFreshness from '../components/ReadFreshness';
import DepartmentSetup from '../components/DepartmentSetup';
import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { canViewBeds, canAdmitPatient } from '../auth/permissions';
import { useDepartments, useDepartmentBeds, useAdmitPatient, useDischargePatient } from '../hooks/useDepartments';
import { usePatientsSearch } from '../hooks/usePatients';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import type { Bed } from '../types/departments';
import type { Patient } from '../types/api';

export default function DepartmentsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const bedsAllowed = !!user && canViewBeds(user.role);
  const admissionAllowed = !!user && canAdmitPatient(user.role);
  const departments = useDepartments(true);
  const [selectedDept, setSelectedDept] = useState('');
  const beds = useDepartmentBeds(bedsAllowed ? selectedDept || undefined : undefined);
  const [dialog, setDialog] = useState<{ bed: Bed; mode: 'admit' | 'discharge' } | null>(null);
  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 300); return () => window.clearTimeout(timer); }, [search]);
  const patients = usePatientsSearch(dialog?.mode === 'admit' ? debouncedSearch : '');
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const admit = useAdmitPatient();
  const discharge = useDischargePatient();
  const activeDepartment = departments.data?.find(d => d.id === selectedDept);
  const departmentName = activeDepartment ? (i18n.language === 'ar' ? activeDepartment.nameAr : activeDepartment.nameEn) : '';
  const busy = admit.isPending || discharge.isPending;

  function close() { if (!busy) { setDialog(null); setPatient(null); setSearch(''); setNotes(''); setError(null); } }
  async function submit() {
    if (!admissionAllowed || !dialog) return;
    setError(null);
    try {
      if (dialog.mode === 'admit') {
        if (!patient) return;
        await admit.mutateAsync({ patientId: patient.id, bedId: dialog.bed.id });
      } else {
        const active = dialog.bed.admissions?.[0];
        if (!active) return;
        await discharge.mutateAsync({ admissionId: active.id, dischargeNotes: notes });
      }
      setSuccess(t(dialog.mode === 'admit' ? 'departments.admitSuccess' : 'departments.dischargeSuccess'));
      setDialog(null); setPatient(null); setSearch(''); setNotes('');
    } catch (err) { setError(({ AUDIT_PERSISTENCE_FAILED: t('departments.auditFailure'), PATIENT_NOT_FOUND: t('departments.patientNotFound'), BED_STATE_CHANGED: t('departments.bedStateChanged') } as Record<string, string>)[getApiErrorCode(err) ?? ''] ?? getApiErrorMessage(err, t('errors.generic'))); }
  }

  return <Box sx={{ p: { xs: 2, sm: 4 } }}>
    <Typography variant="h5" component="h1" fontWeight={700} mb={3}>{t(bedsAllowed ? 'departments.title' : 'departments.directory')}</Typography>
    <ReadFreshness reads={bedsAllowed && selectedDept ? [departments, beds] : [departments]} />
    {success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{success}</Alert>}
    {departments.isLoading && <CircularProgress aria-label={t('patients.loading')} />}
    {departments.isError && <Alert severity="error" action={<Button disabled={!departments.freshness.active} onClick={() => void departments.freshness.refresh()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}
    {departments.data?.length === 0 && <Alert severity="info">{t('departments.empty')}</Alert>}
    {!!departments.data?.length && <TextField select fullWidth label={t('departments.choose')} value={selectedDept} onChange={e => setSelectedDept(e.target.value)} sx={{ mb: 3 }}>
      {departments.data.map(d => <MenuItem key={d.id} value={d.id}>{i18n.language === 'ar' ? d.nameAr : d.nameEn}</MenuItem>)}
    </TextField>}
    {user?.role === 'admin' && <DepartmentSetup department={activeDepartment} beds={beds.data} onDeleted={() => setSelectedDept('')} />}
    {!bedsAllowed && <Alert severity="info">{t('departments.directoryOnly')}</Alert>}
    {bedsAllowed && !selectedDept && <Alert severity="info">{t('departments.chooseHint')}</Alert>}
    {beds.isLoading && <CircularProgress aria-label={t('patients.loading')} />}
    {beds.isError && <Alert severity="error" action={<Button disabled={!beds.freshness.active} onClick={() => void beds.freshness.refresh()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}
    {beds.data?.length === 0 && <Alert severity="info">{t('departments.noBeds')}</Alert>}
    {beds.data && <>
      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
        {(['available', 'occupied', 'maintenance'] as const).map(status => <Typography key={status}>{t(`departments.${status}`)} {beds.data.filter(b => b.status === status).length}</Typography>)}
      </Stack>
      <Grid container spacing={2}>{beds.data.map(bed => <Grid item xs={12} sm={6} lg={4} key={bed.id}>
        <Card variant="outlined"><CardContent>
          <Typography variant="h6"><bdi>{bed.bedNumber}</bdi></Typography>
          <Typography color="text.secondary">{t(`departments.${bed.status}`)}</Typography>
          {bed.admissions?.[0] && <Typography sx={{ mt: 1 }}>{bed.admissions[0].patient.fullName} <bdi>{bed.admissions[0].patient.mrn}</bdi></Typography>}
          {admissionAllowed && bed.status === 'available' && <Button variant="outlined" sx={{ mt: 1, minHeight: 44, textTransform: 'none' }} onClick={() => { setError(null); setDialog({ bed, mode: 'admit' }); }}>{t('departments.admit')}</Button>}
          {admissionAllowed && bed.status === 'occupied' && bed.admissions?.[0] && <Button variant="outlined" sx={{ mt: 1, minHeight: 44, textTransform: 'none' }} onClick={() => { setError(null); setDialog({ bed, mode: 'discharge' }); }}>{t('departments.discharge')}</Button>}
        </CardContent></Card>
      </Grid>)}</Grid>
    </>}
    {admissionAllowed && selectedDept && <DepartmentWaitlist key={selectedDept} departmentId={selectedDept} departmentName={departmentName} noAvailableBeds={!!beds.data && !beds.data.some(bed => bed.status === 'available')} />}
    <Dialog open={!!dialog} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t(dialog?.mode === 'discharge' ? 'departments.discharge' : 'departments.admit')} <bdi>{dialog?.bed.bedNumber}</bdi></DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{departmentName}</Typography>
        {dialog?.mode === 'admit' ? <Autocomplete options={patients.data ?? []} value={patient} onChange={(_, value) => setPatient(value)} inputValue={search} onInputChange={(_, value) => setSearch(value)} filterOptions={options => options} getOptionLabel={option => `${option.fullName} (${option.mrn})`} isOptionEqualToValue={(a, b) => a.id === b.id} loading={patients.isFetching} noOptionsText={t(search.length < 2 ? 'patients.startSearch' : 'patients.noResults')} renderInput={params => <TextField {...params} autoFocus margin="normal" label={t('patients.searchLabel')} />} /> : <>
          <Typography variant="subtitle2">{t('departments.selectedPatient')}</Typography>
          <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{dialog?.bed.admissions?.[0]?.patient.fullName}</Typography>
          <Typography><bdi>{dialog?.bed.admissions?.[0]?.patient.mrn}</bdi></Typography>
          <TextField fullWidth multiline margin="normal" label={t('departments.notes')} helperText={t('departments.optionalNotes')} value={notes} onChange={e => setNotes(e.target.value)} />
        </>}
        {patient && dialog?.mode === 'admit' && <Box sx={{ mt: 2, overflowWrap: 'anywhere' }}><Typography variant="subtitle2">{t('departments.selectedPatient')}</Typography><Typography>{patient.fullName}</Typography><Typography variant="body2"><bdi>{patient.mrn}</bdi></Typography></Box>}
        {patients.isError && dialog?.mode === 'admit' && <Alert severity="error">{t('errors.generic')}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>{t('departments.cancel')}</Button><Button variant="contained" disabled={busy || (dialog?.mode === 'admit' && !patient)} onClick={() => void submit()}>{t(busy ? 'departments.saving' : dialog?.mode === 'discharge' ? 'departments.confirmDischarge' : 'departments.confirmAdmit')}</Button></DialogActions>
    </Dialog>
  </Box>;
}
