import {describe,it,expect,vi} from 'vitest';
vi.mock('../i18n/i18n',()=>({default:{t:(key:string)=>key}}));
import {isUnknownWriteOutcome} from './client';
describe('unknown write outcome',()=>{
 it.each([undefined,502,504,500,503])('holds missing or unconfirmed server response %s',status=>{
  expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/invoices'},...(status?{response:{status,data:{}}}:{})})).toBe(true);
 });
 it.each(['DEMO_BUSY'])('keeps known atomic-billing noncommitted error %s retryable',code=>{
  expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/invoices'},response:{status:503,data:{error:{code}}}})).toBe(false);
 });
 it.each(['AUDIT_PERSISTENCE_FAILED','DEMO_CAPACITY_REACHED'])('holds other 5xx conservatively %s',code=>{expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/elsewhere'},response:{status:503,data:{error:{code}}}})).toBe(true)});
 it('does not hold reads or validation failures',()=>{
  expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'get'}})).toBe(false);
  expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/invoices'},response:{status:400,data:{}}})).toBe(false);
 });
});

it('known cleanup rejection is not an uncertain write',()=>{
 expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/demo/start'},response:{status:503,data:{error:{code:'DEMO_CLEANUP_PENDING'}}}})).toBe(false);
 expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/invoices'},response:{status:503,data:{error:{code:'DEMO_CLEANUP_PENDING'}}}})).toBe(false);
});

it.each([undefined,500,502,503,504])('encounter creation holds network/server outcome %s',status=>{expect(isUnknownWriteOutcome({isAxiosError:true,config:{method:'post',url:'/encounters'},...(status?{response:{status,data:{error:{code:'AUDIT_PERSISTENCE_FAILED'}}}}:{})})).toBe(true)});
