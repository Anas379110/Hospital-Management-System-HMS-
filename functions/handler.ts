import { Hono } from 'hono';
export function createCleanupHandler(run: () => Promise<void>) {
  const app = new Hono();
  app.post('/', async c => {
    // Deploy only behind Neon's edge, which strips client-supplied X-Neon-*.
    // This check is not authentication when hosted on another platform.
    if (!c.req.header('x-neon-trigger-invocation-id')) return c.json({ error: 'Unauthorized' }, 401);
    // The DB clock and fixed SQL decide expiry; never trust request IDs/times.
    await run();
    return c.json({ ok: true });
  });
  return app;
}
