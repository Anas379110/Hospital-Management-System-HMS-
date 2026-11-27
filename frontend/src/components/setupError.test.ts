import { describe, it, expect, vi } from 'vitest';
vi.mock('../i18n/i18n', () => ({ default: { t: (key: string) => key } }));
import { setupError } from './setupError';
function error(status?: number, code?: string, networkCode?: string) {
  return { isAxiosError: true, code: networkCode, config: { method: 'patch', url: '/departments/id' }, ...(status ? { response: { status, data: code ? { error: { code } } : '<html>proxy failure</html>' } } : {}) };
}
describe('setup write failures', () => {
  it.each([502,504,500,503])('treats code-less proxy %s as unknown and closes', status => expect(setupError(error(status))).toEqual({ key: 'errors.writeUnknown', close: true }));
  it.each(['ERR_NETWORK','ECONNABORTED','ETIMEDOUT'])('network/timeout %s is unknown', code => expect(setupError(error(undefined,undefined,code))).toEqual({ key: 'errors.writeUnknown', close: true }));
  it('recognizes explicit atomic audit failure503', () => expect(setupError(error(503,'AUDIT_PERSISTENCE_FAILED'))).toEqual({ key: 'departments.auditFailure', close: false }));
  it.each(['BED_OCCUPIED','SETUP_HAS_HISTORY','BED_STATE_CHANGED','DEPARTMENT_NOT_FOUND','BED_NOT_FOUND'])('closes known changed state %s', code => expect(setupError(error(409,code))).toEqual({ key: 'setup.conflict', close: true }));
  it('keeps duplicate editable', () => expect(setupError(error(409,'BED_NUMBER_EXISTS'))).toEqual({ key: 'setup.duplicate', close: false }));
  it('distinguishes auth and validation', () => { expect(setupError(error(403,'FORBIDDEN_ROLE')).key).toBe('setup.forbidden'); expect(setupError(error(400,'BAD_REQUEST')).key).toBe('setup.invalid'); expect(setupError(error(401,'UNAUTHORIZED')).key).toBe('setup.forbidden'); });
  it('does not invent a conflict for clean unknown4xx', () => expect(setupError(error(422))).toEqual({ key: 'errors.generic', close: false }));
});
