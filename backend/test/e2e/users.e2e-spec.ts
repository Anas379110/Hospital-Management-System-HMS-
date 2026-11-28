import { withCurrentSessions } from '../helpers/current-session-fixture';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const prismaMock = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown): unknown => callback(prismaMock)), $executeRaw: jest.fn(), $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id ? { id: where.id, isActive: true, role: "admin" } : null)),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'u-new', ...data, passwordHash: undefined }),
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-e2e-only';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(withCurrentSessions(prismaMock, {"u1": "receptionist", "admin1": "admin"}))
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

  const newUser = { username: 'newnurse', password: 'SecurePass123', fullName: 'ممرضة جديدة', role: 'nurse' };

  it('POST /users بدور receptionist (غير مخوَّل — Admin فقط، FR-1.5) → 403', async () => {
    const token = await jwtService.signAsync({ sub: 'u1', username: 'rec1', role: 'receptionist' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send(newUser);

    expect(res.status).toBe(403);
  });

  it('POST /users بدور admin → 201، بلا تسريب passwordHash بالاستجابة', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id ? { id: where.id, isActive: true, role: "admin" } : null));
    const token = await jwtService.signAsync({ sub: 'admin1', username: 'admin', role: 'admin' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send(newUser);

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('POST /users بدور غير موجود بالـ enum → 400', async () => {
    const token = await jwtService.signAsync({ sub: 'admin1', username: 'admin', role: 'admin' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...newUser, role: 'super_admin' }); // دور غير موجود بـRole enum

    expect(res.status).toBe(400);
  });
  it('GET /users enforces admin and search bounds', async () => {
    const admin = await jwtService.signAsync({ sub: 'admin1', username: 'admin', role: 'admin' });
    const rec = await jwtService.signAsync({ sub: 'u1', username: 'rec', role: 'receptionist' });
    expect((await request(app.getHttpServer()).get('/api/v1/users?search=demo').set('Authorization', `Bearer ${rec}`)).status).toBe(403);
    for (const search of ['', 'a', '   ', 'a'.repeat(101)]) expect((await request(app.getHttpServer()).get('/api/v1/users').query({ search }).set('Authorization', `Bearer ${admin}`)).status).toBe(400);
    const result = await request(app.getHttpServer()).get('/api/v1/users?search=demo').set('Authorization', `Bearer ${admin}`);
    expect(result.status).toBe(200); expect(result.body).toEqual([]);
  });

  it('create trims identity, bounds data and rejects bcrypt byte truncation', async () => {
    const token = await jwtService.signAsync({ sub: 'admin1', username: 'admin', role: 'admin' });
    for (const body of [{ ...newUser, username: '   ' }, { ...newUser, username: 'x'.repeat(101) }, { ...newUser, fullName: '  ' }, { ...newUser, fullName: 'x'.repeat(201) }, { ...newUser, password: 'é'.repeat(37) }]) expect((await request(app.getHttpServer()).post('/api/v1/users').set('Authorization', `Bearer ${token}`).send(body)).status).toBe(400);
    const result = await request(app.getHttpServer()).post('/api/v1/users').set('Authorization', `Bearer ${token}`).send({ ...newUser, username: '  trimmed  ', fullName: '  Fictional Name  ' });
    expect(result.status).toBe(201); expect(result.body.username).toBe('trimmed'); expect(result.body.fullName).toBe('Fictional Name');
  });

});
