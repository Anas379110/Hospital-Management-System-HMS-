import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

const describeDatabase = process.env.HMS_REAL_DB_TEST === '1' ? describe : describe.skip;
describeDatabase('Appointments with isolated real PostgreSQL, fictional fixtures only', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let doctorId: string;
  let departmentId: string;
  let patientId: string;
  const suffix = randomUUID();
  const scheduledAt = '2027-01-21T10:00:00.000Z';
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !process.env.HMS_REAL_DB_TEST) throw new Error('Explicit isolated database required');
    const database = new URL(process.env.DATABASE_URL);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) || !/^\/hms_[a-z_]*qualification$/.test(database.pathname)) {
      throw new Error('Only a loopback hms_*qualification database may receive fictional fixtures');
    }
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = module.get(PrismaService);
    const password = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({ data: { username: `fictional_admin_${suffix}`, fullName: 'Fictional test admin', role: 'admin', passwordHash } });
    const doctor = await prisma.user.create({ data: { username: `fictional_doctor_${suffix}`, fullName: 'Fictional test doctor', role: 'doctor', passwordHash } });
    doctorId = doctor.id;
    departmentId = (await prisma.department.create({ data: { nameAr: 'قسم خيالي', nameEn: 'Fictional test department', totalBeds: 0 } })).id;
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: admin.username, password }).expect(200);
    token = login.body.accessToken;
    const patient = await request(app.getHttpServer()).post('/api/v1/patients').set('Authorization', `Bearer ${token}`).send({ fullName: `Fictional patient ${suffix}`, dateOfBirth: '2000-01-01', gender: 'male', phone: 'FICTIONAL-ONLY' }).expect(201);
    patientId = patient.body.id;
  }, 30000);
  afterAll(async () => { if (app) await app.close(); });
  const appointment = () => ({ patientId, doctorId, departmentId, scheduledAt });
  it('allows exactly one simultaneous booking and maps the loser to409', async () => {
    const responses = await Promise.all([0, 1].map(() => request(app.getHttpServer()).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send(appointment())));
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect(responses.find(r => r.status === 409)?.body.error.code).toBe('APPOINTMENT_CONFLICT');
    expect(await prisma.appointment.count({ where: { doctorId, scheduledAt: new Date(scheduledAt) } })).toBe(1);
  });
  it('keeps cancelled slots reusable', async () => {
    const active = await prisma.appointment.findFirstOrThrow({ where: { doctorId, scheduledAt: new Date(scheduledAt) } });
    await request(app.getHttpServer()).post(`/api/v1/appointments/${active.id}/cancel`).set('Authorization', `Bearer ${token}`).send({ reason: 'Fictional qualification' }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send(appointment()).expect(201);
  });
  it('rejects malformed and privilege-injection payloads without new rows', async () => {
    const before = await prisma.appointment.count({ where: { doctorId } });
    await request(app.getHttpServer()).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({ ...appointment(), patientId: 'invalid' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({ ...appointment(), status: 'completed' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/appointments').send(appointment()).expect(401);
    expect(await prisma.appointment.count({ where: { doctorId } })).toBe(before);
  });
});
