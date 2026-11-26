import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // القيمة المُعادة هنا تصبح request.user في كل الـ Controllers
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, role: true, isActive: true } });
    if (!user?.isActive) throw new UnauthorizedException({ error: { code: 'SESSION_USER_INACTIVE', message: 'Session user is no longer active. Sign in again.', details: [] } });
    return { userId: user.id, username: user.username, role: user.role };
  }
}
