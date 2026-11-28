import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePatientsSearch } from '../hooks/usePatients';

export default function PatientsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data: patients, isLoading, isError, refetch } = usePatientsSearch(search);
  const { user } = useAuth();
  const canRegister = user?.role === 'admin' || user?.role === 'receptionist';

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t('patients.title')}
        </Typography>
        {canRegister && <Button component={RouterLink} to="/patients/new" variant="contained" sx={{ minHeight: 44 }}>
          {t('nav.newPatient')}
        </Button>}
      </Box>

      <TextField
        fullWidth
        label={t('patients.searchLabel')}
        placeholder={t('patients.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
      />

      {search.length < 2 && <Alert severity="info" icon={false}>{t('patients.startSearch')}</Alert>}
      {isError && <Alert severity="error" action={<Button onClick={() => void refetch()}>{t('patients.retry')}</Button>}>{t('errors.generic')}</Alert>}

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && patients && patients.length === 0 && search.length >= 2 && (
        <Typography color="text.secondary" textAlign="center" py={4}>
          {t('patients.noResults')}
        </Typography>
      )}

      {!isLoading && patients && patients.length > 0 && (
        <TableContainer component={Paper}>
          <Table sx={{ tableLayout: { xs: 'fixed', sm: 'auto' }, '& .MuiTableCell-root': { px: { xs: 1, sm: 2 }, overflowWrap: 'anywhere' }, '& .MuiButton-root': { minWidth: 0, px: { xs: 0.5, sm: 1 }, overflowWrap: 'anywhere' } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('patients.mrn')}</TableCell>
                <TableCell>{t('patients.fullName')}</TableCell>
                <TableCell>{t('patients.phone')}</TableCell>
                {canRegister && <TableCell>{t('patientEdit.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell><Button component={RouterLink} to={`/patients/${p.id}`}>{p.mrn}</Button></TableCell>
                  <TableCell><RouterLink to={`/patients/${p.id}`} style={{ color: 'inherit' }}>{p.fullName}</RouterLink></TableCell>
                  <TableCell>{p.phone}</TableCell>
                  {canRegister && <TableCell><Button component={RouterLink} to={`/patients/${p.id}/edit`} onClick={event => event.stopPropagation()}>{t('patientEdit.edit')}</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
