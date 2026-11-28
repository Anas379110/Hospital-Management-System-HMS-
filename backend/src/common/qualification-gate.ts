import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
/** Controlled hosted qualification only. It never substitutes for runtime grants. */
export function qualificationGate() {
  const enabled = process.env.HMS_QUALIFICATION_MODE === 'true';
  const secret = process.env.HMS_QUALIFICATION_SECRET;
  if (!enabled) return (_req: Request, _res: Response, next: NextFunction) => next();
  if (process.env.HMS_PUBLIC_DEMO !== 'true' || !secret || secret.length < 32) throw new Error('Qualification gate requires demo mode and a strong independent secret');
  const expected=Buffer.from(secret);
  return (req: Request,res: Response,next: NextFunction) => {
    if (req.method==='GET' && req.path==='/api/v1/health') return next();
    const candidate=Buffer.from(req.get('X-HMS-Qualification')??'');
    if(candidate.length!==expected.length||!timingSafeEqual(candidate,expected)) { res.status(401).json({error:{code:'QUALIFICATION_ONLY',message:'Qualification service is not open to visitors.',details:[]}});return; }
    next();
  };
}
