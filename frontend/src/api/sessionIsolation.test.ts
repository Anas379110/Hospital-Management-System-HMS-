import { afterEach, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { clearSessionQueries, installSessionQueryClient, isCurrentSession, sessionEpoch } from './sessionIsolation';
afterEach(() => clearSessionQueries());
it('clears patient, records and queue cache at the session boundary', () => {
 const client=new QueryClient();installSessionQueryClient(client);for(const key of [['patients','search','old'],['patients','id','records'],['waitlist','dept']])client.setQueryData(key,{secret:'fictional old'});const old=sessionEpoch();clearSessionQueries();expect(client.getQueryCache().getAll()).toHaveLength(0);expect(isCurrentSession(old)).toBe(false);expect(isCurrentSession(sessionEpoch())).toBe(true);
});
it('a cancelled prior session query cannot repopulate cache after its late resolution',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});installSessionQueryClient(client);let finish!:(value:string)=>void;const result=client.fetchQuery({queryKey:['patients','old','records'],queryFn:()=>new Promise<string>(resolve=>{finish=resolve})}).catch(()=>undefined);clearSessionQueries();finish('fictional previous notes');await result;await Promise.resolve();expect(client.getQueryCache().getAll()).toHaveLength(0);
});
