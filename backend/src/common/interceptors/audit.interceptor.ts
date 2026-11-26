import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { Prisma } from '@prisma/client';
import { auditSnapshot } from '../audit-snapshot';

/**
 * Awaited post-handler audit persistence with redacted fallback.
 * Not atomic with the business mutation. Process loss before persistence and
 * simultaneous database/file failure remain release-gate limitations.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditInterceptor');
  private readonly fallbackLogPath: string;

  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService, config: ConfigService) {
    this.fallbackLogPath = config.get<string>('AUDIT_FALLBACK_LOG_PATH') ?? path.join(process.cwd(), 'logs', 'audit-fallback.log');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<{ action: string; entityType: string; transactional?: boolean }>(AUDIT_KEY, [context.getHandler(), context.getClass()]);
    if (!meta || meta.transactional) return next.handle();
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    return next.handle().pipe(concatMap(async (result: Record<string, unknown> | undefined) => {
      if (!userId) {
        this.logger.error('Audit actor missing; successful mutation may be unaudited');
        return result;
      }
      const entityId = typeof result?.id === 'string' ? result.id : request.params?.id;
      if (typeof entityId !== 'string' || entityId.length === 0) {
        this.logger.error('Audit entity linkage missing; successful mutation may be unaudited');
        return result;
      }
      const auditRecord = {
        userId, action: meta.action, entityType: meta.entityType,
        entityId,
        // Never trust request.body._auditOldValue. Trusted before-state capture
        // belongs in a service-level transactional audit integration.
        oldValue: Prisma.DbNull,
        newValue: result === undefined ? Prisma.DbNull : auditSnapshot(result),
      };
      try { await this.prisma.auditLog.create({ data: auditRecord }); }
      catch {
        this.logger.error('Audit database write failed; attempting redacted local fallback');
        try {
          fs.mkdirSync(path.dirname(this.fallbackLogPath), { recursive: true });
          fs.appendFileSync(this.fallbackLogPath, JSON.stringify({ ...auditRecord, capturedAt: new Date().toISOString(), failureCode: 'AUDIT_DB_WRITE_FAILED' }) + '\n', { encoding: 'utf8', mode: 0o600 });
        } catch {
          // Do not return a misleading retryable error after a business mutation
          // has committed. Atomic/outbox integration must close this gap.
          this.logger.error('Audit fallback failed; event may be lost');
        }
      }
      return result;
    }));
  }
}
