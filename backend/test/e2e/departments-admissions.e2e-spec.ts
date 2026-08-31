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
    bed: { findUnique: jest.fn(), update: jest.fn() },
    admission: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
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

  it('GET /departments/{id}/beds/summary بدور nurse (غير مخوَّل — Manager/Admin فقط) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'n1', role: 'nurse' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/departments/dept-1/beds/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /departments/{id}/beds/summary بدور manager → 200', async () => {
    prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prismaMock.bed.findMany.mockResolvedValue([{ status: 'available' }, { status: 'occupied' }]);
    const token = await jwtService.signAsync({ sub: 'u2', username: 'mgr1', role: 'manager' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/departments/dept-1/beds/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 2, available: 1, occupied: 1, maintenance: 0 });
  });

  it('POST /admissions على سرير مشغول (UC-1 Alternative Flow) → 409', async () => {
    txMock.bed.findUnique.mockResolvedValue({ id: 'bed-1', status: 'occupied' });
    const token = await jwtService.signAsync({ sub: 'u3', username: 'nurse1', role: 'nurse' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/admissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'p1', bedId: 'bed-1' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BED_NOT_AVAILABLE');
  });

  it('POST /admissions على سرير متاح → 201', async () => {
    txMock.bed.findUnique.mockResolvedValue({ id: 'bed-2', status: 'available' });
    txMock.admission.create.mockResolvedValue({ id: 'adm-1', patientId: 'p1', bedId: 'bed-2' });
    const token = await jwtService.signAsync({ sub: 'u3', username: 'nurse1', role: 'nurse' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/admissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'p1', bedId: 'bed-2' });

    expect(res.status).toBe(201);
  });
});
