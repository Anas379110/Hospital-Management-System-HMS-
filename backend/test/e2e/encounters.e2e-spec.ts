import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Encounters (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prismaMock = {
    encounter: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'enc-1', ...data })),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prescription: { create: jest.fn() },
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

  const validEncounter = { patientId: 'p1', chiefComplaint: 'صداع', diagnosis: 'شقيقة' };

  it('POST /encounters بدور nurse (غير مخوَّل) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'n1', role: 'nurse' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send(validEncounter);

    expect(res.status).toBe(403);
  });

  it('POST /encounters بدور doctor → 201', async () => {
    const token = await jwtService.signAsync({ sub: 'doc-1', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send(validEncounter);

    expect(res.status).toBe(201);
  });

  it('DELETE /encounters/{id} من طبيب آخر (ليس المالك) → 403', async () => {
    prismaMock.encounter.findUnique.mockResolvedValue({
      id: 'enc-1',
      doctorId: 'doc-owner',
      deletedAt: null,
    });
    const token = await jwtService.signAsync({ sub: 'doc-other', username: 'dr2', role: 'doctor' });

    const res = await request(app.getHttpServer())
      .delete('/api/v1/encounters/enc-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'تصحيح خطأ إدخال' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ENCOUNTER_DELETE');
  });

  it('DELETE /encounters/{id} بسبب قصير جداً → 400 (Validation)', async () => {
    const token = await jwtService.signAsync({ sub: 'doc-1', username: 'dr1', role: 'doctor' });
    const res = await request(app.getHttpServer())
      .delete('/api/v1/encounters/enc-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'قص' }); // أقل من 5 أحرف

    expect(res.status).toBe(400);
  });
});
