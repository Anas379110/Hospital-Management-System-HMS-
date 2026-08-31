import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

// هاش وهمي ثابت لمقاومة هجوم التوقيت (Timing Attack) — راجع docs/security/SECURITY-REVIEW.md Finding #1.
// نفّذ bcrypt.compare دائماً حتى عندما لا يوجد المستخدم، لمنع استنتاج وجود
// اسم المستخدم من فرق زمن الاستجابة بين "غير موجود" و"كلمة مرور خاطئة".
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOxo0/2n1p6qF0v6Z8t3f3v3f3v3f3v3fu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      // نقارن مقابل هاش وهمي لتوحيد زمن الاستجابة مع حالة "كلمة مرور خاطئة"
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
          details: [],
        },
      });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
          details: [],
        },
      });
    }

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * راجع docs/security/SECURITY-REVIEW.md Finding #3: JWT هنا Stateless بلا
   * تخزين جلسات (Decision 009/010 — بلا Redis)، لذا "تسجيل الخروج" الفعلي
   * يحدث بحذف الرمز من طرف العميل. هذا Endpoint موجود لاتساق الـ API فقط
   * (وكنقطة تمديد مستقبلية لو أُضيفت قائمة إبطال Tokens لاحقاً عند الحاجة).
   */
  logout() {
    return { message: 'تم تسجيل الخروج' };
  }
}
