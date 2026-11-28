import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useCreateMedication } from '../hooks/usePharmacy';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import { isCurrentSession, sessionEpoch } from '../api/sessionIsolation';
import { emptyMedicationDraft, medicationCreateHeld, medicationInput, type MedicationDraft } from './medicationCreate';
import { acknowledgeMedicationCreate } from '../api/medicationCreateWrite';
import type { Medication } from '../types/pharmacy';

export default function MedicationCreate({ onCreated }: { onCreated: (medication: Medication) => void }) {
  const { user } = useAuth();
  if (!user || !['pharmacist', 'admin'].includes(user.role)) return null;
  return <MedicationCreateForm key={user.userId} userId={user.userId} onCreated={onCreated} />;
}
function MedicationCreateForm({ userId, onCreated }: { userId: string; onCreated: (medication: Medication) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MedicationDraft>({ ...emptyMedicationDraft });
  const [held, setHeld] = useState(() => medicationCreateHeld(userId));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const create = useCreateMedication();
  const queryClient = useQueryClient();
  const [mountedEpoch] = useState(sessionEpoch);
  const input = medicationInput(draft);
  const disabled = held || checking || create.isPending;
  function field(key: keyof MedicationDraft, value: string) { setDraft(previous => ({ ...previous, [key]: value }));setSuccess(false); }
  async function submit() {
    if (!input || disabled) return;
    setError(null);setSuccess(false);
    try { const result = await create.mutateAsync({ input, userId, epoch: mountedEpoch });if (!isCurrentSession(mountedEpoch)) return;setDraft({ ...emptyMedicationDraft });setSuccess(true);onCreated(result); }
    catch (failure) { if (!isCurrentSession(mountedEpoch)) return;setHeld(medicationCreateHeld(userId));setError(getApiErrorCode(failure) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(failure, t('errors.generic'))); }
  }
  async function acknowledge() {
    setChecking(true);setError(null);
    try {
      await acknowledgeMedicationCreate({ userId, epoch: mountedEpoch }, queryClient);
      if (!isCurrentSession(mountedEpoch)) return;
      setHeld(false);setDraft({ ...emptyMedicationDraft });
    } catch { if (isCurrentSession(mountedEpoch)) setError(t('errors.generic')); }
    finally { if (isCurrentSession(mountedEpoch)) setChecking(false); }
  }
  return <Card sx={{ mb: 3 }}><CardContent>
    <Typography variant="h6">{t('medicationCreate.title')}</Typography>
    <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>{t('medicationCreate.description')}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{t('medicationCreate.saved')}</Alert>}
    {held && <Alert severity="warning" sx={{ mb: 2 }}>{t('medicationCreate.unknown')}<Button disabled={checking} onClick={() => void acknowledge()}>{t('medicationCreate.checked')}</Button></Alert>}
    <form onSubmit={event => { event.preventDefault();void submit(); }}>
      <Stack gap={2}>
        <TextField label={t('medicationCreate.name')} inputProps={{ 'aria-label': t('medicationCreate.name') }} value={draft.name} disabled={disabled} onChange={event => field('name', event.target.value)} required fullWidth />
        <TextField label={t('medicationCreate.unit')} inputProps={{ 'aria-label': t('medicationCreate.unit') }} value={draft.unit} disabled={disabled} onChange={event => field('unit', event.target.value)} required fullWidth />
        <TextField label={t('medicationCreate.currentStock')} value={draft.currentStock} disabled={disabled} onChange={event => field('currentStock', event.target.value)} type="number" inputProps={{ min: 0, max: 2147483647, step: 1, 'aria-label': t('medicationCreate.currentStock') }} required fullWidth />
        <TextField label={t('medicationCreate.reorderThreshold')} value={draft.reorderThreshold} disabled={disabled} onChange={event => field('reorderThreshold', event.target.value)} type="number" inputProps={{ min: 0, max: 2147483647, step: 1 }} helperText={t('medicationCreate.defaultThreshold')} fullWidth />
        <Button type="submit" variant="contained" disabled={disabled || !input}>{t('medicationCreate.create')}</Button>
      </Stack>
    </form>
  </CardContent></Card>;
}
