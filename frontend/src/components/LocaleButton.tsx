import {Button} from '@mui/material';
import {useTranslation} from 'react-i18next';
export default function LocaleButton(){const {i18n}=useTranslation();return <Button variant="outlined" sx={{minHeight:44,textTransform:'none'}} onClick={()=>{const next=i18n.language==='ar'?'en':'ar';localStorage.setItem('hms_locale',next);void i18n.changeLanguage(next);}}>{i18n.language==='ar'?'English':'العربية'}</Button>}
