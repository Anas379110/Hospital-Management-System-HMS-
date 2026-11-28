import { Alert, Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canAccessPage, landingPath } from '../auth/permissions';

export function RoleLanding() {
  const { user } = useAuth();
  return <Navigate to={user ? landingPath(user.role) : '/login'} replace />;
}

export default function ProtectedRoute({ page }: { page?: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  if (!user) return <Navigate to="/login" replace />;
  if (page && !canAccessPage(user.role, page)) return <Box p={3}>
    <Alert severity="warning">{t('errors.forbidden')}</Alert>
    <Button component={Link} to={landingPath(user.role)} sx={{ mt: 2, minHeight: 44 }}>{t('errors.back')}</Button>
  </Box>;
  return <Outlet />;
}
