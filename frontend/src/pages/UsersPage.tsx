import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useCreateUser, useSetUserStatus, useUsers, type ManagedUser } from '../hooks/useUsers';
import { allRoles } from '../auth/permissions';
import type { Role } from '../types/api';
import { getApiErrorCode, getApiErrorMessage } from '../api/client';

export default function UsersPage() {
  const { t } = useTranslation(); const { user } = useAuth();
  const [search, setSearch] = useState(''); const users = useUsers(search.trim());
  const [username, setUsername] = useState(''); const [fullName, setFullName] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<Role>('receptionist');
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null); const [target, setTarget] = useState<ManagedUser | null>(null);
  const create = useCreateUser(); const status = useSetUserStatus(); const pending = create.isPending || status.isPending;
  const message = (error: unknown) => {
    const code = getApiErrorCode(error);
    if (code === 'AUDIT_PERSISTENCE_FAILED') return t('departments.auditFailure');
    if (code === 'ADMIN_LOCKOUT_PREVENTED') return t('users.lockout');
    if (code === 'USERNAME_TAKEN') return t('users.taken');
    return getApiErrorMessage(error, t('errors.generic'));
  };
  async function save() {
    setError(null); setSuccess(null);
    try { const saved = await create.mutateAsync({ username: username.trim(), fullName: fullName.trim(), password, role }); setPassword(''); setSearch(saved.username); setSuccess(t('users.created')); }
    catch (error) { setPassword(''); setError(message(error)); }
    finally { create.reset(); }
  }
  async function setActive() {
    if (!target) return; setError(null); setSuccess(null);
    try { await status.mutateAsync({ id: target.id, isActive: !target.isActive }); setTarget(null); setSuccess(t('users.updated')); }
    catch (error) { setTarget(null); setError(message(error)); }
  }
  return <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 800, mx: 'auto' }}>
    <Typography component="h1" variant="h5" mb={2}>{t('users.title')}</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>{t('users.demoOnly')}</Alert>
    <Card sx={{ mb: 3 }}><CardContent><Typography variant="h6">{t('users.create')}</Typography>
      <Stack component="form" gap={2} mt={2} onSubmit={event => { event.preventDefault(); void save(); }}>
        <TextField label={t('users.username')} value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" />
        <TextField label={t('users.fullName')} value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="off" />
        <TextField label={t('users.password')} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" helperText={t('users.passwordHint')} />
        <TextField select label={t('users.role')} value={role} onChange={event => setRole(event.target.value as Role)}>{allRoles.map(value => <MenuItem key={value} value={value}>{t(`roles.${value}`)}</MenuItem>)}</TextField>
        <Button type="submit" variant="contained" disabled={pending || username.trim().length < 3 || fullName.trim().length < 1 || password.length < 8 || new TextEncoder().encode(password).length > 72 || username.trim().length > 100 || fullName.trim().length > 200}>{t('users.create')}</Button>
      </Stack>
    </CardContent></Card>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{success && <Alert severity="success" role="status" sx={{ mb: 2 }}>{success}</Alert>}
    <TextField fullWidth label={t('users.search')} value={search} inputProps={{ maxLength: 100 }} onChange={event => setSearch(event.target.value)} />
    {search.length < 2 && <Typography mt={2}>{t('users.searchHint')}</Typography>}
    {users.isFetching && <Typography role="status">{t('users.loading')}</Typography>}
    {users.isError && <Alert severity="error" action={<Button onClick={() => void users.refetch()}>{t('billing.retry')}</Button>}>{message(users.error)}</Alert>}
    {users.data?.length === 0 && <Typography mt={2}>{t('users.empty')}</Typography>}
    {users.data?.length === 50 && <Alert severity="info">{t('users.limit')}</Alert>}
    <Stack gap={2} mt={2}>{users.data?.map(account => <Card key={account.id} component="section" aria-label={account.username}><CardContent>
      <Typography fontWeight={700}><bdi>{account.username}</bdi></Typography><Typography>{account.fullName}</Typography><Typography>{t(`roles.${account.role}`)} {t(account.isActive ? 'users.active' : 'users.inactive')}</Typography>
      <Button disabled={pending || account.id === user?.userId} onClick={() => setTarget(account)}>{t(account.isActive ? 'users.disable' : 'users.enable')}</Button>
      {account.id === user?.userId && <Typography variant="caption">{t('users.self')}</Typography>}
    </CardContent></Card>)}</Stack>
    <Dialog open={!!target} onClose={() => { if (!pending) setTarget(null); }}><DialogTitle>{t(target?.isActive ? 'users.disable' : 'users.enable')}</DialogTitle><DialogContent><Typography><bdi>{target?.username}</bdi></Typography><Typography>{target?.fullName}</Typography><Typography>{t('users.confirmHint')}</Typography></DialogContent><DialogActions><Button disabled={pending} onClick={() => setTarget(null)}>{t('users.cancel')}</Button><Button variant="contained" disabled={pending} onClick={() => void setActive()}>{t('users.confirm')}</Button></DialogActions></Dialog>
  </Box>;
}
