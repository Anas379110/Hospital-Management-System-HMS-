import { Test } from '@nestjs/testing';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditInterceptor } from '../../src/common/interceptors/audit.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

function buildContext(user?: { userId: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: {}, body: {} }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor persistence and fallback', () => {
  let interceptor: AuditInterceptor;
  let prisma: { auditLog: { create: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };
  let tempLogPath: string;

  beforeEach(async () => {
    tempLogPath = path.join(os.tmpdir(), `audit-fallback-test-${Date.now()}.log`);
    prisma = { auditLog: { create: jest.fn() } };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({ action: 'TEST_ACTION', entityType: 'TestEntity' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(tempLogPath) },
        },
      ],
    }).compile();

    interceptor = moduleRef.get(AuditInterceptor);
  });

  afterEach(() => {
    if (fs.existsSync(tempLogPath)) fs.unlinkSync(tempLogPath);
  });

  const nextHandler: CallHandler = { handle: () => of({ id: 'entity-1' }) };

  it('يكتب Audit Log بنجاح عادي عند نجاح قاعدة البيانات (المسار الطبيعي)', (done) => {
    prisma.auditLog.create.mockResolvedValue({});

    interceptor.intercept(buildContext({ userId: 'user-1' }), nextHandler).subscribe(() => {
      setImmediate(() => {
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ action: 'TEST_ACTION', entityId: 'entity-1' }),
          }),
        );
        expect(fs.existsSync(tempLogPath)).toBe(false); // لا حاجة لملف احتياطي — كل شيء نجح
        done();
      });
    });
  });

  it('Fallback: يكتب سجلاً احتياطياً محلياً عند فشل قاعدة البيانات — لا فقدان صامت', (done) => {
    prisma.auditLog.create.mockRejectedValue(new Error('DB connection lost'));

    interceptor.intercept(buildContext({ userId: 'user-1' }), nextHandler).subscribe(() => {
      // ننتظر دورة Event Loop لأن كتابة الملف تحدث داخل .catch() غير المتزامن
      setTimeout(() => {
        expect(fs.existsSync(tempLogPath)).toBe(true);
        const content = fs.readFileSync(tempLogPath, 'utf8');
        const record = JSON.parse(content.trim());
        expect(record.action).toBe('TEST_ACTION');
        expect(record.entityId).toBe('entity-1');
        expect(record.failureCode).toBe('AUDIT_DB_WRITE_FAILED');
        expect(content).not.toContain('DB connection lost');
        done();
      }, 50);
    });
  });

  it('لا يفعل شيئاً إن لم يوجد @Audit على الـ Handler', (done) => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    interceptor.intercept(buildContext({ userId: 'user-1' }), nextHandler).subscribe(() => {
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });

  it('لا يحاول الكتابة إن لم يوجد مستخدم مصادَق (حالة غير متوقعة نظرياً)', (done) => {
    interceptor.intercept(buildContext(undefined), nextHandler).subscribe(() => {
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });
});
