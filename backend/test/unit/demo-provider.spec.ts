import { qualificationGate } from '../../src/common/qualification-gate';
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
  process.env.HMS_PUBLIC_DEMO='true';const response={setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()};const e=Object.assign(new Error(code === 'P2028' ? 'Transaction API error: Unable to start a transaction in the given time.' : 'private driver diagnostics'),{code});new AllExceptionsFilter().catch(e,{switchToHttp:()=>({getResponse:()=>response})} as never);expect(response.status).toHaveBeenCalledWith(503);expect(response.setHeader).toHaveBeenCalledWith('Retry-After','5');expect(response.json).toHaveBeenCalledWith({error:{code:'DEMO_BUSY',message:'Demo is busy. Try again shortly.',details:[]}});
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

it.each(['Transaction API error: Transaction already closed: A commit cannot be executed on an expired transaction.', 'Transaction API error: Transaction not found.', 'private uncertain commit failure'])('does not claim a possibly executed P2028 is safe to retry: %s',message=>{
 process.env.HMS_PUBLIC_DEMO='true';const response={setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()};new AllExceptionsFilter().catch(Object.assign(new Error(message),{code:'P2028'}),{switchToHttp:()=>({getResponse:()=>response})} as never);expect(response.status).toHaveBeenCalledWith(500);expect(response.json).toHaveBeenCalledWith(expect.objectContaining({error:expect.objectContaining({code:'INTERNAL_ERROR'})}));
});

it('qualification gate fails closed and protects bootstrap without interfering with bearer auth',()=>{
 const old={...process.env};try{
 process.env.HMS_QUALIFICATION_MODE='true';process.env.HMS_PUBLIC_DEMO='true';delete process.env.HMS_QUALIFICATION_SECRET;
 expect(()=>qualificationGate()).toThrow('requires demo');process.env.HMS_QUALIFICATION_SECRET='a'.repeat(40);const gate=qualificationGate();
 const response={status:jest.fn().mockReturnThis(),json:jest.fn()},next=jest.fn();
 gate({path:'/api/v1/demo/start',method:'POST',get:()=>undefined} as never,response as never,next);expect(response.status).toHaveBeenCalledWith(401);expect(next).not.toHaveBeenCalled();
 gate({path:'/api/v1/invoices',method:'POST',get:(h:string)=>h==='X-HMS-Qualification'?'a'.repeat(40):'Bearer session'} as never,response as never,next);expect(next).toHaveBeenCalledTimes(1);
 gate({path:'/api/v1/health',method:'GET'} as never,response as never,next);expect(next).toHaveBeenCalledTimes(2);
 }finally{process.env=old}
});
