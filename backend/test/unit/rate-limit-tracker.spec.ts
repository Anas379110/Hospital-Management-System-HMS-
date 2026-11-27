import { rateLimitTracker, validateRateLimitIdentityConfiguration, rateLimitIdentityStatus } from '../../src/common/rate-limit-tracker';
const request = (value?: string, name = 'CF-Connecting-IP') => ({ ip: '127.0.0.1', headers: value === undefined ? {} : { 'cf-connecting-ip': value }, rawHeaders: value === undefined ? [] : [name, value] });
describe('Render Cloudflare rate identity opt-in', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env.HMS_PUBLIC_DEMO = 'true'; process.env.HMS_RATE_LIMIT_IDENTITY = 'render-cloudflare'; });
  afterAll(() => { process.env = env; });
  it('keeps legacy Express identity unless explicitly opted in for demo', async () => {
    process.env.HMS_RATE_LIMIT_IDENTITY = '';
    expect(await rateLimitTracker(request('198.51.100.1'))).toBe('127.0.0.1');
    process.env.HMS_RATE_LIMIT_IDENTITY = 'render-cloudflare'; process.env.HMS_PUBLIC_DEMO = 'false';
    expect(await rateLimitTracker(request('198.51.100.1'))).toBe('127.0.0.1');
  });
  it('accepts header case variants and separates synthetic client fixtures', async () => {
    expect(await rateLimitTracker(request('198.51.100.1', 'cf-connecting-ip'))).toBe('cf:198.51.100.1');
    expect(await rateLimitTracker(request('198.51.100.2', 'cF-CoNnEcTiNg-Ip'))).toBe('cf:198.51.100.2');
  });
  it.each([undefined, '', 'invalid', '198.51.100.1, 198.51.100.2', ' 198.51.100.1', '198.51.100.1 ', '[2001:db8::1]', 'fe80::1%eth0', '198.51.100.1:80', '010.0.0.1'])('uses one shared fallback for missing/invalid %s', async value => {
    expect(await rateLimitTracker(request(value))).toBe('shared:render-cloudflare');
  });
  it('rejects duplicate fields even when the parsed map retained one value', async () => {
    const req = request('198.51.100.1'); req.rawHeaders.push('cf-connecting-ip', '198.51.100.1');
    expect(await rateLimitTracker(req)).toBe('shared:render-cloudflare');
  });
  it('does not use forwarded headers or a socket-specific fallback', async () => {
    const req = request(); Object.assign(req.headers, { 'x-forwarded-for': '198.51.100.1', 'true-client-ip': '198.51.100.1' }); req.ip = '127.0.0.2';
    expect(await rateLimitTracker(req)).toBe('shared:render-cloudflare');
  });
  it('reports mode and aggregate assignments without identity values', async () => {
    const before = rateLimitIdentityStatus().assignments;
    await rateLimitTracker(request('198.51.100.1')); await rateLimitTracker(request());
    expect(rateLimitIdentityStatus()).toEqual({mode:'render-cloudflare', assignments:{keyed:before.keyed+1,fallback:before.fallback+1}});
    expect(JSON.stringify(rateLimitIdentityStatus())).not.toContain('198.51.100.1');
    process.env.HMS_RATE_LIMIT_IDENTITY=''; expect(rateLimitIdentityStatus().mode).toBe('legacy-express');
  });
  it('rejects unknown modes at startup', () => {
    process.env.HMS_RATE_LIMIT_IDENTITY = 'render-cloudflar';
    expect(() => validateRateLimitIdentityConfiguration()).toThrow('Unknown HMS_RATE_LIMIT_IDENTITY');
    for (const mode of ['', 'render-cloudflare']) { process.env.HMS_RATE_LIMIT_IDENTITY = mode; expect(() => validateRateLimitIdentityConfiguration()).not.toThrow(); }
    delete process.env.HMS_RATE_LIMIT_IDENTITY; expect(() => validateRateLimitIdentityConfiguration()).not.toThrow();
  });
  it('shares an IPv6 /64 but separates different prefixes', async () => {
    expect(await rateLimitTracker(request('2001:db8:12:34::1'))).toBe(await rateLimitTracker(request('2001:db8:12:34:ffff:ffff:ffff:ffff')));
    expect(await rateLimitTracker(request('2001:db8:12:35::1'))).not.toBe(await rateLimitTracker(request('2001:db8:12:34::1')));
    expect(await rateLimitTracker(request('::1'))).toBe('cf6:0:0:0:0::/64');
  });
  it('canonicalizes equivalent IPv6 and mapped IPv4', async () => {
    expect(await rateLimitTracker(request('2001:0DB8:0:0:0:0:0:1'))).toBe(await rateLimitTracker(request('2001:db8::1')));
    expect(await rateLimitTracker(request('::ffff:192.0.2.1'))).toBe(await rateLimitTracker(request('192.0.2.1')));
    expect(await rateLimitTracker(request('0:0:0:0:0:FFFF:C000:0201'))).toBe('cf:192.0.2.1');
  });
});
