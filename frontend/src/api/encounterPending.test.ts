import { expect, it, beforeEach } from 'vitest';
import { beginEncounterWrite, finishEncounterWrite } from './encounterPending';
let values:Map<string,string>;
beforeEach(()=>{values=new Map();Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{setItem:(k:string,v:string)=>values.set(k,v),getItem:(k:string)=>values.get(k)??null,removeItem:(k:string)=>values.delete(k)}})});
it.each([400,409])('clears current confirmed outcome %s',status=>{const k=beginEncounterWrite('u','p');finishEncounterWrite(k,true,status);expect(values.has(k)).toBe(false)});
it.each([500,502,503,504,undefined])('retains server/network/timeout/cancel uncertainty %s',status=>{const k=beginEncounterWrite('u','p');finishEncounterWrite(k,true,status);expect(values.has(k)).toBe(true)});
it('does not clear a marker on late old-session success',()=>{const k=beginEncounterWrite('u','p');finishEncounterWrite(k,false,201);expect(values.has(k)).toBe(true)});
it('storage failure occurs before request can dispatch',async()=>{Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw Error('fictional unavailable')}}});let requests=0;async function send(){beginEncounterWrite('u','p');requests++}await expect(send()).rejects.toThrow('fictional unavailable');expect(requests).toBe(0)});
