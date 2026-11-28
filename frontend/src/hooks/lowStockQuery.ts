import { apiClient } from '../api/client';
import type { Medication } from '../types/pharmacy';
export const lowStockQueryKey = ['medications', 'low-stock'] as const;
/** The server owns the stock<=threshold rule. Preserve its rows and order. */
export async function readLowStock(signal?: AbortSignal): Promise<Medication[]> {
  const response = await apiClient.get<unknown>('/medications/low-stock', { signal });
  if (response.status !== 200 || !Array.isArray(response.data) || !response.data.every(row => row && typeof row === 'object' && typeof row.id === 'string' && typeof row.name === 'string' && typeof row.unit === 'string' && Number.isInteger(row.currentStock) && Number.isInteger(row.reorderThreshold))) throw new Error('Unverified inventory response');
  return response.data;
}
