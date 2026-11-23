import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  function toggleLocale() {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    localStorage.setItem('hms_locale', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  }

  return (
    <Box>
      <AppBar position="static" color="primary">
        <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, py: 1 }}>
          <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" minWidth={0}>
            <Typography variant="h6">{t('app.title')}</Typography>
            {user && (
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button color="inherit" component={RouterLink} to="/patients">
                  {t('nav.patients')}
                </Button>
                <Button color="inherit" component={RouterLink} to="/appointments">
                  {t('appointments.title')}
                </Button>
                <Button color="inherit" component={RouterLink} to="/departments">
                  {t('nav.departments')}
                </Button>
                <Button color="inherit" component={RouterLink} to="/pharmacy">
                  {t('nav.pharmacy')}
                </Button>
                <Button color="inherit" component={RouterLink} to="/lab">
                  {t('nav.lab')}
                </Button>
                <Button color="inherit" component={RouterLink} to="/billing">
                  {t('nav.billing')}
                </Button>
              </Box>
            )}
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            {user && <Typography variant="body2">{user.username}</Typography>}
            <Button color="inherit" onClick={toggleLocale}>
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </Button>
            {user && (
              <Button color="inherit" onClick={logout}>
                {t('auth.logout')}
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Outlet />
    </Box>
  );
}
