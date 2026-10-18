// /api/v2/* routes are thin wrappers over @fotoai/api handlers. This test also proves the
// live app's node test runner loads workspace packages (pnpm symlinks + type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GET as health } from '../../app/api/v2/health/route.ts';

test('GET /api/v2/health answers ok without any FotoAI env', async () => {
  const res = await health();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', api: 'v2' });
});
