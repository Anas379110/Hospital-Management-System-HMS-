import { DemoCapacityInterceptor } from '../../src/common/demo-capacity.interceptor';
import { Subject } from 'rxjs';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
describe('provider qualification guards',()=>{
 const old={...process.env};afterEach(()=>{process.env={...old}});
 it.each(['postgresql://runtime:private@remote.invalid/db','postgresql://runtime:private@remote.invalid/db?sslmode=require','postgresql://runtime:private@remote.invalid/db?sslmode=verify-full&sslcert=/not-present'])('rejects remote unsafe TLS URL before connecting',async url=>{
  process.env.HMS_PUBLIC_DEMO='true';process.env.DATABASE_URL=url;const p=new PrismaService();await expect(p.onModuleInit()).rejects.toThrow('requires verify-full');await p.$disconnect();
 });
 it.each(['P2028','P2024'])('maps pool pressure to bounded503 with no error leakage',code=>{
  process.env.HMS_PUBLIC_DEMO='true';const response={setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()};const e=Object.assign(new Error('private driver diagnostics'),{code});new AllExceptionsFilter().catch(e,{switchToHttp:()=>({getResponse:()=>response})} as never);expect(response.status).toHaveBeenCalledWith(503);expect(response.setHeader).toHaveBeenCalledWith('Retry-After','5');expect(response.json).toHaveBeenCalledWith({error:{code:'DEMO_BUSY',message:'Demo is busy. Try again shortly.',details:[]}});
 });
});

it('keeps capacity after client unsubscribe until work settles',async()=>{
 const gate=new DemoCapacityInterceptor();const work=Array.from({length:24},()=>new Subject<unknown>());
 const ctx={switchToHttp:()=>({getResponse:()=>({setHeader:jest.fn()})})} as never;
 for(const subject of work)gate.intercept(ctx,{handle:()=>subject}).subscribe().unsubscribe();
 expect(()=>gate.intercept(ctx,{handle:()=>new Subject()})).toThrow('Service Unavailable');
 work.forEach(s=>{s.next({ok:true});s.complete()});await new Promise(r=>setImmediate(r));
 const last=new Subject();const sub=gate.intercept(ctx,{handle:()=>last}).subscribe();last.next({});last.complete();sub.unsubscribe();
});
