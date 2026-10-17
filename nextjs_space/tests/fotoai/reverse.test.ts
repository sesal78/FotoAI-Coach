// /api/fotoai/reverse — owner-scoped reverse engineering.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createReverseHandlers } from '../../lib/fotoai/handlers/reverse.ts';
import { createFotoaiReverseAnalysis, listFotoaiReverseAnalyses } from '../../lib/fotoai/client-ai.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB, nextUuid } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';
import { formKeys, jpeg, multipartRequest, raw, recordingFetch } from './ai-test-utils.ts';

const T = 'fotoai_reverse_analyses';
const RESULT = { shotRecipe: ['step 1'], gearNeeded: ['tripod'] };
const ALICE_COOKIE = cookieFor(TOKEN_ALICE);

let deps: TestDeps;
let h: ReturnType<typeof createReverseHandlers>;

function featureKey(owner: string, rowId: string): string {
  return `${owner}/reverse/${rowId}/${nextUuid()}.jpg`;
}

beforeEach(() => {
  deps = createTestDeps();
  h = createReverseHandlers(() => deps);
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'advanced' });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Canon', model: 'R5', created_at: '2026-01-01' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'camera', brand: 'Nikon', model: 'Z9', created_at: '2026-01-01' });
  deps.fakes.reverseEngineerPhoto = () => RESULT;
});

test('reverse POST: owner success stores the photo under the new row id and returns a signed photoUrl', async () => {
  const res = await h.create(multipartRequest('/api/fotoai/reverse', [['photo', jpeg()]], ALICE_COOKIE));
  assert.equal(res.status, 201);
  const { analysis } = await res.json();

  const rows = deps.client.tables.get(T)!;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, analysis.id);
  assert.equal(rows[0].user_id, ALICE);
  assert.ok(rows[0].photo_object_key.startsWith(`${ALICE}/reverse/${analysis.id}/`));
  assert.deepEqual(analysis.result, RESULT);
  assert.ok(analysis.photoUrl.includes(rows[0].photo_object_key));
  assert.ok(analysis.analysisDate);
  assert.equal('userId' in analysis, false);

  const call = deps.calls.find((c) => c.name === 'reverseEngineerPhoto')!;
  const input = call.args[0] as any;
  assert.equal(input.skillLevel, 'advanced');
  assert.deepEqual(input.gear, ['Canon R5']); // Bob's gear never leaks in
  assert.match(input.imageDataUri, /^data:image\/jpeg;base64,/);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['upload', 'sign']);
});

test('reverse GET: lists only own rows and signs only own keys', async () => {
  const aliceId = nextUuid();
  const bobId = nextUuid();
  deps.client.seed(T, { id: aliceId, user_id: ALICE, photo_object_key: featureKey(ALICE, aliceId), result: RESULT, analysis_date: '2026-10-01T00:00:00Z' });
  deps.client.seed(T, { id: bobId, user_id: BOB, photo_object_key: featureKey(BOB, bobId), result: RESULT, analysis_date: '2026-10-02T00:00:00Z' });

  const res = await h.list(request('/api/fotoai/reverse', { cookie: ALICE_COOKIE }));
  assert.equal(res.status, 200);
  const { analyses } = await res.json();
  assert.deepEqual(analyses.map((a: any) => a.id), [aliceId]);
  assert.ok(analyses[0].photoUrl.includes(`${ALICE}/reverse/${aliceId}/`));
  assert.ok(deps.client.serviceCalls.every((c) => c.op === 'sign' && c.keys.every((k) => k.startsWith(ALICE))));

  // Bob sees only his own row; Alice's key is never signed for him.
  deps.client.serviceCalls.length = 0;
  const bobRes = await h.list(request('/api/fotoai/reverse', { cookie: cookieFor(TOKEN_BOB) }));
  assert.deepEqual((await bobRes.json()).analyses.map((a: any) => a.id), [bobId]);
  assert.ok(deps.client.serviceCalls.every((c) => c.keys.every((k) => k.startsWith(BOB))));
});

