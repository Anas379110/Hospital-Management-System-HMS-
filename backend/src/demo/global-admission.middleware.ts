import type { Request, Response, NextFunction } from 'express';

/** Global process-local fixed window. Does not trust request IP or forwarding headers. */
export function createGlobalSessionAdmission(clock: () => number = Date.now) {
  let start = clock();
  let count = 0;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'POST' || req.path !== '/api/demo/session') { next(); return; }
    const now = clock();
    if (now - start >= 60_000 || now < start) { start = now; count = 0; }
    if (count >= 10) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((start + 60_000 - now) / 1000))));
      res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Demo session limit reached. Please try again later.', details: [] } });
      return;
    }
    count++;
    next();
  };
}
