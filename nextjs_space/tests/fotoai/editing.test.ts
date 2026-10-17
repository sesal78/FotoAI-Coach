// /api/fotoai/editing — owner-scoped editing recipes.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createEditingHandlers } from '../../lib/fotoai/handlers/editing.ts';
import { createFotoaiEditingRecipe, listFotoaiEditingRecipes } from '../../lib/fotoai/client-ai.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB, nextUuid } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';
import { formKeys, jpeg, multipartRequest, raw, recordingFetch } from './ai-test-utils.ts';

const T = 'fotoai_editing_recipes';
const RECIPE = { editingApproach: 'Warm film look', adjustmentsDetected: [], difficultyLevel: 'beginner' };
const ALICE_COOKIE = cookieFor(TOKEN_ALICE);
const URL_ = '/api/fotoai/editing';

let deps: TestDeps;
let h: ReturnType<typeof createEditingHandlers>;

const key = (owner: string, rowId: string) => `${owner}/editing/${rowId}/${nextUuid()}.jpg`;
const pair = (): Array<[string, ReturnType<typeof jpeg>]> => [['originalPhoto', jpeg('orig.jpg')], ['editedPhoto', jpeg('edit.jpg')]];

beforeEach(() => {
  deps = createTestDeps();
  h = createEditingHandlers(() => deps);
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'beginner' });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'lens', brand: 'Sigma', model: '35mm', created_at: '2026-01-01' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'lens', brand: 'Zeiss', model: '50mm', created_at: '2026-01-01' });
  deps.fakes.generateEditingRecipe = () => RECIPE;
});

test('editing POST: owner success stores both photos under the new row id with signed URLs', async () => {
  const res = await h.create(multipartRequest(URL_, pair(), ALICE_COOKIE));
  assert.equal(res.status, 201);
  const { recipe } = await res.json();

  const [row] = deps.client.tables.get(T)!;
  assert.equal(row.id, recipe.id);
  assert.equal(row.user_id, ALICE);
  assert.ok(row.original_photo_object_key.startsWith(`${ALICE}/editing/${recipe.id}/`));
  assert.ok(row.edited_photo_object_key.startsWith(`${ALICE}/editing/${recipe.id}/`));
  assert.notEqual(row.original_photo_object_key, row.edited_photo_object_key);
  assert.ok(recipe.originalPhotoUrl.includes(row.original_photo_object_key));
  assert.ok(recipe.editedPhotoUrl.includes(row.edited_photo_object_key));
  assert.deepEqual(recipe.recipe, RECIPE);
  assert.equal('userId' in recipe, false);

  const input = deps.calls.find((c) => c.name === 'generateEditingRecipe')!.args[0] as any;
  assert.equal(input.skillLevel, 'beginner');
  assert.deepEqual(input.gear, ['Sigma 35mm']);
  assert.match(input.originalImageDataUri, /^data:image\/jpeg;base64,/);
  assert.match(input.editedImageDataUri, /^data:image\/jpeg;base64,/);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['upload', 'upload', 'sign', 'sign']);
});

test('editing GET: lists only own rows and signs only own keys', async () => {
  const a = nextUuid();
  const b = nextUuid();
  deps.client.seed(T, { id: a, user_id: ALICE, original_photo_object_key: key(ALICE, a), edited_photo_object_key: null, recipe: RECIPE, analysis_date: '2026-10-01T00:00:00Z' });
  deps.client.seed(T, { id: b, user_id: BOB, original_photo_object_key: key(BOB, b), edited_photo_object_key: key(BOB, b), recipe: RECIPE, analysis_date: '2026-10-02T00:00:00Z' });

  const res = await h.list(request(URL_, { cookie: ALICE_COOKIE }));
  assert.equal(res.status, 200);
  const { recipes } = await res.json();
  assert.deepEqual(recipes.map((r: any) => r.id), [a]);
  assert.ok(recipes[0].originalPhotoUrl.includes(ALICE));
  assert.equal(recipes[0].editedPhotoUrl, null);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['sign']);
  assert.ok(deps.client.serviceCalls[0].keys[0].startsWith(ALICE));

  deps.client.serviceCalls.length = 0;
  const bob = await (await h.list(request(URL_, { cookie: cookieFor(TOKEN_BOB) }))).json();
  assert.deepEqual(bob.recipes.map((r: any) => r.id), [b]);
  assert.ok(deps.client.serviceCalls.every((c) => c.keys.every((k) => k.startsWith(BOB))));
});

test('editing: userId in query or form is rejected (400) before any service call', async () => {
  assert.equal((await h.list(request(`${URL_}?user_id=${BOB}`, { cookie: ALICE_COOKIE }))).status, 400);
  assert.equal((await h.create(multipartRequest(`${URL_}?userId=${BOB}`, pair(), ALICE_COOKIE))).status, 400);
  assert.equal((await h.create(multipartRequest(URL_, [['userId', BOB], ...pair()], ALICE_COOKIE))).status, 400);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('editing: no cookie -> 401', async () => {
  assert.equal((await h.list(request(URL_))).status, 401);
  assert.equal((await h.create(multipartRequest(URL_, pair()))).status, 401);
});

test('editing: invalid input -> 400 (one photo missing, bad limit, unreadable RAW)', async () => {
  const one = await h.create(multipartRequest(URL_, [['originalPhoto', jpeg()]], ALICE_COOKIE));
  assert.equal(one.status, 400);
  assert.match((await one.json()).error, /Both originalPhoto and editedPhoto/);
  assert.equal((await h.list(request(`${URL_}?limit=999`, { cookie: ALICE_COOKIE }))).status, 400);
  const rawRes = await h.create(multipartRequest(URL_, [['originalPhoto', raw()], ['editedPhoto', jpeg()]], ALICE_COOKIE));
  assert.equal(rawRes.status, 400);
  assert.match((await rawRes.json()).error, /export both photos as JPEG or PNG/);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('editing: LLM failure -> 502, nothing stored', async () => {
  deps.fakes.generateEditingRecipe = () => { throw new Error('model down'); };
  const res = await h.create(multipartRequest(URL_, pair(), ALICE_COOKIE));
  assert.equal(res.status, 502);
  assert.deepEqual(deps.client.serviceCalls, []);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);
});

test('editing: second upload failure removes the first photo', async () => {
  const realUpload = deps.client.storageUploadAsService.bind(deps.client);
  let n = 0;
  deps.client.storageUploadAsService = async (k, bytes, type) => {
    n += 1;
    if (n === 2) throw new Error('storage down');
    return realUpload(k, bytes, type);
  };
  const res = await h.create(multipartRequest(URL_, pair(), ALICE_COOKIE));
  assert.equal(res.status, 500);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['upload', 'remove']);
  assert.equal(deps.client.objects.size, 0);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);
});

test('editing client: session-only URLs, no userId in the form', async () => {
  const { calls, fetcher } = recordingFetch((url) => (url.includes('?') ? { recipes: [] } : { recipe: { id: 'x' } }));
  await listFotoaiEditingRecipes(3, fetcher);
  const f = new File([jpeg().bytes], 'a.jpg', { type: 'image/jpeg' });
  await createFotoaiEditingRecipe(f, f, fetcher);
  assert.deepEqual(calls.map((c) => c.url), ['/api/fotoai/editing?limit=3', '/api/fotoai/editing']);
  assert.deepEqual(formKeys(calls[1].init), ['originalPhoto', 'editedPhoto']);
});
