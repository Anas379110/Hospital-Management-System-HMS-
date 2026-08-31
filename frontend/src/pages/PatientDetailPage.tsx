import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
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
import { usePatientTestResults } from '../hooks/useLab';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: records, isLoading } = usePatientRecords(id);
  const { data: testResults } = usePatientTestResults(id);
  const createEncounter = useCreateEncounter();
  const addPrescription = useAddPrescription();

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');

  const isDoctor = user?.role === 'doctor';
  const locale = i18n.language === 'ar' ? 'ar-SY' : 'en-US';

  async function handleCreateEncounter() {
    if (!id || !chiefComplaint || !diagnosis) return;
    const encounter = await createEncounter.mutateAsync({ patientId: id, chiefComplaint, diagnosis });
    setActiveEncounterId(encounter.id);
    setChiefComplaint('');
    setDiagnosis('');
  }

  async function handleAddPrescription() {
    if (!activeEncounterId || !medicationName || !dosage || !duration) return;
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
  }

  return (
    <Box p={4} maxWidth={760} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('patients.title')} — {t('nav.patients')}
      </Typography>

      {/* FR-4.1: طبيب فقط يسجل زيارة جديدة — الفحص هنا واجهي فقط، RolesGuard بالـ Backend هو الحماية الفعلية */}
      {isDoctor && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              تسجيل زيارة جديدة
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label="الشكوى الرئيسية"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label="التشخيص"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={handleCreateEncounter}
              disabled={createEncounter.isPending || !chiefComplaint || !diagnosis}
            >
              حفظ الزيارة
            </Button>

            {/* بعد إنشاء الزيارة مباشرة، يمكن إضافة وصفة لها فوراً — FR-4.2 */}
            {activeEncounterId && (
              <Box mt={3} pt={2} borderTop="1px dashed #ccc">
                <Typography variant="subtitle2" mb={1}>
                  إضافة وصفة طبية للزيارة المسجَّلة
                </Typography>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  <TextField
                    label="اسم الدواء"
                    value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label="الجرعة"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    size="small"
                  />
                  <TextField
                    label="المدة"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    size="small"
                  />
                  <Button variant="outlined" onClick={handleAddPrescription}>
                    إضافة
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        السجل الطبي الكامل
      </Typography>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && records && records.length === 0 && (
        <Typography color="text.secondary">لا يوجد سجل طبي سابق لهذا المريض</Typography>
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
            نتائج المختبر والأشعة
          </Typography>
          <Stack gap={2}>
            {testResults.map((tr) => (
              <Card key={tr.id} variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(tr.completedAt).toLocaleDateString(locale)}
                  </Typography>
                  <Typography fontWeight={600}>
                    {tr.testName} ({tr.testType === 'lab' ? 'مختبر' : 'أشعة'})
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
