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
    patient: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data })),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn(),
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
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
});
