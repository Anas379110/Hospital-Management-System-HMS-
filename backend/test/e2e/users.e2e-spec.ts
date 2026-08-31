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
    user: {
      findUnique: jest.fn(),
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
    prismaMock.user.findUnique.mockResolvedValue(null);
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
});
