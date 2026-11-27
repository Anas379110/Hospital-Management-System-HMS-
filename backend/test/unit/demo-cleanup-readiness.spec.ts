import { requireCleanupReady } from '../../src/common/demo-cleanup-readiness';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
describe('cleanup readiness',()=>{
 const old={...process.env};afterEach(()=>{process.env={...old}});
 it.each([{rows:[]},{rows:[{ready:false}]},{rows:[{ready:null}]}])('fails closed for absent or false state',async ({rows})=>{
  await expect(requireCleanupReady(async()=>rows as unknown as {ready:boolean}[])).rejects.toMatchObject({status:503});
 });
 it('fails closed without leaking driver details',async()=>{await expect(requireCleanupReady(async()=>{throw Error('private database info')})).rejects.toMatchObject({response:{error:{code:'DEMO_CLEANUP_PENDING'}}});});
 it('allows only explicit readiness',async()=>{await expect(requireCleanupReady(async()=>[{ready:true}])).resolves.toBeUndefined();});
 it('rejects existing sessions before touch or user read',async()=>{
  process.env.HMS_PUBLIC_DEMO='true';const query=jest.fn().mockResolvedValue([{ready:false}]),find=jest.fn();
  const strategy=new JwtStrategy({getOrThrow:()=> 'unit-only'} as unknown as ConfigService,{$queryRaw:query,user:{findUnique:find}} as never);
  await expect(strategy.validate({kind:'fictional-demo',workspace:'00000000-0000-4000-a000-000000000001',sub:'u',username:'u',role:'admin'})).rejects.toMatchObject({status:503});
  expect(query).toHaveBeenCalledTimes(1);expect(find).not.toHaveBeenCalled();
 });
});
