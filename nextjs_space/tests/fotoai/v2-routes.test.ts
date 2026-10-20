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

test('the 2E-1 plan route modules load and answer 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const params = { params: { id, stepId: id } };
  const plans = await import('../../app/api/v2/plans/route.ts');
  assert.equal((await plans.GET(new Request('http://localhost/api/v2/plans'), params)).status, 401);
  assert.equal((await plans.POST(new Request('http://localhost/api/v2/plans', { method: 'POST', body: '{}' }), params)).status, 401);
  const one = await import('../../app/api/v2/plans/[id]/route.ts');
  assert.equal((await one.GET(new Request(`http://localhost/api/v2/plans/${id}`), params)).status, 401);
  assert.equal((await one.PATCH(new Request(`http://localhost/api/v2/plans/${id}`, { method: 'PATCH', body: '{}' }), params)).status, 401);
  const step = await import('../../app/api/v2/plans/[id]/steps/[stepId]/route.ts');
  assert.equal((await step.PATCH(new Request(`http://localhost/api/v2/plans/${id}/steps/${id}`, { method: 'PATCH', body: '{}' }), params)).status, 401);
});

test('the 2E-1 explain route modules load and answer 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const google = await import('../../app/api/v2/places/[placeId]/explain/route.ts');
  assert.equal((await google.GET(new Request('http://localhost/api/v2/places/x/explain'), { params: { placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ' } })).status, 401);
  const spot = await import('../../app/api/v2/me/spots/[id]/explain/route.ts');
  assert.equal((await spot.GET(new Request('http://localhost/api/v2/me/spots/x/explain'), { params: { id } })).status, 401);
});

test('the 2E-2a roll route modules load and answer 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const params = { params: { id } };
  const rolls = await import('../../app/api/v2/rolls/route.ts');
  assert.equal((await rolls.GET(new Request('http://localhost/api/v2/rolls'), params)).status, 401);
  assert.equal((await rolls.POST(new Request('http://localhost/api/v2/rolls', { method: 'POST', body: '{}' }), params)).status, 401);
  const one = await import('../../app/api/v2/rolls/[id]/route.ts');
  assert.equal((await one.GET(new Request(`http://localhost/api/v2/rolls/${id}`), params)).status, 401);
  assert.equal((await one.PATCH(new Request(`http://localhost/api/v2/rolls/${id}`, { method: 'PATCH', body: '{}' }), params)).status, 401);
  assert.equal((await one.DELETE(new Request(`http://localhost/api/v2/rolls/${id}`, { method: 'DELETE' }), params)).status, 401);
  const frames = await import('../../app/api/v2/rolls/[id]/frames/route.ts');
  assert.equal((await frames.POST(new Request(`http://localhost/api/v2/rolls/${id}/frames`, { method: 'POST', body: '{}' }), params)).status, 401);
});

test('the 2E-2a photo route modules load and answer 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const params = { params: { id } };
  const photos = await import('../../app/api/v2/photos/route.ts');
  assert.equal((await photos.GET(new Request('http://localhost/api/v2/photos'), params)).status, 401);
  assert.equal((await photos.POST(new Request('http://localhost/api/v2/photos', { method: 'POST', body: '{}' }), params)).status, 401);
  const confirm = await import('../../app/api/v2/photos/[id]/confirm/route.ts');
  assert.equal((await confirm.POST(new Request(`http://localhost/api/v2/photos/${id}/confirm`, { method: 'POST' }), params)).status, 401);
  const url = await import('../../app/api/v2/photos/[id]/url/route.ts');
  assert.equal((await url.GET(new Request(`http://localhost/api/v2/photos/${id}/url`), params)).status, 401);
});

test('the 2E-2a scans route module loads and answers 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const scans = await import('../../app/api/v2/rolls/[id]/scans/route.ts');
  assert.equal((await scans.POST(new Request(`http://localhost/api/v2/rolls/${id}/scans`, { method: 'POST', body: '{}' }), { params: { id } })).status, 401);
});

test('the 2E-2b challenge PATCH route answers 401 without a token (no network call)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const one = await import('../../app/api/v2/challenges/[id]/route.ts');
  const res = await one.PATCH(new Request(`http://localhost/api/v2/challenges/${id}`, { method: 'PATCH', body: '{"status":"accepted"}' }), { params: { id } });
  assert.equal(res.status, 401);
});

test('the 2E-2b coach route modules load and answer 401 without a token (no network call)', async () => {
  const coach = await import('../../app/api/v2/coach/route.ts');
  assert.equal((await coach.POST(new Request('http://localhost/api/v2/coach', { method: 'POST', body: '{}' }), { params: {} })).status, 401);
  const history = await import('../../app/api/v2/coach/history/route.ts');
  assert.equal((await history.GET(new Request('http://localhost/api/v2/coach/history'), { params: {} })).status, 401);
  assert.equal((await history.DELETE(new Request('http://localhost/api/v2/coach/history', { method: 'DELETE' }), { params: {} })).status, 401);
});

test('assetlinks.json names the FotoAI Android app and its EAS signing certificate (3B)', async () => {
  const { readFile } = await import('node:fs/promises');
  const file = new URL('../../public/.well-known/assetlinks.json', import.meta.url);
  const statements = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(statements.length, 1);
  assert.deepEqual(statements[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(statements[0].target.namespace, 'android_app');
  assert.equal(statements[0].target.package_name, 'com.topues.fotoai');
  assert.deepEqual(statements[0].target.sha256_cert_fingerprints, [
    '88:AB:10:E2:6B:F7:1D:7D:95:AF:A0:17:F4:00:20:42:92:B8:5D:74:80:6A:C0:64:D5:A3:DD:C9:06:A5:6A:4D',
  ]);
});

test('the 3B route modules load and answer 401 without a token (no network call)', async () => {
  const progress = await import('../../app/api/v2/me/progress/route.ts');
  assert.equal((await progress.GET(new Request('http://localhost/api/v2/me/progress'), { params: {} })).status, 401);
  const challenges = await import('../../app/api/v2/challenges/route.ts');
  assert.equal((await challenges.POST(new Request('http://localhost/api/v2/challenges', { method: 'POST', body: '{}' }), { params: {} })).status, 401);
  const id = { params: { id: '00000000-0000-4000-8000-000000000001' } };
  const analyse = await import('../../app/api/v2/photos/[id]/analyse/route.ts');
  assert.equal((await analyse.POST(new Request('http://localhost/api/v2/photos/x/analyse', { method: 'POST', body: '{"mode":"critique"}' }), id)).status, 401);
  const analyses = await import('../../app/api/v2/photos/[id]/analyses/route.ts');
  assert.equal((await analyses.GET(new Request('http://localhost/api/v2/photos/x/analyses'), id)).status, 401);
});
