import { validationOptions } from '../../src/validation-options';
import { ValidationPipe } from '@nestjs/common';
import { CreatePatientDto } from '../../src/modules/patients/dto/create-patient.dto';
import { UpdatePatientDto } from '../../src/modules/patients/dto/update-patient.dto';
import { CreateInvoiceDto } from '../../src/modules/billing/dto/create-invoice.dto';
import { FindAppointmentsDto } from '../../src/modules/appointments/dto/find-appointments.dto';
import { SearchUsersDto } from '../../src/modules/users/dto/search-users.dto';
import { createApiDocument } from '../../src/api-documentation';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Documentation validator boundaries, no DB',()=>{
 const pipe=new ValidationPipe(validationOptions);
 const uuid='123e4567-e89b-42d3-a456-426614174000';
 const patient={fullName:'Test',dateOfBirth:'2000-01-01',gender:'male',phone:'123'};
 const item={description:'Test',quantity:1,unitPrice:0};
 const invoice={patientId:uuid,items:[item]};
 const oldJwt=process.env.JWT_SECRET;
 // The schema is the actual native builder, not a hand-authored duplicate.
 let document: ReturnType<typeof createApiDocument>;
 let schemas: ReturnType<typeof createApiDocument>['components'];
 beforeAll(async()=>{process.env.JWT_SECRET='validation-doc-only-not-real';const m=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(PrismaService).useValue({}).compile();const app=m.createNestApplication({logger:false});app.setGlobalPrefix('api/v1');document=createApiDocument(app);schemas=document.components;await app.close();});
 afterAll(()=>{if(oldJwt===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldJwt;});
 const rows=[
  ...[2,3].map(n=>({name:'fullName '+n,dto:CreatePatientDto,value:{...patient,fullName:'a'.repeat(n)},schema:'CreatePatientDto',field:'fullName',n})),
  ...[0,1,50,51].map(n=>({name:'invoice items '+n,dto:CreateInvoiceDto,value:{...invoice,items:Array.from({length:n},()=>({...item}))},schema:'CreateInvoiceDto',field:'items',n})),
  ...[0,1].map(n=>({name:'quantity '+n,dto:CreateInvoiceDto,value:{...invoice,items:[{...item,quantity:n}]},schema:'InvoiceItemInputDto',field:'quantity',n})),
  ...[100,101].map(n=>({name:'coverage '+n,dto:CreateInvoiceDto,value:{...invoice,insuranceCoveragePercent:n},schema:'CreateInvoiceDto',field:'insuranceCoveragePercent',n})),
  ...[0,1,10000,10001].map(n=>({name:'page '+n,dto:FindAppointmentsDto,value:{page:String(n)},schema:'FindAppointmentsDto',field:'page',n})),
  ...[1,2,100,101].map(n=>({name:'search '+n,dto:SearchUsersDto,value:{search:'x'.repeat(n)},schema:'SearchUsersDto',field:'search',n})),
 ];
 it.each(rows)('$name matches actual documented boundary',async row=>{
  // Search DTOs are flattened into actual query parameters, not components.
  let property: Record<string,unknown>;
  if(row.schema==='FindAppointmentsDto'||row.schema==='SearchUsersDto'){const route=row.schema==='FindAppointmentsDto'?'/api/v1/appointments':'/api/v1/users';const parameters=document.paths[route].get!.parameters as {in:string;name:string;schema:Record<string,unknown>}[];property=parameters.find(p=>p.in==='query'&&p.name===row.field)!.schema;}
  else property=(schemas!.schemas![row.schema] as {properties:Record<string,Record<string,unknown>>}).properties[row.field];
  const min=Number(property.minimum??property.minLength??property.minItems??-Infinity),max=Number(property.maximum??property.maxLength??property.maxItems??Infinity);
  const accepts=row.n>=min&&row.n<=max;
  const action=pipe.transform(row.value,{type:row.schema==='FindAppointmentsDto'||row.schema==='SearchUsersDto'?'query':'body',metatype:row.dto});
  if(accepts)await expect(action).resolves.toBeDefined();else await expect(action).rejects.toMatchObject({status:400});
 });
 it('updates retain six optional fields and reject non-nullable field nulls',async()=>{
  const s=schemas!.schemas!.UpdatePatientDto as {required?:string[];properties:Record<string,unknown>};expect(s.required).toBeUndefined();expect(Object.keys(s.properties).sort()).toEqual(['fullName','phone','nationalId','address','emergencyContactName','emergencyContactPhone'].sort());
  await expect(pipe.transform({fullName:null,phone:null},{type:'body',metatype:UpdatePatientDto})).rejects.toMatchObject({status:400});
  await expect(pipe.transform({},{type:'body',metatype:UpdatePatientDto})).resolves.toEqual({});
  await expect(pipe.transform({address:null,nationalId:null,emergencyContactName:null,emergencyContactPhone:null},{type:'body',metatype:UpdatePatientDto})).resolves.toMatchObject({address:null,nationalId:null,emergencyContactName:null,emergencyContactPhone:null});
 });
 it.each(['dateOfBirth','gender'])('protected %s patch rejects400 instead of silently stripping',async field=>{await expect(pipe.transform({[field]:field==='gender'?'male':'2000-01-01'},{type:'body',metatype:UpdatePatientDto})).rejects.toMatchObject({status:400});});
});
