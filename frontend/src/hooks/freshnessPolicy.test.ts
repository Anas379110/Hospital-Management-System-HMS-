import { describe, expect, it } from 'vitest';
import { isReadStale, isViewActive, REFRESH_MS } from './freshnessPolicy';
describe('active read freshness policy', () => {
  it('allows polling only for visible online views', () => { expect(isViewActive('visible', true)).toBe(true); for (const [visibility, online] of [['hidden', true], ['visible', false], ['hidden', false]] as const) expect(isViewActive(visibility, online)).toBe(false); });
  it('uses a15second target and never treats missing reads as confirmed', () => { expect(REFRESH_MS).toBe(15000); expect(isReadStale(0, 10, true, false, 0)).toBe(true); expect(isReadStale(1, 15000, true, false, 0)).toBe(false); expect(isReadStale(1, 15001, true, false, 0)).toBe(true); });
  it('retains stale state until a successful post-resume read', () => { expect(isReadStale(100, 120, false, false, 0)).toBe(true); expect(isReadStale(100, 120, true, true, 0)).toBe(true); expect(isReadStale(100, 120, true, false, 110)).toBe(true); expect(isReadStale(111, 120, true, false, 110)).toBe(false); });
});
