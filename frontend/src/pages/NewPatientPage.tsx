import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema } from '../lib/patientForm';
import {
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreatePatient, type CreatePatientInput } from '../hooks/usePatients';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';

export default function NewPatientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const submitting = useRef(false);

  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [pendingInput, setPendingInput] = useState<CreatePatientInput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: { fullName: '', dateOfBirth: '', gender: 'male', phone: '', nationalId: '', address: '' },
  });

  async function submit(input: CreatePatientInput, force = false) {
    if (submitting.current) return;
    submitting.current = true;
    setErrorMessage(null);
    try {
      const patient = await createPatient.mutateAsync({ input, force });
      navigate(`/patients?highlight=${patient.mrn}`);
    } catch (err) {
      // FR-2.5: تنبيه لا حجب — نعرض للموظف خيار المتابعة
      if (getApiErrorCode(err) === 'POSSIBLE_DUPLICATE_PATIENT') {
        setPendingInput(input);
        setDuplicateWarning(true);
        return;
      }
      setErrorMessage(getApiErrorMessage(err, t('errors.generic')));
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Paper sx={{ p: 4, maxWidth: 560, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" mb={3} fontWeight={700}>
        {t('nav.newPatient')}
      </Typography>

      <form aria-busy={createPatient.isPending} onSubmit={handleSubmit((data) => submit(data))}>
        <Controller
          name="fullName"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              margin="normal"
              label={t('patients.fullName')}
              error={!!errors.fullName}
              helperText={errors.fullName ? t('patients.nameInvalid') : undefined}
            />
          )}
        />
        <Controller
          name="dateOfBirth"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              margin="normal"
              type="date"
              label={t('patients.dateOfBirth')}
              InputLabelProps={{ shrink: true }}
              error={!!errors.dateOfBirth}
              helperText={errors.dateOfBirth ? t('patients.dateInvalid') : undefined}
            />
          )}
        />
        <Controller
          name="gender"
          control={control}
          render={({ field }) => (
            <TextField {...field} select fullWidth margin="normal" label={t('patients.gender')}>
              <MenuItem value="male">{t('patients.genderMale')}</MenuItem>
              <MenuItem value="female">{t('patients.genderFemale')}</MenuItem>
            </TextField>
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              margin="normal"
              label={t('patients.phone')}
              error={!!errors.phone}
              helperText={errors.phone ? t('patients.phoneInvalid') : undefined}
            />
          )}
        />
        <Controller
          name="nationalId"
          control={control}
          render={({ field }) => (
            <TextField {...field} fullWidth margin="normal" label={t('patients.nationalId')} />
          )}
        />
        <Controller
          name="address"
          control={control}
          render={({ field }) => (
            <TextField {...field} fullWidth margin="normal" label={t('patients.address')} />
          )}
        />

        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <Button disabled={createPatient.isPending} type="submit" variant="contained" size="large" sx={{ mt: 3 }} fullWidth>
          {t('patients.save')}
        </Button>
      </form>

      {/* FR-2.5: تنبيه تكرار محتمل — لا يحجب، يمنح الموظف قرار المتابعة */}
      <Dialog open={duplicateWarning} onClose={() => setDuplicateWarning(false)}>
        <DialogTitle>{t('patients.duplicateWarning')}</DialogTitle>
        <DialogContent>
          <Typography>{t('patients.duplicateBody')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateWarning(false)}>{t('patients.duplicateCancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setDuplicateWarning(false);
              if (pendingInput) submit(pendingInput, true);
            }}
          >
            {t('patients.duplicateContinue')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