test('reverse: a row whose key is not under the caller is never signed (photoUrl null)', async () => {
  const id = nextUuid();
  // Row says Alice owns it but the key points at Bob's prefix.
  deps.client.seed(T, { id, user_id: ALICE, photo_object_key: featureKey(BOB, id), result: RESULT, analysis_date: '2026-10-01T00:00:00Z' });
  const res = await h.list(request('/api/fotoai/reverse', { cookie: ALICE_COOKIE }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).analyses[0].photoUrl, null);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('reverse: userId in query or form is rejected (400) before any service call', async () => {
  const q = await h.list(request(`/api/fotoai/reverse?userId=${BOB}`, { cookie: ALICE_COOKIE }));
  assert.equal(q.status, 400);
  const qp = await h.create(multipartRequest(`/api/fotoai/reverse?userId=${BOB}`, [['photo', jpeg()]], ALICE_COOKIE));
  assert.equal(qp.status, 400);
  const f = await h.create(multipartRequest('/api/fotoai/reverse', [['userId', BOB], ['photo', jpeg()]], ALICE_COOKIE));
  assert.equal(f.status, 400);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('reverse: no cookie -> 401', async () => {
  assert.equal((await h.list(request('/api/fotoai/reverse'))).status, 401);
  assert.equal((await h.create(multipartRequest('/api/fotoai/reverse', [['photo', jpeg()]]))).status, 401);
  assert.deepEqual(deps.calls, []);
});

test('reverse: invalid input -> 400 (missing photo, bad limit, bad extension, unreadable RAW)', async () => {
  assert.equal((await h.create(multipartRequest('/api/fotoai/reverse', [['note', 'x']], ALICE_COOKIE))).status, 400);
  assert.equal((await h.list(request('/api/fotoai/reverse?limit=abc', { cookie: ALICE_COOKIE }))).status, 400);
  assert.equal((await h.list(request('/api/fotoai/reverse?limit=0', { cookie: ALICE_COOKIE }))).status, 400);
  assert.equal((await h.create(multipartRequest('/api/fotoai/reverse', [['photo', { ...jpeg('a.gif'), type: 'image/gif' }]], ALICE_COOKIE))).status, 400);
  const rawRes = await h.create(multipartRequest('/api/fotoai/reverse', [['photo', raw()]], ALICE_COOKIE));
  assert.equal(rawRes.status, 400);
  assert.match((await rawRes.json()).error, /RAW files/);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('reverse: LLM failure -> 502, nothing stored', async () => {
  deps.fakes.reverseEngineerPhoto = () => { throw new Error('model down'); };
  const res = await h.create(multipartRequest('/api/fotoai/reverse', [['photo', jpeg()]], ALICE_COOKIE));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'upstream');
  assert.deepEqual(deps.client.serviceCalls, []);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);
});

test('reverse: insert failure removes the uploaded photo', async () => {
  const realInsert = deps.client.restInsert.bind(deps.client);
  deps.client.restInsert = (async (table: string, row: Record<string, unknown>, token: string) => {
    if (table === T) throw new Error('insert failed');
    return realInsert(table, row, token);
  }) as typeof deps.client.restInsert;
  const res = await h.create(multipartRequest('/api/fotoai/reverse', [['photo', jpeg()]], ALICE_COOKIE));
  assert.equal(res.status, 500);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['upload', 'remove']);
  assert.equal(deps.client.objects.size, 0);
});

test('reverse client: session-only URLs, no userId in the form', async () => {
  const { calls, fetcher } = recordingFetch((url) => (url.includes('?') ? { analyses: [] } : { analysis: { id: 'x' } }));
  await listFotoaiReverseAnalyses(5, fetcher);
  await createFotoaiReverseAnalysis(new File([jpeg().bytes], 'shot.jpg', { type: 'image/jpeg' }), fetcher);
  assert.deepEqual(calls.map((c) => c.url), ['/api/fotoai/reverse?limit=5', '/api/fotoai/reverse']);
  assert.deepEqual(formKeys(calls[1].init), ['photo']);
});
