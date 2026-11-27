import { isIP } from 'node:net';
import { Request } from 'express';

export function validateRateLimitIdentityConfiguration(): void {
  const mode = process.env.HMS_RATE_LIMIT_IDENTITY;
  if (mode !== undefined && mode !== '' && mode !== 'render-cloudflare') {
    throw new Error('Unknown HMS_RATE_LIMIT_IDENTITY configuration');
  }
}

/** Only for the documented Render Cloudflare edge path. Never enables Express
 * proxy trust. IPs identify a connection, not a person (NAT/Workers can share).
 * All uncertain identities share one conservative bucket, not an attacker key.
 */
const assignments = { keyed: 0, fallback: 0 };
export function rateLimitIdentityStatus() {
  return { mode: process.env.HMS_PUBLIC_DEMO === 'true' && process.env.HMS_RATE_LIMIT_IDENTITY === 'render-cloudflare' ? 'render-cloudflare' : 'legacy-express', assignments: { ...assignments } };
}

export async function rateLimitTracker(req: Pick<Request, 'headers' | 'rawHeaders' | 'ip'>): Promise<string> {
  if (process.env.HMS_PUBLIC_DEMO !== 'true' || process.env.HMS_RATE_LIMIT_IDENTITY !== 'render-cloudflare') {
    return Promise.resolve(req.ip ?? 'shared:unknown');
  }
  const key = await connectionKey(req);
  assignments[key === 'shared:render-cloudflare' ? 'fallback' : 'keyed']++;
  return key;
}

function connectionKey(req: Pick<Request, 'headers' | 'rawHeaders' | 'ip'>): Promise<string> {
  const fallback = 'shared:render-cloudflare';
  const values = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === 'cf-connecting-ip');
  const value = req.headers['cf-connecting-ip'];
  if (values.length !== 1 || typeof value !== 'string' || value !== value.trim() || value.includes('%') || !isIP(value)) {
    return Promise.resolve(fallback);
  }
  if (isIP(value) === 4) return Promise.resolve(`cf:${value}`);
  // WHATWG URL canonicalizes compressed/expanded/case IPv6 representations.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    return Promise.resolve(`cf:${hi >>> 8}.${hi & 255}.${lo >>> 8}.${lo & 255}`);
  }
  const [left, right = ''] = canonical.split('::');
  const leading = left ? left.split(':') : [], trailing = right ? right.split(':') : [];
  const groups = canonical.includes('::') ? [...leading, ...Array(8 - leading.length - trailing.length).fill('0'), ...trailing] : leading;
  return Promise.resolve(`cf6:${groups.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(':')}::/64`);
}
