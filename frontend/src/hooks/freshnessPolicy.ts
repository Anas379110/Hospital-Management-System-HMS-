export const REFRESH_MS = 15_000;
export function isViewActive(visibility: string, online: boolean) { return visibility === 'visible' && online; }
export function isReadStale(updatedAt: number, now: number, active: boolean, error: boolean, resumedAt: number) {
  return !updatedAt || !active || error || updatedAt < resumedAt || now - updatedAt >= REFRESH_MS;
}
