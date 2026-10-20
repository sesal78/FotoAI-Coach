import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createCritique, visionMimeForUpload } from '../../lib/fotoai/critiques.ts';
import { FotoaiUpstreamError } from '../../lib/fotoai/errors.ts';
import { createCritiqueHandlers } from '../../lib/fotoai/handlers/critiques.ts';
import { createFotoaiCritique, getFotoaiCritique, listFotoaiCritiques } from '../../lib/fotoai/client-features.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';

let deps: TestDeps;
let h: ReturnType<typeof createCritiqueHandlers>;

const alice = cookieFor(TOKEN_ALICE);
const OWNER_KEYS = ['userId', 'user_id', 'userid', 'ownerId', 'owner_id'];
const T = 'fotoai_photo_critiques';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 6]);
const RAW = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 7, 8]);

const GOOD_RESULT = {
  technicalScore: 82,
  compositionScore: 75.6,
  creativeScore: 40,
  overallScore: 68,
  technicalFeedback: 'Sharp focus.',
  compositionFeedback: 'Nice lines.',
  creativeFeedback: 'Needs a story.',
  strengths: ['focus', 'lines', 7],
  improvements: ['story', ''],
  suggestedSettings: 'f/8, 1/250',
};

beforeEach(() => {
  deps = createTestDeps();
  h = createCritiqueHandlers(() => deps);
  deps.fakes.critiquePhoto = () => ({ ...GOOD_RESULT });
});

interface TestFile { name: string; type: string; bytes: Uint8Array }

/** Multipart body with Content-Length, the way a browser sends FormData. */
function multipart(fields: Record<string, string | TestFile>): { body: Uint8Array; headers: Record<string, string> } {
  const boundary = 'fotoai-critique-test-boundary';
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    } else {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.name}"\r\nContent-Type: ${v.type}\r\n\r\n`));
      chunks.push(v.bytes);
      chunks.push(enc.encode('\r\n'));
    }
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { body.set(c, off); off += c.byteLength; }
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(total) } };
}

function post(fields: Record<string, string | TestFile>, opts: { cookie?: string; query?: string } = {}) {
  return h.create(request(`/api/fotoai/critiques${opts.query ?? ''}`, {
    method: 'POST',
    cookie: opts.cookie ?? alice,
    ...multipart(fields),
  }));
}

function seedSubmission(userId: string, ext = 'jpg') {
  const challenge = deps.client.seed('fotoai_daily_challenges', { user_id: userId, challenge_type: 'LUNCH_MICRO', challenge_text: 'Shoot shadows', status: 'completed', issued_date: '2026-10-01' });
  const sub = deps.client.seed('fotoai_challenge_submissions', { user_id: userId, challenge_id: challenge.id, notes: '', feedback_status: 'ready', submitted_at: '2026-10-02T00:00:00Z' });
  sub.photo_object_key = `${userId}/submissions/${sub.id}/abcd-1234.${ext}`;
  return sub;
}

function seedCritique(userId: string, overrides: Record<string, unknown> = {}) {
  const row = deps.client.seed(T, {
    user_id: userId,
    submission_id: null,
    technical_score: 50, composition_score: 60, creative_score: 70, overall_score: 60,
    technical_feedback: 't', composition_feedback: 'c', creative_feedback: 'cr',
    strengths: ['s'], improvements: ['i'], suggested_settings: null,
    critique_date: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });
  if (!row.photo_object_key) row.photo_object_key = `${userId}/critiques/${row.id}/abcd.jpg`;
  return row;
}

const ops = (op: string) => deps.client.serviceCalls.filter((c) => c.op === op);

// ---------------------------------------------------------------------------
// identity
// ---------------------------------------------------------------------------

