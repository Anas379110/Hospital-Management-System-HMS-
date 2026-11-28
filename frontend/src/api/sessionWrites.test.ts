import { expect, it, vi } from 'vitest';
import axios from 'axios';
vi.mock('../i18n/i18n',()=>({default:{t:(key:string)=>key}}));
import { apiClient, isUnknownWriteOutcome } from './client';
import { clearSessionQueries, responseIsCurrent } from './sessionIsolation';
it.each(['post','put','patch','delete'])('preserves stale %s successful outcome but marks cache result stale',async method=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});let finish!:()=>void;const result=apiClient.request({method,url:'/encounters',adapter:config=>new Promise(resolve=>{finish=()=>resolve({data:{id:'fictional'},status:201,statusText:'Created',headers:{},config})})});await Promise.resolve();await Promise.resolve();clearSessionQueries();finish();const reply=await result;expect(reply.status).toBe(201);expect(reply.config.method).toBe(method);expect(responseIsCurrent(reply.data)).toBe(false);
});
it.each([500,undefined,401])('preserves stale write error/classification without current-session logout %s',async status=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,removeItem:()=>{throw Error('must not logout')}}});let fail!:()=>void;const result=apiClient.post('/encounters',{}, {adapter:config=>new Promise((_resolve,reject)=>{fail=()=>reject(new axios.AxiosError('fictional',undefined,config,undefined,status?{data:{},status,statusText:'Error',headers:{},config}:undefined))})});const rejected=expect(result).rejects.toMatchObject({config:{method:'post',url:'/encounters'}});await Promise.resolve();await Promise.resolve();clearSessionQueries();fail();await rejected;await result.catch(e=>expect(isUnknownWriteOutcome(e)).toBe(status!==401));
});
