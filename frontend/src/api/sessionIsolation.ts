import type { QueryClient } from '@tanstack/react-query';
let epoch = 0;
let client: QueryClient | undefined;
export function installSessionQueryClient(value: QueryClient) { client = value; }
export function sessionEpoch() { return epoch; }
/** Cancel observers before clearing. Late API replies from any prior epoch are rejected. */
export function clearSessionQueries() {
 epoch++;
 if (client) { void client.cancelQueries(); client.clear(); }
}
export function isCurrentSession(value: number | undefined) { return value === epoch; }

const responseEpochs = new WeakMap<object, number>();
export function stampResponse(value: unknown, valueEpoch: number | undefined) { if(value && typeof value === 'object' && valueEpoch !== undefined) responseEpochs.set(value, valueEpoch); }
export function responseIsCurrent(value: object) { return isCurrentSession(responseEpochs.get(value)); }
