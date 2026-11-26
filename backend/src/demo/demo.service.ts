import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { demoCatalog } from './fixtures';

/** Public viewer capability, never an HMS user, JWT or administrative credential. */
@Injectable()
export class DemoService {
  private readonly sessions = new Map<string, number>();
  private readonly sessionTtlMs = 15 * 60_000;

  session() {
    const now = Date.now();
    for (const [token, expiry] of this.sessions) if (expiry <= now) this.sessions.delete(token);
    if (this.sessions.size >= 256) {
      const oldest = this.sessions.keys().next().value as string | undefined;
      if (oldest) this.sessions.delete(oldest);
    }
    const viewerToken = randomBytes(32).toString('hex');
    const expiresAt = now + this.sessionTtlMs;
    this.sessions.set(viewerToken, expiresAt);
    return { viewerToken, expiresAt, role: 'fictional_demo_viewer', readOnly: true };
  }

  accepts(authorization: string | undefined): boolean {
    if (!authorization || !/^Bearer [a-f0-9]{64}$/.test(authorization)) return false;
    const token = authorization.slice(7);
    const expiry = this.sessions.get(token);
    if (!expiry || expiry <= Date.now()) { this.sessions.delete(token); return false; }
    return true;
  }

  catalog() {
    return demoCatalog;
  }
}
