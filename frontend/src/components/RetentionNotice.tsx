import { Alert, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
export default function RetentionNotice() {
  const {t}=useTranslation();
  return <Alert severity="info" icon={false} sx={{my:2,bgcolor:'#e6f1f3',color:'#204854'}}>
    <Typography variant="body2">{t('demo.shortNotice')}</Typography>
    <Box component="details" sx={{mt:1}}><Box component="summary" sx={{cursor:'pointer',minHeight:32,fontWeight:600}}>{t('demo.retentionDetails')}</Box><Typography variant="body2" sx={{mt:1}}>{t('demo.notice')}</Typography></Box>
  </Alert>;
}
