import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { Prisma } from '@prisma/client';
import { AuditInterceptor } from '../../src/common/interceptors/audit.interceptor';

function context(): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({
    user: { userId: 'actor-1' }, params: {}, body: { _auditOldValue: { status: 'forged' } },
  }) }), getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
}

describe('Audit safety boundary', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue({ action: 'TEST', entityType: 'Patient' }) };
  const config = { get: jest.fn().mockReturnValue('/tmp/hms-audit-safety-fallback.log') };

  it('ignores client-supplied old value and redacts sensitive handler fields', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, prisma as never, config as unknown as ConfigService);
    await firstValueFrom(interceptor.intercept(context(), { handle: () => of({
      id: 'entity-1', passwordHash: 'secret-hash', diagnosis: 'clinical-free-text',
      fullName: 'private-name', status: 'active', nested: { accessToken: 'secret-token' }, unexpectedText: 'unknown-sensitive-content',
    }) }));
    const record = prisma.auditLog.create.mock.calls[0][0].data;
    expect(record.oldValue).toEqual(Prisma.DbNull);
    expect(record.newValue.status).toBe('active');
    const saved = JSON.stringify(record);
    for (const value of ['secret-hash', 'clinical-free-text', 'private-name', 'secret-token', 'forged', 'unknown-sensitive-content']) expect(saved).not.toContain(value);
  });

  it('does not emit success until audit persistence has settled', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const prisma = { auditLog: { create: jest.fn().mockReturnValue(pending) } };
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, prisma as never, config as unknown as ConfigService);
    let emitted = false;
    const result = firstValueFrom(interceptor.intercept(context(), { handle: () => of({ id: 'entity-1' }) })).then(value => { emitted = true; return value; });
    await new Promise(resolve => setImmediate(resolve));
    expect(emitted).toBe(false);
    release();
    await expect(result).resolves.toEqual({ id: 'entity-1' });
  });
  it('writes a redacted fallback without raw database error details', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hms-audit-redaction-'));
    const target = path.join(dir, 'audit.log');
    const prisma = { auditLog: { create: jest.fn().mockRejectedValue(new Error('DB secret-password')) } };
    const fallbackConfig = { get: jest.fn().mockReturnValue(target) };
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, prisma as never, fallbackConfig as unknown as ConfigService);
    try {
      await firstValueFrom(interceptor.intercept(context(), { handle: () => of({ id: 'entity-1', diagnosis: 'private-clinical', passwordHash: 'private-hash' }) }));
      const content = fs.readFileSync(target, 'utf8');
      expect(JSON.parse(content).failureCode).toBe('AUDIT_DB_WRITE_FAILED');
      for (const value of ['secret-password', 'private-clinical', 'private-hash', 'forged']) expect(content).not.toContain(value);
      expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it.each(['actor', 'entity'])('reports a fixed diagnostic for missing %s without a false linked record', async missing => {
    const prisma = { auditLog: { create: jest.fn() } };
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: missing === 'actor' ? undefined : { userId: 'actor-1' }, params: {} }) }), getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
    const value = missing === 'entity' ? { status: 'changed' } : { id: 'entity-1' };
    try {
      const interceptor = new AuditInterceptor(reflector as unknown as Reflector, prisma as never, config as unknown as ConfigService);
      await expect(firstValueFrom(interceptor.intercept(ctx, { handle: () => of(value) }))).resolves.toEqual(value);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(missing === 'actor' ? 'Audit actor missing; successful mutation may be unaudited' : 'Audit entity linkage missing; successful mutation may be unaudited');
    } finally { log.mockRestore(); }
  });

  it('does not double-log service-transactional handlers', async () => {
    const transactional = { getAllAndOverride: jest.fn().mockReturnValue({ action: 'PATIENT_ADMITTED', entityType: 'Admission', transactional: true }) };
    const prisma = { auditLog: { create: jest.fn() } };
    const interceptor = new AuditInterceptor(transactional as unknown as Reflector, prisma as never, config as unknown as ConfigService);
    await expect(firstValueFrom(interceptor.intercept(context(), { handle: () => of({ id: 'entity' }) }))).resolves.toEqual({ id: 'entity' });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

});
