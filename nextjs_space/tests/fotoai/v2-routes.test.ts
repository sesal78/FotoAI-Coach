// /api/v2/* routes are thin wrappers over @fotoai/api handlers. This test also proves the
// live app's node test runner loads workspace packages (pnpm symlinks + type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GET as health } from '../../app/api/v2/health/route.ts';

// Dummy local env so routes that build deps can run without network (each test is self-contained).
process.env.FOTOAI_SUPABASE_URL ??= 'http://127.0.0.1:1';
process.env.FOTOAI_SUPABASE_ANON_KEY ??= 'test-anon';
process.env.FOTOAI_SUPABASE_SERVICE_ROLE_KEY ??= 'test-service';

test('GET /api/v2/health answers ok (the handler reads no env)', async () => {
  const res = await health();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', api: 'v2' });
});

test('GET /api/v2/me without a token is a 401 envelope (no network call)', async () => {
  const { GET: me } = await import('../../app/api/v2/me/route.ts');
  const res = await me(new Request('http://localhost/api/v2/me'));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Not authenticated', code: 'unauthenticated' });
});

test('GET /api/v2/me rejects a browser-supplied user id with 400', async () => {
  const { GET: me } = await import('../../app/api/v2/me/route.ts');
  const res = await me(new Request('http://localhost/api/v2/me?user_id=abc', { headers: { authorization: 'Bearer x' } }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'validation');
});

test('the 2D route modules load and answer 401 without a token (no network call)', async () => {
  const routes = [
    ['../../app/api/v2/conditions/route.ts', 'http://localhost/api/v2/conditions?lat=-37.8&lng=144.9'],
    ['../../app/api/v2/explore/nearby/route.ts', 'http://localhost/api/v2/explore/nearby?lat=-37.8&lng=144.9'],
    ['../../app/api/v2/explore/search/route.ts', 'http://localhost/api/v2/explore/search?q=beach'],
    ['../../app/api/v2/places/[placeId]/route.ts', 'http://localhost/api/v2/places/ChIJ0T2NLmJC1moRbU6M9oX9mWQ'],
    ['../../app/api/v2/places/[placeId]/photo/route.ts', 'http://localhost/api/v2/places/ChIJ0T2NLmJC1moRbU6M9oX9mWQ/photo'],
    ['../../app/api/v2/me/spots/route.ts', 'http://localhost/api/v2/me/spots'],
  ];
  for (const [path, url] of routes) {
    const { GET } = await import(path);
    const res = await GET(new Request(url), { params: { placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ' } });
    assert.equal(res.status, 401, path);
  }

  const { PATCH, DELETE } = await import('../../app/api/v2/me/spots/[id]/route.ts');
  const params = { params: { id: '11111111-2222-4333-8444-555555555555' } };
  assert.equal((await PATCH(new Request('http://localhost/api/v2/me/spots/x', { method: 'PATCH', body: '{}' }), params)).status, 401);
  assert.equal((await DELETE(new Request('http://localhost/api/v2/me/spots/x', { method: 'DELETE' }), params)).status, 401);
});
