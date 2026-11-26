import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Request, Response, NextFunction } from 'express';

/** Startup snapshot of exact build files only. Never resolve request paths against disk. */
export function createDemoStatic(root: string) {
  const files = new Map<string, { body: Buffer; type: string; cache: string }>();
  const html = readFileSync(join(root, 'demo.html'));
  for (const route of ['/', '/demo.html']) files.set(route, { body: html, type: 'text/html; charset=utf-8', cache: 'no-store' });
  for (const entry of readdirSync(join(root, 'assets'), { withFileTypes: true })) {
    if (!entry.isFile() || !/^[A-Za-z0-9_-]+\.(js|css)$/.test(entry.name)) continue;
    const body = readFileSync(join(root, 'assets', entry.name));
    files.set('/assets/' + entry.name, { body, type: entry.name.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8', cache: 'public, max-age=31536000, immutable' });
  }
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (req.path === '/api' || req.path.startsWith('/api/')) { next(); return; }
    res.setHeader('Cache-Control', 'no-store');
    const file = files.get(req.originalUrl);
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !file) { res.status(404).end(); return; }
    res.setHeader('Cache-Control', file.cache);
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Length', file.body.length);
    if (req.method === 'HEAD') res.status(200).end(); else res.status(200).end(file.body);
  };
}
