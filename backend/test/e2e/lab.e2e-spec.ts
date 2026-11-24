import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Lab (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prismaMock = {
    testOrder: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'order-1', ...data })),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    encounter: {
      findUnique: jest.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000004', patientId: '10000000-0000-4000-8000-000000000001' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-e2e-only';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const validOrder = {
    patientId: '10000000-0000-4000-8000-000000000001',
    encounterId: '10000000-0000-4000-8000-000000000004',
    testType: 'lab',
    testName: 'CBC',
  };

  it('POST /test-orders بدور nurse (غير مخوَّل — Doctor فقط) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'n1', role: 'nurse' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-orders')
      .set('Authorization', `Bearer ${token}`)
      .send(validOrder);

    expect(res.status).toBe(403);
  });

  it('POST /test-orders بدور doctor → 201', async () => {
    const token = await jwtService.signAsync({ sub: '10000000-0000-4000-8000-000000000002', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-orders')
      .set('Authorization', `Bearer ${token}`)
      .send(validOrder);

    expect(res.status).toBe(201);
  });

  it('POST /test-orders/{id}/result لطلب مُعالَج مسبقاً → 409', async () => {
    prismaMock.testOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'completed' });
    const token = await jwtService.signAsync({ sub: 'tech1', username: 'labtech1', role: 'lab_tech' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/test-orders/order-1/result')
      .set('Authorization', `Bearer ${token}`)
      .send({ result: 'طبيعي' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEST_ORDER_ALREADY_PROCESSED');
  });
});
