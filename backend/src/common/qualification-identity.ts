import { createHmac, randomBytes } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
/** Private qualification comparison only. No raw addresses, logs or durable key.
 * Register AFTER qualificationGate. Disabled unless both qualification and demo
 * mode are set; fingerprints expire one hour after this process starts.
 */
export function qualificationIdentity() {
  const enabled = process.env.HMS_QUALIFICATION_MODE === 'true' && process.env.HMS_PUBLIC_DEMO === 'true';
  const key = randomBytes(32), expires = Date.now() + 60 * 60_000;
  const digest = (value: string | undefined) => value ? createHmac('sha256', key).update(value).digest('hex').slice(0, 32) : null;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled || req.method !== 'GET' || req.path !== '/api/v1/qualification/identity') return next();
    res.setHeader('Cache-Control', 'no-store');
    if (Date.now() >= expires) { res.status(410).json({error:{code:'QUALIFICATION_DIAGNOSTIC_EXPIRED'}}); return; }
    const chain = (req.get('x-forwarded-for') ?? '').split(',').map(x=>x.trim()).filter(Boolean);
    res.status(200).json({scope:'ephemeral-qualification-only',socket: digest(req.socket.remoteAddress),express: digest(req.ip),cloudflare:digest(req.get('cf-connecting-ip')),trueClient:digest(req.get('true-client-ip')),forwardedFirst:digest(chain[0]),forwardedLast:digest(chain[chain.length-1]),forwardedPositions:chain.slice(0,8).map(x=>digest(x)),forwardedCount:chain.length,positionsTruncated:chain.length>8});
  };
}
