import type { Request, Response, NextFunction } from 'express';
import { admitDemoRequest } from './request-policy';

/** Shared demo-only middleware, intentionally independent of operational HMS. */
export function demoAdmission(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const admission = admitDemoRequest({ method: req.method, path: req.path, queryKeys: Object.keys(req.query), bodyKeys: Object.keys(req.body ?? {}), contentLength: req.headers['content-length'], transferEncoding: req.headers['transfer-encoding'] });
  if (!admission.allowed) {
    res.status(403).json({ error: { code: admission.code, message: 'Only empty fixed-fictional demo requests are accepted', details: [] } });
    return;
  }
  next();
}
