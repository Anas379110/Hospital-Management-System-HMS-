import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Billing (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const txMock = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn() },
  };

  const prismaMock = {
    invoice: { create: jest.fn(), findUnique: jest.fn() },
    invoiceItem: { create: jest.fn() },
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

  it('POST /invoices بدور doctor (غير مخوَّل — BillingClerk/Admin فقط) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'p1', items: [{ description: 'كشف', quantity: 1, unitPrice: 5000 }] });

    expect(res.status).toBe(403);
  });

  it('POST /invoices ببنود فارغة → 400 (Validation — ArrayMinSize)', async () => {
    const token = await jwtService.signAsync({ sub: 'bc1', username: 'billing1', role: 'billing_clerk' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: 'p1', items: [] });

    expect(res.status).toBe(400);
  });

  it('POST /invoices/{id}/payments بمبلغ يتجاوز المتبقي → 409', async () => {
    txMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      insuranceCoveragePercent: 0,
      items: [{ quantity: 1, unitPrice: 1000 }],
      payments: [],
    });
    const token = await jwtService.signAsync({ sub: 'bc1', username: 'billing1', role: 'billing_clerk' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices/inv-1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000, method: 'cash' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_REMAINING');
  });

  it('POST /invoices/{id}/payments بطريقة دفع غير صالحة → 400', async () => {
    const token = await jwtService.signAsync({ sub: 'bc1', username: 'billing1', role: 'billing_clerk' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices/inv-1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, method: 'bitcoin' }); // خارج enum PaymentMethod

    expect(res.status).toBe(400);
  });
});