test('critiques: every route is 401 without a session and calls nothing', async () => {
  const id = ALICE;
  const responses = [
    await h.list(request('/api/fotoai/critiques')),
    await h.get(request(`/api/fotoai/critiques/${id}`), { params: { id } }),
    await post({ photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } }, { cookie: '' }),
  ];
  for (const res of responses) assert.equal(res.status, 401);
  assert.equal(deps.calls.length, 0);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('critiques: an owner alias in query or form is 400 before any upload or LLM call', async () => {
  for (const key of OWNER_KEYS) {
    const cases = [
      await h.list(request(`/api/fotoai/critiques?${key}=${BOB}`, { cookie: alice })),
      await h.get(request(`/api/fotoai/critiques/${ALICE}?${key}=${BOB}`, { cookie: alice }), { params: { id: ALICE } }),
      await post({ photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } }, { query: `?${key}=${BOB}` }),
      await post({ [key]: BOB, photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } }),
    ];
    for (const res of cases) {
      assert.equal(res.status, 400, key);
      assert.equal((await res.json()).code, 'validation');
    }
  }
  assert.equal(deps.calls.length, 0);
  assert.equal(deps.client.serviceCalls.length, 0);
});

// ---------------------------------------------------------------------------
// POST with an uploaded photo
// ---------------------------------------------------------------------------

test('critiques POST photo: stores under the owner prefix, sends a data URL with prefs + gear, awards XP', async () => {
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'beginner', photography_interests: [] });
  deps.client.seed('fotoai_user_preferences', { user_id: BOB, skill_level: 'professional', photography_interests: [] });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Fujifilm', model: 'X-T5' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'camera', brand: 'Leica', model: 'M11' });

  const res = await post({ photo: { name: 'Shot.JPG', type: 'image/jpeg', bytes: JPEG }, challengeText: '  Golden hour  ' });
  assert.equal(res.status, 201);
  const { critique } = await res.json();

  const rows = deps.client.tables.get(T)!;
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.id, critique.id);
  assert.equal(row.user_id, ALICE);
  assert.equal(row.submission_id, null);
  assert.match(row.photo_object_key, new RegExp(`^${ALICE}/critiques/${critique.id}/[a-z0-9-]+\\.jpg$`));
  assert.ok(deps.client.objects.has(row.photo_object_key));
  assert.equal(row.technical_score, 82);
  assert.equal(row.composition_score, 76, 'scores are rounded integers');
  assert.deepEqual(row.strengths, ['focus', 'lines']);
  assert.deepEqual(row.improvements, ['story']);
  assert.equal(row.suggested_settings, 'f/8, 1/250');

  const llm = deps.calls.filter((c) => c.name === 'critiquePhoto');
  assert.equal(llm.length, 1);
  const ctx = llm[0].args[0] as any;
  assert.equal(ctx.imageDataUri, `data:image/jpeg;base64,${Buffer.from(JPEG).toString('base64')}`);
  assert.equal(ctx.skillLevel, 'beginner');
  assert.deepEqual(ctx.gear, ['Fujifilm X-T5']);
  assert.equal(ctx.challengeText, 'Golden hour');

  assert.deepEqual(ops('upload').map((c) => c.keys[0]), [row.photo_object_key]);
  assert.ok(ops('rpc').length > 0, 'technical score 82 > 70 awards critique XP');
  const xpEvents = deps.client.tables.get('fotoai_xp_events') ?? [];
  assert.ok(xpEvents.every((e) => e.user_id === ALICE && e.source_kind === 'critique_bonus' && e.source_id === critique.id));

  assert.deepEqual(Object.keys(critique).sort(), [
    'compositionFeedback', 'compositionScore', 'creativeFeedback', 'creativeScore', 'critiqueDate', 'id',
    'improvements', 'overallScore', 'photoUrl', 'strengths', 'submissionId', 'suggestedSettings',
    'technicalFeedback', 'technicalScore',
  ]);
  assert.equal(critique.submissionId, null);
  assert.equal(critique.technicalScore, 82);
  assert.ok(critique.photoUrl.includes(row.photo_object_key), 'photoUrl is a signed URL for the own key');
  assert.equal('userId' in critique, false);
});

