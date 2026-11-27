import { isIP } from 'node:net';
/** Explicit observed proxy addresses only. No boolean trust-all or hop guesses. */
export function trustedProxyAddresses(value?: string): false | string[] {
  if (!value?.trim()) return false;
  const addresses = value.split(',').map(x => x.trim());
  for (const address of addresses) {
    const [ip, prefix, ...extra] = address.split('/');
    const version = isIP(ip);
    if (!version || extra.length || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) throw new Error('HMS_TRUSTED_PROXY_ADDRESSES requires explicit IP addresses or non-universal CIDRs');
  }
  return addresses;
}
