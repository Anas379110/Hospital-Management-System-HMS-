import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('login: ينجح ببيانات صحيحة ويعيد accessToken بلا passwordHash', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4); // rounds منخفضة لتسريع الاختبار فقط
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'dr1',
      passwordHash,
      fullName: 'د. أحمد',
      role: 'doctor',
      isActive: true,
    });

    const result = await service.login('dr1', 'correct-password');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.role).toBe('doctor');
  });

  it('login: يرفض بـ401 لكلمة مرور خاطئة، برسالة موحَّدة لا تكشف السبب', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'dr1',
      passwordHash,
      isActive: true,
    });

    await expect(service.login('dr1', 'wrong-password')).rejects.toThrow(UnauthorizedException);
  });

  it('login: يرفض بـ401 لمستخدم غير موجود، بنفس رسالة كلمة المرور الخاطئة (Finding #1)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    try {
      await service.login('ghost-user', 'any-password');
      fail('كان يجب رمي استثناء');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        error: { code: string; message: string };
      };
      expect(response.error.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('login: يرفض بـ401 لمستخدم معطَّل (isActive=false) حتى ببيانات صحيحة', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'dr1',
      passwordHash,
      isActive: false,
    });

    await expect(service.login('dr1', 'correct-password')).rejects.toThrow(UnauthorizedException);
  });

  it('logout: يعيد رسالة تأكيد بسيطة (Stateless JWT — راجع Finding #3)', () => {
    const result = service.logout();
    expect(result).toEqual({ message: 'تم تسجيل الخروج' });
  });
});