test('critiques POST photo: RAW bytes are 400 before anything is stored or sent', async () => {
  const res = await post({ photo: { name: 'IMG_1.CR2', type: 'image/x-canon-cr2', bytes: RAW } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /RAW files cannot be analysed/);
  const res2 = await post({ photo: { name: 'pic.heic', type: 'image/heic', bytes: RAW } });
  assert.equal(res2.status, 400);
  assert.equal(deps.calls.length, 0);
  assert.equal(deps.client.serviceCalls.length, 0);
  assert.equal(deps.client.objects.size, 0);
});

test('critiques POST photo: a RAW extension holding JPEG/PNG bytes is accepted with the detected MIME', async () => {
  const res = await post({ photo: { name: 'IMG_2.nef', type: 'application/octet-stream', bytes: JPEG } });
  assert.equal(res.status, 201);
  assert.match((deps.calls[0].args[0] as any).imageDataUri, /^data:image\/jpeg;base64,/);
  assert.equal(visionMimeForUpload({ name: 'x.dng', type: 'application/octet-stream' }, PNG), 'image/png');
  assert.equal(visionMimeForUpload({ name: 'x.webp', type: 'image/webp' }, new Uint8Array([1, 2])), 'image/webp');
});

test('critiques POST: LLM failure is a clean 502, no row is saved and the uploaded photo is removed', async () => {
  deps.fakes.critiquePhoto = () => { throw new Error('LLM API error: 500 - secret-ish body'); };
  const res = await post({ photo: { name: 'a.png', type: 'image/png', bytes: PNG } });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'Upstream service error', code: 'upstream' });
  assert.equal((deps.client.tables.get(T) ?? []).length, 0);
  const uploaded = ops('upload').map((c) => c.keys[0]);
  assert.equal(uploaded.length, 1);
  assert.deepEqual(ops('remove').map((c) => c.keys[0]), uploaded);
  assert.equal(deps.client.objects.size, 0);
  assert.equal(ops('rpc').length, 0);
});

test('critiques POST: a non-object LLM answer is 502; an insert failure also removes the photo', async () => {
  deps.fakes.critiquePhoto = () => 'not json';
  assert.equal((await post({ photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } })).status, 502);

  deps.fakes.critiquePhoto = () => ({ ...GOOD_RESULT });
  const restInsert = deps.client.restInsert.bind(deps.client);
  deps.client.restInsert = (async (table: string, ...rest: [any, string]) => {
    if (table === T) throw new FotoaiUpstreamError(500, 'insert failed');
    return restInsert(table, ...rest);
  }) as typeof deps.client.restInsert;
  const res = await post({ photo: { name: 'b.jpg', type: 'image/jpeg', bytes: JPEG } });
  assert.equal(res.status, 502);
  assert.equal(ops('remove').length, 2);
  assert.equal(deps.client.objects.size, 0);
});

test('critiques POST: an XP failure keeps the saved critique', async () => {
  deps.xp.awardCritiqueXP = async () => { throw new Error('rpc down'); };
  const res = await post({ photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } });
  assert.equal(res.status, 201);
  assert.equal(deps.client.tables.get(T)!.length, 1);
  assert.ok(deps.logs.some((l) => l.level === 'warn' && /XP award/.test(l.message)));
});

test('critiques POST: invalid input is 400', async () => {
  const sub = seedSubmission(ALICE);
  const cases: Array<Record<string, string | TestFile>> = [
    {},
    { challengeText: 'only text' },
    { submissionId: 'not-a-uuid' },
    { submissionId: sub.id, photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG } },
    { photo: { name: 'a.gif', type: 'image/gif', bytes: JPEG } },
    { photo: { name: 'a.jpg', type: 'image/jpeg', bytes: JPEG }, challengeText: 'x'.repeat(2001) },
    { submissionId: { name: 'id.txt', type: 'text/plain', bytes: new Uint8Array([1]) } },
  ];
  for (const fields of cases) {
    const res = await post(fields);
    assert.equal(res.status, 400, JSON.stringify(Object.keys(fields)));
  }
  assert.equal(deps.calls.length, 0);
  assert.equal(ops('upload').length, 0);
});

// ---------------------------------------------------------------------------
// POST with an existing submission
// ---------------------------------------------------------------------------

