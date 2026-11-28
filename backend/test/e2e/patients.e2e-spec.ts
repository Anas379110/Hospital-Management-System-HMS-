import { validationOptions } from '../../src/validation-options';
import { withCurrentSessions } from '../helpers/current-session-fixture';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

/**
 * اختبار تكامل لوحدة Patients — يغطي RBAC (401/403) والمسار الناجح (201)
 * وحالة التعارض (409 عند تطابق محتمل). PrismaService مُموَّه بالكامل
 * (Mock) لعزل الاختبار عن قاعدة بيانات حقيقية — راجع TESTING.md.
 */
describe('Patients (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prismaMock = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([{ next: 1n }]),
    $transaction: jest.fn((callback: (tx: unknown) => unknown): unknown => callback(prismaMock)),
    patient: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'efb8a802-7a25-5450-b223-5e81e4ec0e19', ...data })),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "u1", role: "receptionist", isActive: true }),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-e2e-only';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(withCurrentSessions(prismaMock, {"u1": "doctor", "u2": "receptionist"}))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationOptions));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const validPatientPayload = {
    fullName: 'سارة يوسف',
    dateOfBirth: '1995-05-05',
    gender: 'female',
    phone: '0988888888',
  };

  it('POST /patients بلا Token → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .send(validPatientPayload);

    expect(res.status).toBe(401);
  });

  it('POST /patients بدور غير مخوَّل (doctor) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'dr1', role: 'doctor' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatientPayload);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('POST /patients بدور مخوَّل (receptionist) وبيانات صحيحة → 201 مع MRN', async () => {
    const token = await jwtService.signAsync({ sub: 'u2', username: 'rec1', role: 'receptionist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatientPayload);

    expect(res.status).toBe(201);
    expect(res.body.mrn).toBe('HMS-000001');
  });

  it('POST /patients ببيانات ناقصة → 400 بصيغة الخطأ الموحدة', async () => {
    const token = await jwtService.signAsync({ sub: 'u2', username: 'rec1', role: 'receptionist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'ب' }); // بيانات ناقصة وغير صالحة

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /patients عند وجود تطابق محتمل → 409', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({ id: 'existing', mrn: 'HMS-000002' });
    const token = await jwtService.signAsync({ sub: 'u2', username: 'rec1', role: 'receptionist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validPatientPayload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('POSSIBLE_DUPLICATE_PATIENT');
  });

  it.each([{fullName:null},{phone:null},{fullName:null,phone:null}])('PATCH invalid null %j rejects400 before transaction/actor/patient work',async body=>{
    jest.clearAllMocks();
    const token=await jwtService.signAsync({sub:'u2',username:'rec1',role:'receptionist'});
    const res=await request(app.getHttpServer()).patch('/api/v1/patients/123e4567-e89b-42d3-a456-426614174000').set('Authorization',`Bearer ${token}`).send(body);
    expect(res.status).toBe(400);expect(res.body.error.code).toBe('BAD_REQUEST');
    for(const mock of [prismaMock.$transaction,prismaMock.$queryRaw,prismaMock.user.findUnique,prismaMock.patient.findUnique,prismaMock.patient.update,prismaMock.auditLog.create])expect(mock).not.toHaveBeenCalled();
  });
  it('PATCH omitted fullName/phone keeps them absent from write DTO while nullable address clears',async()=>{
    jest.clearAllMocks();
    const before={id:'123e4567-e89b-42d3-a456-426614174000',fullName:'Existing Name',phone:'123',address:'Old'};
    prismaMock.patient.findUnique.mockResolvedValueOnce(before);
    prismaMock.patient.update.mockResolvedValueOnce({...before,address:null});
    const token=await jwtService.signAsync({sub:'u2',username:'rec1',role:'receptionist'});
    const res=await request(app.getHttpServer()).patch('/api/v1/patients/'+before.id).set('Authorization',`Bearer ${token}`).send({address:null});
    expect(res.status).toBe(200);expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.patient.update).toHaveBeenCalledWith({where:{id:before.id},data:{address:null}});
    expect(res.body.fullName).toBe(before.fullName);expect(res.body.phone).toBe(before.phone);
  });
});
