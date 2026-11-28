import EncounterTestOrder from '../components/EncounterTestOrder';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import {
  usePatientRecords,
  useCreateEncounter,
  useAddPrescription,
} from '../hooks/useEncounters';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';
import { usePatient } from '../hooks/usePatients';
import { usePatientTestResults } from '../hooks/useLab';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const patient = usePatient(id);
  const recordsQuery = usePatientRecords(id);
  const { data: records, isLoading } = recordsQuery;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  function mutationError(err: unknown) { setError(getApiErrorCode(err) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(err, t('errors.generic'))); }
  const { data: testResults } = usePatientTestResults(id);
  const createEncounter = useCreateEncounter();
  const addPrescription = useAddPrescription();

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const testTargetKey = 'hms_test_order_encounter:' + user?.userId + ':' + id;
  const [testEncounterId, setTestEncounterId] = useState<string | null>(() => sessionStorage.getItem(testTargetKey));
  useEffect(() => { setTestEncounterId(sessionStorage.getItem(testTargetKey)); }, [testTargetKey]);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');

  const isDoctor = user?.role === 'doctor';
  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';

  async function handleCreateEncounter() {
    if (!id || !chiefComplaint || !diagnosis) return;
    setError(null); setSuccess(null);
    try {
    const encounter = await createEncounter.mutateAsync({ patientId: id, chiefComplaint, diagnosis });
    setActiveEncounterId(encounter.id); setTestEncounterId(encounter.id); sessionStorage.setItem(testTargetKey, encounter.id);
    setChiefComplaint('');
    setDiagnosis('');
    setSuccess(t('emr.encounterSaved'));
    } catch (err) { mutationError(err); }
  }

  async function handleAddPrescription() {
    if (!activeEncounterId || !medicationName || !dosage || !duration) return;
    setError(null); setSuccess(null);
    try {
    await addPrescription.mutateAsync({
      encounterId: activeEncounterId,
      medicationName,
      dosage,
      duration,
    });
    setMedicationName('');
    setDosage('');
    setDuration('');
    setActiveEncounterId(null);
    setSuccess(t('emr.prescriptionSaved'));
    } catch (err) { mutationError(err); }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('emr.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{success}</Alert>}
      {recordsQuery.isError && <Alert severity="error" action={<Button onClick={() => void recordsQuery.refetch()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}
      {patient.data && <Typography sx={{ mb: 2 }}>{patient.data.fullName} ({patient.data.mrn})</Typography>}
      {/* FR-4.1: طبيب فقط يسجل زيارة جديدة — الفحص هنا واجهي فقط، RolesGuard بالـ Backend هو الحماية الفعلية */}
      {isDoctor && patient.data && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              {t('emr.newEncounter')}
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label={t('emr.complaint')}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('emr.diagnosis')}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={handleCreateEncounter}
              disabled={createEncounter.isPending || !chiefComplaint || !diagnosis}
            >
              {t('emr.saveEncounter')}
            </Button>

            {testEncounterId && <EncounterTestOrder key={user!.userId + testEncounterId} patientId={id!} encounterId={testEncounterId} />}
            {/* بعد إنشاء الزيارة مباشرة، يمكن إضافة وصفة لها فوراً — FR-4.2 */}
            {activeEncounterId && (
              <Box mt={3} pt={2} borderTop="1px dashed #ccc">
                <Typography variant="subtitle2" mb={1}>
                  {t('emr.addPrescription')}
                </Typography>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  <TextField
                    label={t('emr.medication')}
                    value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label={t('emr.dose')}
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label={t('emr.duration')}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    size="small"
                  />
                  <Button variant="outlined" disabled={addPrescription.isPending || !medicationName || !dosage || !duration} onClick={handleAddPrescription}>
                    {t('emr.add')}
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        {t('emr.records')}
      </Typography>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && records && records.length === 0 && (
        <Typography color="text.secondary">{t('emr.empty')}</Typography>
      )}

      <Stack gap={2}>
        {records?.map((encounter) => (
          <Card key={encounter.id} variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                {new Date(encounter.encounterDate).toLocaleDateString(locale)}
              </Typography>
              <Typography fontWeight={600}>{encounter.diagnosis}</Typography>
              <Typography color="text.secondary" mb={1}>
                {encounter.chiefComplaint}
              </Typography>
              {encounter.prescriptions.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {encounter.prescriptions.map((rx) => (
                      <Chip
                        key={rx.id}
                        label={`${rx.medicationName} — ${rx.dosage} (${rx.duration})`}
                        size="small"
                        sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.5 } }}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* FR-7.4: نتائج المختبر/الأشعة تظهر مباشرة هنا — لا شاشة منفصلة يبحث عنها الطبيب */}
      {testResults && testResults.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={600} mt={4} mb={2}>
            {t('emr.results')}
          </Typography>
          <Stack gap={2}>
            {testResults.map((tr) => (
              <Card key={tr.id} variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(tr.completedAt).toLocaleDateString(locale)}
                  </Typography>
                  <Typography fontWeight={600}>
                    {tr.testName} ({tr.testType === 'lab' ? t('emr.lab') : t('emr.radiology')})
                  </Typography>
                  <Typography>{tr.result}</Typography>
                  {tr.resultNotes && (
                    <Typography color="text.secondary" variant="body2">
                      {tr.resultNotes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
