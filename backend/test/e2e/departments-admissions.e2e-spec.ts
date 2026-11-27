import { withCurrentSessions } from '../helpers/current-session-fixture';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Departments & Admissions (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const txMock = {
    patient: { findUnique: jest.fn().mockResolvedValue({ id: "patient-1" }) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "u3", role: "nurse", isActive: true }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    bed: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    admission: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };

  const prismaMock = {
    department: { findMany: jest.fn(), findUnique: jest.fn() },
    bed: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-e2e-only';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(withCurrentSessions(prismaMock, {"u1": "nurse", "u2": "manager", "u3": "nurse"}))
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

  it('GET /departments/{id}/beds/summary بدور nurse (غير مخوَّل — Manager/Admin فقط) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'n1', role: 'nurse' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/departments/00000000-0000-4000-a000-000000000001/beds/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /departments/{id}/beds/summary بدور manager → 200', async () => {
    prismaMock.department.findUnique.mockResolvedValue({ id: '00000000-0000-4000-a000-000000000001' });
    prismaMock.bed.findMany.mockResolvedValue([{ status: 'available' }, { status: 'occupied' }]);
    const token = await jwtService.signAsync({ sub: 'u2', username: 'mgr1', role: 'manager' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/departments/00000000-0000-4000-a000-000000000001/beds/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 2, available: 1, occupied: 1, maintenance: 0 });
  });

  it('POST /admissions على سرير مشغول (UC-1 Alternative Flow) → 409', async () => {
    txMock.bed.findUnique.mockResolvedValue({ id: '7f74ce8f-d350-5596-8d50-4298b0254b6c', status: 'occupied' });
    const token = await jwtService.signAsync({ sub: 'u3', username: 'nurse1', role: 'nurse' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/admissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'efb8a802-7a25-5450-b223-5e81e4ec0e19', bedId: '7f74ce8f-d350-5596-8d50-4298b0254b6c' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BED_NOT_AVAILABLE');
  });

  it('POST /admissions على سرير متاح → 201', async () => {
    txMock.bed.findUnique.mockResolvedValue({ id: 'b85f9c7d-fddf-5139-a031-8b30e589e8d7', status: 'available' });
    txMock.admission.create.mockResolvedValue({ id: 'adm-1', patientId: 'efb8a802-7a25-5450-b223-5e81e4ec0e19', bedId: 'b85f9c7d-fddf-5139-a031-8b30e589e8d7' });
    const token = await jwtService.signAsync({ sub: 'u3', username: 'nurse1', role: 'nurse' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/admissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'efb8a802-7a25-5450-b223-5e81e4ec0e19', bedId: 'b85f9c7d-fddf-5139-a031-8b30e589e8d7' });

    expect(res.status).toBe(201);
  });
});
