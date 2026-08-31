import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * يرفض الطلب بـ 403 إن لم يكن دور المستخدم الحالي ضمن الأدوار المسموحة
 * المحددة عبر @Roles(...) في الـ Controller/Handler.
 * راجع CLAUDE.md §10 — لا تجاوز هذا الـ Guard "مؤقتاً للاختبار" أبداً.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      // لا @Roles محدد = يُرفض افتراضياً (Fail-Closed لا Fail-Open) لأمان أعلى
      throw new ForbiddenException({
        error: {
          code: 'NO_ROLES_DEFINED',
          message: 'هذا المسار غير مهيَّأ بصلاحيات — تواصل مع الدعم الفني',
          details: [],
        },
      });
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'لا تملك صلاحية الوصول لهذا الإجراء',
          details: [],
        },
      });
    }

    return true;
  }
}
