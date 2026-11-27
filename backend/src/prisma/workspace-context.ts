import { AsyncLocalStorage } from 'node:async_hooks';
export const workspaceContext = new AsyncLocalStorage<string>();
export const demoMode = () => process.env.HMS_PUBLIC_DEMO === 'true';