test('critiques POST submissionId: signs the own submission photo for the LLM and reuses its key', async () => {
  const sub = seedSubmission(ALICE);
  const res = await post({ submissionId: sub.id });
  assert.equal(res.status, 201);
  const { critique } = await res.json();
  const row = deps.client.tables.get(T)![0];
  assert.equal(row.submission_id, sub.id);
  assert.equal(row.photo_object_key, sub.photo_object_key);
  assert.equal(critique.submissionId, sub.id);
  assert.equal(ops('upload').length, 0, 'no new object for a submission critique');
  const ctx = deps.calls[0].args[0] as any;
  assert.ok(ctx.imageDataUri.startsWith('https://supabase.test.invalid/storage/v1/object/sign/'));
  assert.ok(ctx.imageDataUri.includes(sub.photo_object_key));
  assert.ok(ctx.imageDataUri.includes('expires=120'));
});

test('critiques POST submissionId: another user\'s submission is 404 with no sign, upload or LLM call', async () => {
  const bobSub = seedSubmission(BOB);
  const res = await post({ submissionId: bobSub.id });
  assert.equal(res.status, 404);
  assert.equal(deps.calls.length, 0);
  assert.equal(deps.client.serviceCalls.length, 0);
  assert.equal((deps.client.tables.get(T) ?? []).length, 0);
});

test('critiques POST submissionId: no photo or a RAW photo is 400 without signing', async () => {
  const noPhoto = seedSubmission(ALICE);
  noPhoto.photo_object_key = null;
  const r1 = await post({ submissionId: noPhoto.id });
  assert.equal(r1.status, 400);
  assert.match((await r1.json()).error, /no photo/);
  const raw = seedSubmission(ALICE, 'cr3');
  const r2 = await post({ submissionId: raw.id });
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).error, /RAW file/);
  assert.equal(deps.client.serviceCalls.length, 0);
  assert.equal(deps.calls.length, 0);
});

