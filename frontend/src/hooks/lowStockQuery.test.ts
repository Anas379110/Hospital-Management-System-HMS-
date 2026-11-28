import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
vi.mock('../i18n/i18n', () => ({ default: { t: (key: string) => key } }));
import { apiClient } from '../api/client';
import { lowStockQueryKey, readLowStock } from './lowStockQuery';
import { QueryClient } from '@tanstack/react-query';
import { clearSessionQueries } from '../api/sessionIsolation';
const row = { id: 'legacy', name: '', unit: '', currentStock: 0, reorderThreshold: 0 };
beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } }); });
it('reads existing endpoint with signal and preserves server rows/order without frontend policy', async () => {
  const signal = new AbortController().signal;apiClient.defaults.adapter = async config => { expect(config.method).toBe('get');expect(config.url).toBe('/medications/low-stock');expect(config.signal).toBe(signal);return { data: [row], status: 200, statusText: 'OK', headers: {}, config }; };expect(await readLowStock(signal)).toEqual([row]);
});
it('shares medication invalidations but does not collide with inventory cache', async () => {
  const client = new QueryClient();client.setQueryData(['medications'], []);client.setQueryData(lowStockQueryKey, [row]);await client.invalidateQueries({ queryKey: ['medications'] });expect(client.getQueryState(lowStockQueryKey)?.isInvalidated).toBe(true);expect(client.getQueryData(['medications'])).toEqual([]);client.clear();
});
it.each([[204, []], [200, {}], [200, [{}]], [200, [{ ...row, currentStock: '0' }]]])('rejects invalid status/body %s', async (status, data) => { apiClient.defaults.adapter = async config => ({ data, status: status as number, statusText: 'OK', headers: {}, config });await expect(readLowStock()).rejects.toThrow('Unverified'); });
it('propagates failed read rather than manufacturing empty inventory', async () => { apiClient.defaults.adapter = async config => { throw new axios.AxiosError('failed read', undefined, config, undefined, { data: {}, status: 503, statusText: 'Unavailable', headers: {}, config }); };await expect(readLowStock()).rejects.toThrow('failed read'); });
it('rejects previous-session successful read', async () => { apiClient.defaults.adapter = async config => { clearSessionQueries();return { data: [row], status: 200, statusText: 'OK', headers: {}, config }; };await expect(readLowStock()).rejects.toThrow('Previous session'); });
it('allows confirmed successful empty inventory', async () => { apiClient.defaults.adapter = async config => ({ data: [], status: 200, statusText: 'OK', headers: {}, config });expect(await readLowStock()).toEqual([]); });
