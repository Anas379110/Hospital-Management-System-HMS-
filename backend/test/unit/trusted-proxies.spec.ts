import { trustedProxyAddresses } from '../../src/common/trusted-proxies';
describe('trusted proxy fail-safe configuration',()=>{
 it('ignores forwarded headers by default',()=>expect(trustedProxyAddresses()).toBe(false));
 it('only allows explicit address/CIDR allowlist',()=>expect(trustedProxyAddresses('127.0.0.1, 10.20.0.0/16, ::1')).toEqual(['127.0.0.1','10.20.0.0/16','::1']));
 it.each(['true','1','loopback','0.0.0.0/0','::/0','10.0.0.0/33','::1/129','127.0.0.1,','*'])('rejects unsafe or malformed %s',value=>expect(()=>trustedProxyAddresses(value)).toThrow());
});
