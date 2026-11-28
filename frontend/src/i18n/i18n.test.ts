import {describe,it,expect} from 'vitest';
import {createInstance} from 'i18next';
import ar from './ar.json';
import en from './en.json';

describe('bundled translations after patched i18next migration',()=>{
 it('preserves every static Arabic/English string and placeholder interpolation',async()=>{
  const i18n=createInstance();await i18n.init({resources:{ar:{translation:ar},en:{translation:en}},lng:'ar',fallbackLng:'ar',interpolation:{escapeValue:false}});
  function leaves(value:Record<string,unknown>,prefix=''):Array<[string,string]>{return Object.entries(value).flatMap(([key,item])=>typeof item==='string'?[[prefix+key,item] as [string,string]]:leaves(item as Record<string,unknown>,prefix+key+'.'));}
  for(const [lang,dictionary] of [['ar',ar],['en',en]] as const){await i18n.changeLanguage(lang);for(const [key,value] of leaves(dictionary)){const params=Object.fromEntries([...value.matchAll(/{{(\w+)}}/g)].map(match=>[match[1],'Fictional <value> / 15']));expect(i18n.t(key,params)).toBe(value.replace(/{{\w+}}/g,'Fictional <value> / 15'));}}
  await i18n.changeLanguage('unknown');expect(i18n.t('app.title')).toBe(ar.app.title);
 });
 it('deep overwrite merge cannot corrupt inherited built-in function',async()=>{
  const original=Object.prototype.hasOwnProperty.call;
  const i18n=createInstance();await i18n.init({lng:'en',resources:{en:{translation:{}}}});
  i18n.addResourceBundle('en','translation',{hasOwnProperty:{call:'fictional-regression-value'}},true,true);
  expect(Object.prototype.hasOwnProperty.call).toBe(original);
  expect(Object.prototype.hasOwnProperty.call({safe:true},'safe')).toBe(true);
 });
});
