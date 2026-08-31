import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prismaMock = {
    appointment: {
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'appt-1', ...data })),
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const validAppt = {
    patientId: 'p1',
    doctorId: 'doc1',
    departmentId: 'dept1',
    scheduledAt: '2026-09-01T10:00:00.000Z',
  };

  it('POST /appointments بلا Token → 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/appointments').send(validAppt);
    expect(res.status).toBe(401);
  });

  it('POST /appointments بدور doctor (غير مخوَّل للحجز) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(validAppt);

    expect(res.status).toBe(403);
  });

  it('POST /appointments بدور receptionist وبلا تعارض → 201', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    const token = await jwtService.signAsync({ sub: 'u2', username: 'rec1', role: 'receptionist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(validAppt);

    expect(res.status).toBe(201);
  });

  it('POST /appointments عند تعارض → 409', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: 'existing-appt' });
    const token = await jwtService.signAsync({ sub: 'u2', username: 'rec1', role: 'receptionist' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(validAppt);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_CONFLICT');
  });
});
