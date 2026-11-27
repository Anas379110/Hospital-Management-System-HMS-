import {useEffect,useState} from 'react';
import {Alert,Box,Typography,Stack,Paper} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {apiClient} from '../api/client';
interface Event {id:string;action:string;entityType:string;createdAt:string;user:{username:string;role:string}}
export default function AuditPage(){
 const {t,i18n}=useTranslation();const [rows,setRows]=useState<Event[]>([]);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;apiClient.get<Event[]>('/demo/audit').then(r=>{if(active)setRows(r.data)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[]);
 return <Box sx={{p:3}}><Typography variant="h5" component="h1">{t('nav.audit')}</Typography><Alert severity="info" sx={{my:2}}>{t('demo.auditNotice')}</Alert>{error?<Alert severity="error">{t('errors.generic')}</Alert>:<Stack gap={1}>{rows.length===0&&<Typography>{t('demo.noEvents')}</Typography>}{rows.map(row=><Paper key={row.id} variant="outlined" sx={{p:2}}><Typography><bdi>{t('audit.actions.'+row.action,{defaultValue:t('audit.unknownAction')})}</bdi></Typography><Typography><bdi>{t('audit.entities.'+row.entityType,{defaultValue:t('audit.unknownEntity')})} {row.user.username}</bdi></Typography><Typography variant="caption">{new Date(row.createdAt).toLocaleString(i18n.language)}</Typography></Paper>)}</Stack>}</Box>
}
