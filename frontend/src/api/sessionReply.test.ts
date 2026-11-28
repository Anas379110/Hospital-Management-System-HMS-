import { expect, it, vi } from 'vitest';
vi.mock('../i18n/i18n',()=>({default:{t:(key:string)=>key}}));
import { apiClient } from './client';
import { clearSessionQueries } from './sessionIsolation';
it.each(['/patients?search=old','/patients/old/records','/departments/old/waitlist'])('rejects old in-flight reply after session change: %s',async url=>{
 const previous=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 let finish!:(value:unknown)=>void;
 const result=apiClient.get(url,{adapter:config=>new Promise(resolve=>{finish=()=>resolve({data:{fictional:'old'},status:200,statusText:'OK',headers:{},config})})});
 const rejected=expect(result).rejects.toMatchObject({code:'ERR_CANCELED'});await Promise.resolve();await Promise.resolve();clearSessionQueries();finish(undefined);await rejected;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});
});
