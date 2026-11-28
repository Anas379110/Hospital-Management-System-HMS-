import { appointmentSelection, loadEncounterAppointment } from '../api/encounterAppointment';
import { useQuery } from '@tanstack/react-query';
import { prescriptionInput } from './prescriptionDraft';
import { acknowledgePrescriptionCreate, prescriptionHeld } from '../api/prescriptionCreateWrite';
import { useQueryClient } from '@tanstack/react-query';
import { acknowledgeEncounterCreate } from '../api/encounterCreateWrite';
import { encounterWriteHeld } from '../api/encounterPending';
import { isCurrentSession, sessionEpoch } from '../api/sessionIsolation';
import { encounterInput } from './encounterDraft';
import EncounterTestOrder from '../components/EncounterTestOrder';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
  const { user } = useAuth();
  const { search } = useLocation();
  return <PatientDetailWorkspace key={(user?.userId ?? '') + ':' + id + ':' + search} />;
}

function PatientDetailWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { search } = useLocation();
  const selectedAppointment=appointmentSelection(search);
  const [appointmentUsed,setAppointmentUsed]=useState(false);
  const appointmentQuery=useQuery({queryKey:['encounter-appointment',user?.userId,id,search],queryFn:()=>loadEncounterAppointment(selectedAppointment!,id!,user!.userId),enabled:!!selectedAppointment&&!!id&&user?.role==='doctor',retry:false,staleTime:0});
  const appointmentBlocked=!!selectedAppointment&&(appointmentUsed||appointmentQuery.isFetching||appointmentQuery.isError||!appointmentQuery.data);
  const patient = usePatient(id);
  const queryClient = useQueryClient();
  const [mountedEpoch] = useState(sessionEpoch);
  const canReadClinical = ['doctor', 'nurse', 'admin'].includes(user?.role ?? '');
  const recordsQuery = usePatientRecords(id, canReadClinical);
  const { data: records, isLoading } = recordsQuery;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  function mutationError(err: unknown) { setError(getApiErrorCode(err) === 'AUDIT_PERSISTENCE_FAILED' ? t('departments.auditFailure') : getApiErrorMessage(err, t('errors.generic'))); }
  const { data: testResults } = usePatientTestResults(id, canReadClinical);
  const createEncounter = useCreateEncounter();
  const addPrescription = useAddPrescription();
  const [rxHeld, setRxHeld] = useState(() => prescriptionHeld(user?.userId ?? '', id ?? ''));
  const [rxChecking, setRxChecking] = useState(false);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const lockKey = 'hms_encounter_unknown:' + user?.userId + ':' + id;
  const [held, setHeld] = useState(() => encounterWriteHeld(user?.userId ?? '', id ?? ''));
  const [checking, setChecking] = useState(false);
  const route = useRef({ key: lockKey, generation: 0 });
  if (route.current.key !== lockKey) route.current = { key: lockKey, generation: route.current.generation + 1 };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true;return () => { mounted.current = false; }; }, []);
  const generation = route.current.generation;
  const callbackIsCurrent = () => mounted.current && isCurrentSession(mountedEpoch) && route.current.generation === generation;
  useEffect(() => { setHeld(encounterWriteHeld(user?.userId ?? '', id ?? ''));setChiefComplaint('');setDiagnosis('');setNotes('');setChecking(false);setError(null);setSuccess(null);setActiveEncounterId(null); }, [lockKey]);
  async function reconcileEncounter() {
    setChecking(true);setError(null);
    if (!id || !user) { setChecking(false);return; }
    try { await acknowledgeEncounterCreate({ userId: user.userId, patientId: id, epoch: mountedEpoch }, queryClient);if (!callbackIsCurrent()) return;setHeld(false);setChiefComplaint('');setDiagnosis('');setNotes(''); }
    catch { if (callbackIsCurrent()) setError(t('errors.generic')); } finally { if (callbackIsCurrent()) setChecking(false); }
  }
  const testTargetKey = 'hms_test_order_encounter:' + user?.userId + ':' + id;
  const [testEncounterId, setTestEncounterId] = useState<string | null>(() => sessionStorage.getItem(testTargetKey));
  useEffect(() => { setTestEncounterId(sessionStorage.getItem(testTargetKey)); }, [testTargetKey]);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');

  const isDoctor = user?.role === 'doctor';
  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';

  async function handleCreateEncounter() {
    if (!id || chiefComplaint.length < 2 || diagnosis.length < 2 || held || createEncounter.isPending || checking || appointmentBlocked) return;
    setError(null); setSuccess(null);
    try {
    const encounter = await createEncounter.mutateAsync({ targetIsCurrent:callbackIsCurrent, input: encounterInput(id, chiefComplaint, diagnosis, notes, selectedAppointment?.id), ...(selectedAppointment ? {appointmentSelection:selectedAppointment} : {}), patientId: id, userId: user?.userId ?? '', epoch: mountedEpoch });
    if (!callbackIsCurrent()) return;
    if(selectedAppointment)setAppointmentUsed(true);
    setActiveEncounterId(encounter.id); setTestEncounterId(encounter.id); sessionStorage.setItem(testTargetKey, encounter.id);
    setChiefComplaint('');
    setDiagnosis('');setNotes('');
    setSuccess(t('emr.encounterSaved'));
    } catch (err) { if (!callbackIsCurrent()) return;setHeld(encounterWriteHeld(user?.userId ?? '', id));if(selectedAppointment)void appointmentQuery.refetch();mutationError(err); }
  }

  async function reconcilePrescription() {
    if (!id || !user || rxChecking) return;setRxChecking(true);setError(null);
    try { await acknowledgePrescriptionCreate({ userId: user.userId, patientId: id, epoch: mountedEpoch }, queryClient);if (!callbackIsCurrent()) return;setRxHeld(false);setMedicationName('');setDosage('');setDuration('');setPrescriptionNotes('');setActiveEncounterId(null); }
    catch { if (callbackIsCurrent()) setError(t('errors.generic')); } finally { if (callbackIsCurrent()) setRxChecking(false); }
  }

  async function handleAddPrescription() {
    if (!id || !user || !activeEncounterId || !medicationName || !dosage || !duration || rxHeld || rxChecking || addPrescription.isPending) return;
    setError(null); setSuccess(null);
    try {
    await addPrescription.mutateAsync({ userId: user.userId, patientId: id, epoch: mountedEpoch, input: prescriptionInput(activeEncounterId, medicationName, dosage, duration, prescriptionNotes) });
    if (!callbackIsCurrent()) return;
    setMedicationName('');
    setDosage('');
    setDuration('');setPrescriptionNotes('');
    setActiveEncounterId(null);
    setSuccess(t('emr.prescriptionSaved'));
    } catch (err) { if (!callbackIsCurrent()) return;setRxHeld(prescriptionHeld(user.userId, id));mutationError(err); }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('emr.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{success}</Alert>}
      {canReadClinical && recordsQuery.isError && <Alert severity="error" action={<Button onClick={() => void recordsQuery.refetch()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}
      {patient.data && <Typography sx={{ mb: 2 }}>{patient.data.fullName} ({patient.data.mrn})</Typography>}
      {/* FR-4.1: طبيب فقط يسجل زيارة جديدة — الفحص هنا واجهي فقط، RolesGuard بالـ Backend هو الحماية الفعلية */}
      {isDoctor && patient.data && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              {t('emr.newEncounter')}
            </Typography>
            {selectedAppointment && <Box sx={{mb:2}}><Alert severity={appointmentBlocked?'warning':'info'}>{t('emr.appointmentContext')}<Typography>{selectedAppointment.id}</Typography>{appointmentQuery.data && <Typography>{new Date(appointmentQuery.data.scheduledAt).toLocaleString(locale)} | {appointmentQuery.data.patient?.fullName}</Typography>}{appointmentQuery.isFetching && <Typography>{t('emr.appointmentLoading')}</Typography>}{appointmentUsed ? <Typography>{t('emr.appointmentUsed')}</Typography> : appointmentBlocked && <Typography>{t('emr.appointmentUnavailable')}</Typography>}</Alert>{!appointmentUsed && <Button disabled={appointmentQuery.isFetching} onClick={()=>void appointmentQuery.refetch()}>{t('emr.appointmentRefresh')}</Button>}<Button component={Link} to={`/patients/${id}`}>{t('emr.standaloneVisit')}</Button></Box>}
            {held && <Alert severity="warning">{t('emr.encounterUnknown')}<Button disabled={checking} onClick={() => void reconcileEncounter()}>{t('emr.checkEncounter')}</Button></Alert>}
            <TextField
              fullWidth
              margin="normal"
              label={t('emr.complaint')}
              disabled={held || checking || createEncounter.isPending || appointmentBlocked}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('emr.diagnosis')}
              disabled={held || checking || createEncounter.isPending || appointmentBlocked}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <TextField fullWidth multiline minRows={3} margin="normal" label={t('emr.clinicalNotes')} value={notes} disabled={held || checking || createEncounter.isPending || appointmentBlocked} onChange={e => setNotes(e.target.value)} />
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={handleCreateEncounter}
              disabled={createEncounter.isPending || held || checking || appointmentBlocked || chiefComplaint.length < 2 || diagnosis.length < 2}
            >
              {t('emr.saveEncounter')}
            </Button>

            {testEncounterId && <EncounterTestOrder key={user!.userId + testEncounterId} patientId={id!} encounterId={testEncounterId} />}
            {/* بعد إنشاء الزيارة مباشرة، يمكن إضافة وصفة لها فوراً — FR-4.2 */}
            {rxHeld && <Alert severity="warning">{t('emr.prescriptionUnknown')}<Button disabled={rxChecking} onClick={() => void reconcilePrescription()}>{t('emr.checkPrescription')}</Button></Alert>}
            {activeEncounterId && (
              <Box mt={3} pt={2} borderTop="1px dashed #ccc">
                <Typography variant="subtitle2" mb={1}>
                  {t('emr.addPrescription')}
                </Typography>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  <TextField
                    label={t('emr.medication')}
                    disabled={rxHeld || rxChecking || addPrescription.isPending} value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label={t('emr.dose')}
                    disabled={rxHeld || rxChecking || addPrescription.isPending} value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label={t('emr.duration')}
                    disabled={rxHeld || rxChecking || addPrescription.isPending} value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    size="small"
                  />
                  <TextField fullWidth multiline minRows={3} label={t('emr.prescriptionNotes')} value={prescriptionNotes} onChange={e => setPrescriptionNotes(e.target.value)} disabled={rxHeld || rxChecking || addPrescription.isPending} />
                  <Button variant="outlined" disabled={rxHeld || rxChecking || addPrescription.isPending || !medicationName || !dosage || !duration} onClick={handleAddPrescription}>
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

      {canReadClinical && isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {canReadClinical && !isLoading && records && records.length === 0 && (
        <Typography color="text.secondary">{t('emr.empty')}</Typography>
      )}

      <Stack gap={2}>
        {canReadClinical && records?.map((encounter) => (
          <Card key={encounter.id} variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                {new Date(encounter.encounterDate).toLocaleDateString(locale)}
              </Typography>
              <Typography fontWeight={600}>{encounter.diagnosis}</Typography>
              <Typography color="text.secondary" mb={1}>
                {encounter.chiefComplaint}
              </Typography>
              {encounter.notes && <Box sx={{ mt: 1, mb: 2 }}><Typography variant="subtitle2">{t('emr.clinicalNotesSaved')}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{encounter.notes}</Typography></Box>}
              {encounter.prescriptions.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {encounter.prescriptions.map((rx) => (
                      <Box key={rx.id}>
                      <Chip
                        label={`${rx.medicationName} — ${rx.dosage} (${rx.duration})`}
                        size="small"
                        sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.5 } }}
                      />
                      {rx.notes && <Box sx={{ mt: 1 }}><Typography variant="subtitle2">{t('emr.prescriptionNotesSaved')}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{rx.notes}</Typography></Box>}
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* FR-7.4: نتائج المختبر/الأشعة تظهر مباشرة هنا — لا شاشة منفصلة يبحث عنها الطبيب */}
      {canReadClinical && testResults && testResults.length > 0 && (
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
