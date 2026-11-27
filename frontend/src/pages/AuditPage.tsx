import {Link as RouterLink} from 'react-router-dom';
import {useEffect,useState} from 'react';
import {Alert,Box,Button,Typography,Stack,Paper} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {apiClient} from '../api/client';
interface Event {id:string;action:string;entityType:string;entityId:string;createdAt:string;user:{username:string;role:string}}
export default function AuditPage(){
 const {t,i18n}=useTranslation();const [rows,setRows]=useState<Event[]>([]);const [error,setError]=useState(false);const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError(false);apiClient.get<Event[]>('/demo/audit').then(r=>{if(active)setRows(r.data)}).catch(()=>{if(active)setError(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[attempt]);
 return <Box sx={{p:{xs:2,sm:3}}}><Typography variant="h5" component="h1">{t('nav.audit')}</Typography><Alert severity="info" sx={{my:2}}>{t('demo.auditNotice')}</Alert>
 {loading?<Typography role="status">{t('demo.loadingAudit')}</Typography>:error?<Alert severity="error" action={<Button color="inherit" onClick={()=>setAttempt(x=>x+1)}>{t('demo.retry')}</Button>}>{t('demo.auditError')}</Alert>:<Stack gap={1}>{rows.length===0&&<Typography>{t('demo.noEvents')}</Typography>}{rows.map(row=><Paper key={row.id} variant="outlined" sx={{p:2}}><Typography>{t('audit.actions.'+row.action,{defaultValue:t('audit.unknownAction')})}</Typography><Typography>{t('demo.entity')}: {t('audit.entities.'+row.entityType,{defaultValue:t('audit.unknownEntity')})}</Typography>{row.entityType==='Invoice'&&<Button component={RouterLink} to={'/billing?invoice='+encodeURIComponent(row.entityId)}>{t('billing.open')}: <bdi>{row.entityId}</bdi></Button>}<Typography>{t('demo.actor')}: {t('roles.'+row.user.role)}</Typography><Typography component="p" dir="ltr" sx={{overflowWrap:'anywhere'}}>{row.user.username}</Typography><Typography variant="caption" component="p">{t('demo.time')}: <time dateTime={row.createdAt}>{new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeStyle:'long'}).format(new Date(row.createdAt))}</time></Typography></Paper>)}</Stack>}</Box>
}
