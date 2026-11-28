import { useState, useEffect, type FormEvent } from 'react';
import LocaleButton from '../components/LocaleButton';
import RetentionNotice from '../components/RetentionNotice';
import { landingPath } from '../auth/permissions';
import type { CurrentUser } from '../types/api';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorCode, getApiErrorMessage, isUnknownWriteOutcome } from '../api/client';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login, startDemo } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if(user) navigate(landingPath(user.role), { replace: true }); }, [user,navigate]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startCooldown, setStartCooldown] = useState(0);
  useEffect(() => { if (!startCooldown) return; const timer=window.setInterval(()=>setStartCooldown(value=>Math.max(0,value-1)),1000); return ()=>window.clearInterval(timer); }, [startCooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      const current = JSON.parse(localStorage.getItem('hms_user') ?? 'null') as CurrentUser | null;
      navigate(current ? landingPath(current.role) : '/patients');
    } catch (err) {
      setError(getApiErrorMessage(err, t('auth.loginError')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f7fa" sx={{p:2}}>
      <Paper elevation={3} component="main" id="entry-content" sx={{p:{xs:2,sm:4},width:'100%',maxWidth:420,minWidth:0}}>
        <Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}><LocaleButton /></Box>
        <Typography component="h1" variant="h5" mb={3} textAlign="center" fontWeight={700}>
          {t('app.title')}
        </Typography>
        <RetentionNotice />
        <Button fullWidth variant="contained" disabled={loading || startCooldown > 0} onClick={async()=>{if(loading || startCooldown > 0)return;setLoading(true);setError(null);try{await startDemo();navigate('/');}catch(err){if(getApiErrorCode(err)==='DEMO_CAPACITY_REACHED'){setError(t('demo.capacity'));}else if(isUnknownWriteOutcome(err)){setError(t('demo.startUnknown'));setStartCooldown(60);}else setError(getApiErrorMessage(err,t('errors.generic')));}finally{setLoading(false);}}}>{startCooldown > 0 ? t('demo.startCooldown',{seconds:startCooldown}) : t('demo.start')}</Button>
        {loading && import.meta.env.VITE_PUBLIC_DEMO === 'true' && <Alert severity="info" role="status" sx={{mt:2}}>{t('demo.startWaiting')}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {import.meta.env.VITE_PUBLIC_DEMO !== 'true' && <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t('auth.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            autoFocus
          />
          <TextField
            fullWidth
            type="password"
            label={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {t('auth.login')}
          </Button>
        </form>}
      </Paper>
    </Box>
  );
}
