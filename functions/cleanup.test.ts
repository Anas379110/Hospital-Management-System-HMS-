import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCleanupHandler } from './handler';
test('unmarked public calls cannot run cleanup', async () => {
  let runs = 0;
  const app = createCleanupHandler(async () => { runs++; });
  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await app.request('/', { method });
    assert.equal(response.status, method === 'POST' ? 401 : 404);
  }
  assert.equal(runs, 0);
});
test('marked delivery runs fixed cleanup and ignores visitor-provided deletion instructions', async () => {
  let runs = 0;
  const app = createCleanupHandler(async () => { runs++; });
  for (let i = 0; i < 2; i++) {
    const response = await app.request('/', {method: 'POST', headers: {'x-neon-trigger-invocation-id':'test-only-platform-marker'}, body: JSON.stringify({workspace:'do-not-use', timestamp:'2099-01-01'})});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok:true});
  }
  assert.equal(runs, 2); // SQL cleanup is idempotent; handler does not accept targets.
});
test('failed DB work never reports success', async () => {
  const app = createCleanupHandler(async () => { throw new Error('test-only failure'); });
  app.onError((_err,c) => c.json({ok:false},500));
  const response = await app.request('/', {method:'POST',headers:{'x-neon-trigger-invocation-id':'test-only-platform-marker'}});
  assert.equal(response.status,500);
});
