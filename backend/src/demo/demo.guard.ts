import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DemoService } from './demo.service';
import { admitDemoRequest } from './request-policy';

/** Exact request allowlist. No fallback to operational HMS handlers. */
@Injectable()
export class DemoGuard implements CanActivate {
  constructor(private readonly demo: DemoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const admission = admitDemoRequest({ method: request.method, path: request.path, queryKeys: Object.keys(request.query), bodyKeys: Object.keys(request.body ?? {}), contentLength: request.headers['content-length'], transferEncoding: request.headers['transfer-encoding'] });
    if (!admission.allowed) {
      throw new ForbiddenException({ error: { code: admission.code, message: 'This demo only accepts fixed fictional read requests', details: [] } });
    }
    if (admission.needsViewer && !this.demo.accepts(request.headers.authorization)) {
      throw new UnauthorizedException({ error: { code: 'DEMO_SESSION_REQUIRED', message: 'Open a fictional viewer session first', details: [] } });
    }
    return true;
  }
}
