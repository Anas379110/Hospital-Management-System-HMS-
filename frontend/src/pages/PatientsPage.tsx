import { useState } from 'react';
import {
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
import { usePatientsSearch } from '../hooks/usePatients';

export default function PatientsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data: patients, isLoading } = usePatientsSearch(search);

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          {t('patients.title')}
        </Typography>
        <Button component={RouterLink} to="/patients/new" variant="contained">
          {t('nav.newPatient')}
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder={t('patients.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
      />

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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('patients.mrn')}</TableCell>
                <TableCell>{t('patients.fullName')}</TableCell>
                <TableCell>{t('patients.phone')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id} hover component={RouterLink} to={`/patients/${p.id}`} sx={{ cursor: 'pointer', textDecoration: 'none' }}>
                  <TableCell>{p.mrn}</TableCell>
                  <TableCell>{p.fullName}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
