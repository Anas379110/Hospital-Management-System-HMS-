import { ServiceUnavailableException } from '@nestjs/common';
export function cleanupPending() {
 return new ServiceUnavailableException({error:{code:'DEMO_CLEANUP_PENDING',message:'Demo temporarily paused for maintenance. Try again later.',details:[]}});
}
export async function requireCleanupReady(read: () => Promise<{ready:boolean}[]>) {
 try { const rows = await read(); if (rows[0]?.ready !== true) throw Error('not ready'); }
 catch { throw cleanupPending(); }
}