test('createCritique is reusable outside the route (auto-critique)', async () => {
  const sub = seedSubmission(ALICE);
  const { critique, xp } = await createCritique(deps, { userId: ALICE, accessToken: TOKEN_ALICE }, { submissionId: sub.id, challengeText: 'Shoot shadows' });
  assert.equal(critique.user_id, ALICE);
  assert.equal(critique.submission_id, sub.id);
  assert.ok(Array.isArray(xp));
  await assert.rejects(
    createCritique(deps, { userId: BOB, accessToken: TOKEN_BOB }, { submissionId: sub.id }),
    (err: any) => err.status === 404,
  );
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

test('critiques GET list: own rows only, newest first, signed photo URLs, submission filter', async () => {
  const sub = seedSubmission(ALICE);
  seedCritique(ALICE, { critique_date: '2026-10-01T00:00:00.000Z' });
  const linked = seedCritique(ALICE, { critique_date: '2026-10-03T00:00:00.000Z', submission_id: sub.id, photo_object_key: sub.photo_object_key });
  seedCritique(BOB, { critique_date: '2026-10-05T00:00:00.000Z' });

  const res = await h.list(request('/api/fotoai/critiques', { cookie: alice }));
  assert.equal(res.status, 200);
  const { critiques } = await res.json();
  assert.equal(critiques.length, 2);
  assert.equal(critiques[0].id, linked.id);
  assert.equal(critiques[0].submissionId, sub.id);
  assert.equal(critiques[1].submissionId, null);
  assert.equal(critiques[1].suggestedSettings, '');
  assert.ok(critiques.every((c: any) => c.photoUrl.includes(`/${ALICE}/`)));
  assert.ok(ops('sign').every((c) => c.keys[0].startsWith(`${ALICE}/`)));
  assert.equal(JSON.stringify(critiques).includes(BOB), false);

  const filtered = await (await h.list(request(`/api/fotoai/critiques?submissionId=${sub.id}`, { cookie: alice }))).json();
  assert.deepEqual(filtered.critiques.map((c: any) => c.id), [linked.id]);
});

test('critiques GET list: bad submissionId or limit is 400; a key that fails signing gives photoUrl null', async () => {
  assert.equal((await h.list(request('/api/fotoai/critiques?submissionId=nope', { cookie: alice }))).status, 400);
  assert.equal((await h.list(request('/api/fotoai/critiques?limit=0', { cookie: alice }))).status, 400);
  seedCritique(ALICE, { photo_object_key: `${BOB}/critiques/${BOB}/x.jpg` });
  const res = await h.list(request('/api/fotoai/critiques', { cookie: alice }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).critiques[0].photoUrl, null);
  assert.equal(ops('sign').length, 0, 'a key under another owner is never signed');
});

test('critiques GET [id]: own row 200; another user\'s row 404 with no signing; bad id 400', async () => {
  const mine = seedCritique(ALICE);
  const bobs = seedCritique(BOB);
  const ok = await h.get(request(`/api/fotoai/critiques/${mine.id}`, { cookie: alice }), { params: { id: mine.id } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).critique.id, mine.id);

  deps.client.serviceCalls.length = 0;
  const denied = await h.get(request(`/api/fotoai/critiques/${bobs.id}`, { cookie: alice }), { params: { id: bobs.id } });
  assert.equal(denied.status, 404);
  assert.equal(deps.client.serviceCalls.length, 0);

  const bad = await h.get(request('/api/fotoai/critiques/x', { cookie: alice }), { params: { id: 'x' } });
  assert.equal(bad.status, 400);
});

test('critiques GET: a Supabase failure is a clean 502', async () => {
  deps.client.restSelect = async () => { throw new FotoaiUpstreamError(500, 'down'); };
  const res = await h.list(request('/api/fotoai/critiques', { cookie: alice }));
  assert.equal(res.status, 502);
});

// ---------------------------------------------------------------------------
// browser fetchers
// ---------------------------------------------------------------------------

test('client: critique fetchers send no identity and map the API shape', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const apiCritique = { id: 'c1', submissionId: null, photoUrl: null, technicalScore: 1, compositionScore: 2, creativeScore: 3, overallScore: 2, technicalFeedback: 't', compositionFeedback: 'c', creativeFeedback: 'r', strengths: ['s'], improvements: [], suggestedSettings: '', critiqueDate: 'd' };
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (init?.method === 'POST' || String(input).includes('/critiques/')) return Response.json({ critique: apiCritique });
    return Response.json({ critiques: [apiCritique] });
  };
  const list = await listFotoaiCritiques({ submissionId: ALICE, limit: 5 }, fetcher);
  const one = await getFotoaiCritique('c1', fetcher);
  const photo = new File([JPEG], 'a.jpg', { type: 'image/jpeg' });
  const created = await createFotoaiCritique({ photo }, fetcher);

  assert.equal(list[0].photoUrl, '');
  assert.equal(list[0].submissionId, undefined);
  assert.equal(one.id, 'c1');
  assert.equal(created.technicalScore, 1);
  assert.deepEqual(calls.map((c) => c.url), [
    `/api/fotoai/critiques?submissionId=${ALICE}&limit=5`,
    '/api/fotoai/critiques/c1',
    '/api/fotoai/critiques',
  ]);
  const form = calls[2].init?.body as FormData;
  assert.deepEqual([...form.keys()], ['photo']);
});

test('critiques GET: v2 editing and recreate analyses in the same table never show (list or detail)', async () => {
  const kept = seedCritique(ALICE, { critique_date: '2026-10-01T00:00:00.000Z' });
  const editing = seedCritique(ALICE, { critique_date: '2026-10-04T00:00:00.000Z', mode: 'editing', technical_score: null, details: { summary: 'x' } });
  seedCritique(ALICE, { critique_date: '2026-10-05T00:00:00.000Z', mode: 'recreate', technical_score: null, details: {} });
  const { critiques } = await (await h.list(request('/api/fotoai/critiques', { cookie: alice }))).json();
  assert.ok(critiques.some((c: any) => c.id === kept.id));
  assert.equal(critiques.some((c: any) => c.id === editing.id), false);
  assert.equal(critiques.length, critiques.filter((c: any) => c.overallScore !== undefined).length);
  const detail = await h.get(request(`/api/fotoai/critiques/${editing.id}`, { cookie: alice }), { params: { id: editing.id } });
  assert.equal(detail.status, 404);
});
