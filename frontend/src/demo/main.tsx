import i18next from 'i18next';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import { Alert, AppBar, Box, Button, Container, CssBaseline, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, ThemeProvider, Toolbar, Typography } from '@mui/material';
import { createAppTheme, createDirectionalCache } from '../theme/direction';
import { loadDemo, type DemoCatalog, type ModuleId } from './client';
import { labels, messages, type MessageKey } from './messages';

const demoI18n = i18next.createInstance();
void demoI18n.init({ resources: { ar: { translation: messages.ar }, en: { translation: messages.en } }, lng: 'ar', fallbackLng: 'en', initImmediate: false, interpolation: { escapeValue: false } });
const themes = { ar: createAppTheme('rtl'), en: createAppTheme('ltr') };
const caches = { ar: createDirectionalCache('rtl'), en: createDirectionalCache('ltr') };
function Showcase() {
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [catalog, setCatalog] = useState<DemoCatalog | null>(null);
  const [selected, setSelected] = useState<ModuleId>('patients');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const pending = useRef<AbortController | null>(null);
  const { t } = useTranslation();
  useEffect(() => { document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = locale; void demoI18n.changeLanguage(locale); }, [locale]);
  useEffect(() => { document.title = t('title'); }, [t]);
  useEffect(() => () => pending.current?.abort(), []);
  async function open() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller; setStatus('loading');
    try { setCatalog(await loadDemo(controller.signal)); setStatus('success'); }
    catch { if (!controller.signal.aborted) setStatus('error'); }
    finally { pending.current = null; }
  }
  const rows = catalog?.modules.find((module) => module.id === selected)?.records ?? [];
  return <CacheProvider value={caches[locale]}><ThemeProvider theme={themes[locale]}><CssBaseline />
    <AppBar position="static"><Toolbar sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><Typography component="h1" variant="h6">{t('title')}</Typography><Button color="inherit" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{t('switchLanguage')}</Button></Toolbar></AppBar>
    <Container maxWidth="lg" sx={{ py: 3 }}><Stack spacing={3}>
      <Alert severity="warning"><Typography fontWeight={700}>{t('warning')}</Typography>{t('boundary')}</Alert>
      <Typography>{t('snapshot')}</Typography>
      {status !== 'success' && <Button variant="contained" disabled={status === 'loading'} onClick={open}>{status === 'loading' ? t('loading') : t('open')}</Button>}
      {status === 'error' && <Alert severity="error">{t('error')}</Alert>}
      {catalog && <><Box component="nav" aria-label={t('title')} display="flex" flexWrap="wrap" gap={1}>{catalog.modules.map((module) => <Button key={module.id} variant={selected === module.id ? 'contained' : 'outlined'} aria-pressed={selected === module.id} onClick={() => setSelected(module.id)}>{t(module.id)}</Button>)}</Box>
      <Typography component="h2" variant="h5">{t(selected)}</Typography>
      {rows.length === 0 ? <Alert severity="info">{t('empty')}</Alert> : <Paper sx={{ overflowX: 'auto' }}><Table size="small" aria-label={t(selected)}><TableHead><TableRow><TableCell>{t('id')}</TableCell><TableCell>{t('record')}</TableCell><TableCell>{t('state')}</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><bdi>{row.id}</bdi></TableCell><TableCell>{labels[row.id] ? t(labels[row.id]) : row.label}</TableCell><TableCell>{Object.prototype.hasOwnProperty.call(messages.en, row.state) ? t(row.state as MessageKey) : row.state}</TableCell></TableRow>)}</TableBody></Table></Paper>}</>}
    </Stack></Container>
  </ThemeProvider></CacheProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><I18nextProvider i18n={demoI18n}><Showcase /></I18nextProvider></StrictMode>);
