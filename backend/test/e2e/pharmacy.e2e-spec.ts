import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Pharmacy (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const txMock = {
    prescription: { findUnique: jest.fn(), update: jest.fn() },
    medication: { findUnique: jest.fn(), update: jest.fn() },
  };

  const prismaMock = {
    medication: { findMany: jest.fn(), create: jest.fn() },
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

  it('GET /medications بدور doctor (غير مخوَّل — Pharmacist/Admin فقط) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/medications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('POST /prescriptions/{id}/dispense عند نقص المخزون → 409', async () => {
    txMock.prescription.findUnique.mockResolvedValue({ id: 'rx-1', status: 'pending' });
    txMock.medication.findUnique.mockResolvedValue({ id: 'med-1', currentStock: 2 });
    const token = await jwtService.signAsync({ sub: 'ph1', username: 'pharmacist1', role: 'pharmacist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/prescriptions/rx-1/dispense')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicationId: 'med-1', quantityDispensed: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('POST /prescriptions/{id}/dispense بكمية سالبة → 400 (Validation)', async () => {
    const token = await jwtService.signAsync({ sub: 'ph1', username: 'pharmacist1', role: 'pharmacist' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/prescriptions/rx-1/dispense')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicationId: 'med-1', quantityDispensed: -5 });

    expect(res.status).toBe(400);
  });
});
