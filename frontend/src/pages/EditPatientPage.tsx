import type { QueryObserverResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { usePatientForEditing, useUpdatePatient } from '../hooks/usePatients';
import type { Patient } from '../types/api';
import { getApiErrorCode, getApiErrorMessage, isUnknownWriteOutcome } from '../api/client';
import { editablePatientFields, patientDraft, patientPatch, patientPatchValid, type PatientDraft } from './patientEdit';

function EditForm({ patient, refresh }: { patient: Patient; refresh: () => Promise<QueryObserverResult<Patient>> }) {
  const { t } = useTranslation();
  const mutation = useUpdatePatient(patient.id);
  const [baseline, setBaseline] = useState(patient);
  const [draft, setDraft] = useState<PatientDraft>(() => patientDraft(patient));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lockKey = 'hms_patient_edit_unknown:' + patient.id;
  const [held, setHeld] = useState(() => sessionStorage.getItem(lockKey) === 'true');
  const [checking, setChecking] = useState(false);
  const patch = patientPatch(baseline, draft);
  const changed = Object.keys(patch).length > 0;
  const valid = patientPatchValid(patch);
  const labels = { fullName: t('patients.fullName'), phone: t('patients.phone'), nationalId: t('patients.nationalId'), address: t('patients.address'), emergencyContactName: t('patientEdit.emergencyName'), emergencyContactPhone: t('patientEdit.emergencyPhone') };
  async function save() {
    if (!changed || !valid || held || mutation.isPending) return;
    setError(null); setSaved(false);
    try {
      const updated = await mutation.mutateAsync(patch);
      setBaseline(updated); setDraft(patientDraft(updated)); setSaved(true);
    } catch (failure) {
      if (isUnknownWriteOutcome(failure)) { sessionStorage.setItem(lockKey, 'true'); setHeld(true); }
      setError(getApiErrorCode(failure) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(failure, t('errors.generic')));
    }
  }
  async function reconcile() {
    setChecking(true); setError(null);
    try {
      // Explicitly discard the old draft after operator reconciliation. No resubmit.
      const result = await refresh();
      if (result.isSuccess && result.data) {
        const current = result.data;
        setBaseline(current); setDraft(patientDraft(current)); sessionStorage.removeItem(lockKey); setHeld(false);
      } else setError(t('errors.generic'));
    } catch { setError(t('errors.generic')); }
    finally { setChecking(false); }
  }
  return <Box component="form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <Typography variant="h6" component="h1">{t('patientEdit.title')}</Typography>
    <Typography sx={{ mt: 1, mb: 2 }}>{patient.fullName} ({patient.mrn})</Typography>
    <Alert severity="info" icon={false}>{t('patientEdit.fixedFields')}</Alert>
    {saved && <Alert severity="success" role="status" sx={{ mt: 2 }}>{t('patientEdit.saved')}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {held && <Alert severity="warning" sx={{ mt: 2 }}>{t('patientEdit.unknown')}<Button disabled={checking} onClick={() => void reconcile()}>{t('patientEdit.checked')}</Button></Alert>}
    <Stack gap={2} sx={{ mt: 3 }}>
      {editablePatientFields.map(field => <TextField key={field} id={'patient-edit-' + field} label={labels[field]} value={draft[field]} disabled={held || mutation.isPending || checking} fullWidth onChange={event => { setDraft(previous => ({ ...previous, [field]: event.target.value })); setSaved(false); }} error={field === 'fullName' && !valid} helperText={field === 'fullName' && !valid ? t('patients.invalidName') : undefined} />)}
      <Stack direction="row" gap={2} flexWrap="wrap">
        <Button type="submit" variant="contained" disabled={!changed || !valid || held || mutation.isPending || checking}>{mutation.isPending ? t('patientEdit.saving') : t('patients.save')}</Button>
        <Button component={Link} to="/patients" disabled={mutation.isPending || checking}>{t('patientEdit.cancel')}</Button>
      </Stack>
    </Stack>
  </Box>;
}

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const query = usePatientForEditing(id);
  return <Paper sx={{ p: { xs: 2, sm: 4 }, maxWidth: 640, mx: 'auto', my: 3 }}>
    {!query.isFetchedAfterMount || query.isLoading ? <CircularProgress aria-label={t('patientEdit.loading')} /> : !query.data ? <Alert severity="error" action={<Button onClick={() => void query.refetch()}>{t('patients.retry')}</Button>}>{t('patientEdit.loadError')}</Alert> : <EditForm key={query.data.id} patient={query.data} refresh={() => query.refetch()} />}
    {(!query.data) && <Button component={Link} to="/patients" sx={{ mt: 2 }}>{t('patientEdit.cancel')}</Button>}
  </Paper>;
}
