import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { Prisma } from '@prisma/client';

/**
 * يسجل تلقائياً كل عملية عليها @Audit(...) في جدول audit_logs
 * بعد نجاحها فعلياً — بلا حاجة لكتابة كود تسجيل يدوي في كل Service.
 * راجع ARCHITECTURE.md §3 وCLAUDE.md §11.
 *
 * راجع docs/security/SECURITY-REVIEW.md Finding #4 (RESOLVED):
 * فشل كتابة audit_logs لم يعد صامتاً — عند فشل الكتابة بقاعدة البيانات،
 * يُكتب سجل احتياطي محلياً بملف (Append-only، JSON Lines) فوراً، بحيث
 * لا يُفقد أي حدث تدقيقي حتى لو تعطلت قاعدة البيانات لحظياً. هذا يحافظ
 * على متطلب التوثيق الدقيق المفروض بقانون سوريا 12/2024 (راجع SECURITY.md).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditInterceptor');
  private readonly fallbackLogPath: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.fallbackLogPath =
      this.config.get<string>('AUDIT_FALLBACK_LOG_PATH') ?? path.join(process.cwd(), 'logs', 'audit-fallback.log');
  }

 intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  const auditMeta = this.reflector.getAllAndOverride<{
    action: string;
    entityType: string;
  }>(AUDIT_KEY, [context.getHandler(), context.getClass()]);

  if (!auditMeta) {
    return next.handle();
  }

  const request = context.switchToHttp().getRequest();
  const userId: string | undefined = request.user?.userId;

  return next.handle().pipe(
    tap((result: Record<string, unknown> | undefined) => {
      if (!userId) return;

      const entityId =
        (result?.id as string | undefined) ?? request.params?.id;

      const oldValue = request.body?._auditOldValue;

      const auditRecord = {
        userId,
        action: auditMeta.action,
        entityType: auditMeta.entityType,
        entityId: entityId ?? 'unknown',

        oldValue:
          oldValue !== undefined
            ? (oldValue as Prisma.InputJsonValue)
            : Prisma.DbNull,

        newValue:
          result !== undefined
            ? (result as Prisma.InputJsonValue)
            : Prisma.DbNull,
      };

      this.prisma.auditLog
        .create({ data: auditRecord })
        .catch((dbError: unknown) => {
          this.logger.error(
            `AUDIT LOG DB WRITE FAILED — falling back to local file: ${String(dbError)}`,
          );

          this.writeFallbackLog(auditRecord, dbError);
        });
    }),
  );
}

  /**
   * خط الدفاع الثاني عند فشل كتابة audit_logs بقاعدة البيانات: سجل احتياطي
   * محلي (JSON Lines) يمكن استيراده لاحقاً يدوياً لقاعدة البيانات بعد
   * استعادة الاتصال، بدل فقدان الحدث نهائياً.
   */
  private writeFallbackLog(
    record: {
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      oldValue?: unknown;
      newValue?: unknown;
    },
    dbError: unknown,
  ) {
    try {
      const dir = path.dirname(this.fallbackLogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const line =
        JSON.stringify({
          ...record,
          capturedAt: new Date().toISOString(),
          dbError: String(dbError),
        }) + '\n';
      fs.appendFileSync(this.fallbackLogPath, line, { encoding: 'utf8' });
    } catch (fileError) {
      // إن فشلت حتى الكتابة المحلية (نادر جداً — مثال: القرص ممتلئ)،
      // هذا هو الحد الأقصى الممكن تقنياً: تسجيل صارم بالسجلات التقنية
      // العامة ليكتشفه أي نظام مراقبة سجلات (Log Monitoring) لاحقاً.
      this.logger.error(
        `CRITICAL: audit fallback file write ALSO failed — event may be lost: ${String(fileError)}`,
      );
    }
  }
}
