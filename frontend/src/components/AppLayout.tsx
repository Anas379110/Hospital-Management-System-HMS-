import RetentionNotice from './RetentionNotice';
import { MenuItem, Select, Alert, Box, Button, Container, Divider, Drawer, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canAccessPage } from '../auth/permissions';

const pages = ['audit','patients', 'appointments', 'departments', 'pharmacy', 'lab', 'billing', 'users'];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout, switchDemoRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleLocale() {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    void i18n.changeLanguage(next);
    localStorage.setItem('hms_locale', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f6f8' }}>
      <Box component="a" href="#main-content" sx={{ position: 'absolute', top: -80, '&:focus': { top: 8, zIndex: 2000, bgcolor: 'white', p: 2 } }}>
        {t('app.skip')}
      </Box>
      <Box component="header" sx={{ bgcolor: 'white', borderBottom: '1px solid #dbe3e8', px: { xs: 2, md: 4 }, py: { xs: 1, md: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="nowrap">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton aria-label={t('nav.label')} onClick={() => setMenuOpen(true)} sx={{ display: { md: 'none' }, minHeight: 44, minWidth: 44 }}><MenuIcon /></IconButton>
            <Box>
            <Typography variant="overline" sx={{ display: { xs: 'none', md: 'block' }, color: '#416370', letterSpacing: '.12em' }}>{t('app.eyebrow')}</Typography>
            <Typography component="p" sx={{ fontSize: { xs: 17, md: 20 }, fontWeight: 750 }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('app.title')}</Box><Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>HMS</Box></Typography>
            </Box>
          </Box>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {user && <Box sx={{ px: 1, display: { xs: 'none', md: 'block' } }}><Typography fontWeight={650}><bdi>{user.username}</bdi></Typography></Box>}
            <Button variant="outlined" onClick={toggleLocale} sx={{ minHeight: 44, textTransform: 'none' }}>{i18n.language === 'ar' ? 'English' : 'العربية'}</Button>
            {user && localStorage.getItem('hms_demo')==='true' && <Select size="small" value={user.role} inputProps={{'aria-label':t('demo.role')}} onChange={e=>{void switchDemoRole(e.target.value).catch(()=>logout());}}>{['admin','receptionist','doctor','nurse','manager','pharmacist','lab_tech','billing_clerk'].map(role=><MenuItem key={role} value={role}>{t('roles.'+role)}</MenuItem>)}</Select>}
            {user && <Button onClick={logout} sx={{ textTransform:'none', minHeight: 44, display: { xs: 'none', md: 'inline-flex' } }}>{t('auth.logout')}</Button>}
          </Stack>
        </Stack>
      </Box>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} anchor="left">
        <Box sx={{ width: 260, p: 2 }}>
          <Typography variant="h6">{t('nav.workspace')}</Typography>
          {user && <><Typography sx={{ mt: 1 }}><bdi>{user.username}</bdi></Typography><Typography color="text.secondary">{t(`roles.${user.role}`)}</Typography></>}
          <Divider sx={{ my: 2 }} />
          {user && pages.filter(page => canAccessPage(user.role, page)).map(page => <Button fullWidth key={page} component={NavLink} to={`/${page}`} onClick={() => setMenuOpen(false)} sx={{ textTransform:'none', justifyContent: 'flex-start', minHeight: 48, '&.active': { bgcolor: '#e6f1f3' } }}>{t(page === 'departments' && user.role === 'receptionist' ? 'nav.departmentDirectory' : `nav.${page}`)}</Button>)}
          <Divider sx={{ my: 2 }} />
          <Button onClick={() => { logout(); setMenuOpen(false); }} sx={{ minHeight: 44 }}>{t('auth.logout')}</Button>
        </Box>
      </Drawer>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
        {localStorage.getItem('hms_demo')==='true'?<RetentionNotice />:<Alert severity="info">{t('app.demoNotice')}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '220px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
          {user && <Paper component="nav" aria-label={t('nav.label')} elevation={0} sx={{ display: { xs: 'none', md: 'block' }, border: '1px solid #dbe3e8', borderRadius: 3, p: 2 }}>
            <Typography variant="overline" color="text.secondary">{t('nav.workspace')}</Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, flexWrap: 'wrap', gap: .5 }}>
              {pages.filter(page => canAccessPage(user.role, page)).map(page => <Button key={page} component={NavLink} to={`/${page}`} sx={{ textTransform:'none', justifyContent: 'flex-start', minHeight: 46, borderRadius: 2, px: 2, color: '#395460', '&.active': { bgcolor: '#e6f1f3', color: '#145267', fontWeight: 750 }, '&:focus-visible': { outline: '3px solid #246d87' } }}>{t(page === 'departments' && user.role === 'receptionist' ? 'nav.departmentDirectory' : `nav.${page}`)}</Button>)}
            </Box>
          </Paper>}
          <Paper component="main" id="main-content" tabIndex={-1} elevation={0} sx={{ minWidth: 0, border: '1px solid #dbe3e8', borderRadius: 3, overflow: 'hidden', minHeight: 0 }}>
            <Outlet />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
