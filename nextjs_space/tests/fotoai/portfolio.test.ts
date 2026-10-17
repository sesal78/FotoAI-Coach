// /api/fotoai/portfolio — owner-scoped portfolio analysis with a per-user daily limit.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createPortfolioHandlers } from '../../lib/fotoai/handlers/portfolio.ts';
import { MAX_UPLOAD_REQUEST_BYTES } from '../../lib/fotoai/bounded-body.ts';
import { createFotoaiPortfolioAnalysis, listFotoaiPortfolioAnalyses } from '../../lib/fotoai/client-ai.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';
import { formKeys, jpeg, multipartRequest, recordingFetch, type TestFile } from './ai-test-utils.ts';

const T = 'fotoai_portfolio_analyses';
const ALICE_COOKIE = cookieFor(TOKEN_ALICE);
const URL_ = '/api/fotoai/portfolio';
const META = { overallScore: 80, styleSummary: 'Moody street', overallFeedback: 'Good' };

let deps: TestDeps;
let h: ReturnType<typeof createPortfolioHandlers>;
let inFlight = 0;
let maxInFlight = 0;

function photos(n: number, make: (i: number) => TestFile = (i) => jpeg(`p${i}.jpg`)): Array<[string, TestFile]> {
  return Array.from({ length: n }, (_, i) => [`photo_${i}`, make(i)] as [string, TestFile]);
}

const post = (fields: Array<[string, string | TestFile]>, cookie: string | undefined = ALICE_COOKIE, url = URL_) =>
  h.create(multipartRequest(url, fields, cookie));

beforeEach(() => {
  deps = createTestDeps();
  h = createPortfolioHandlers(() => deps);
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'professional' });
  inFlight = 0;
  maxInFlight = 0;
  deps.fakes.assessPortfolioPhoto = async (input: { index: number }) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;
    return { index: input.index, score: 70, styleTags: ['street'], strength: 's', weakness: 'w' };
  };
  deps.fakes.analyzePortfolioMeta = () => META;
});

test('portfolio POST: owner success, max 5 concurrent assessments, meta pass, photos never stored', async () => {
  const res = await post(photos(12));
  assert.equal(res.status, 201);
  const data = await res.json();

  const assessCalls = deps.calls.filter((c) => c.name === 'assessPortfolioPhoto');
  assert.equal(assessCalls.length, 12);
  assert.deepEqual(assessCalls.map((c) => (c.args[0] as any).index), [...Array(12).keys()]);
  assert.ok(assessCalls.every((c) => (c.args[0] as any).skillLevel === 'professional'));
  assert.match((assessCalls[0].args[0] as any).imageDataUri, /^data:image\/jpeg;base64,/);
  assert.ok(maxInFlight <= 5 && maxInFlight > 1, `max in flight was ${maxInFlight}`);

  const meta = deps.calls.find((c) => c.name === 'analyzePortfolioMeta')!.args[0] as any;
  assert.equal(meta.photoCount, 12);
  assert.equal(meta.assessments.length, 12);

  const [row] = deps.client.tables.get(T)!;
  assert.equal(data.id, row.id);
  assert.equal(row.user_id, ALICE);
  assert.equal(row.photo_count, 12);
  assert.equal(data.analysis.photoAssessments.length, 12);
  assert.equal(data.analysis.styleSummary, 'Moody street');
  assert.deepEqual(deps.client.serviceCalls, []); // no upload, no sign
  assert.equal(deps.client.objects.size, 0);
});

test('portfolio rate limit: Bob\'s analyses do not count for Alice; Alice\'s 4th today is refused', async () => {
  const now = new Date().toISOString();
  for (let i = 0; i < 3; i++) {
    deps.client.seed(T, { user_id: BOB, photo_count: 3, analysis: META, analysis_date: now });
  }
  // An old Alice analysis (2 days ago) does not count either.
  deps.client.seed(T, { user_id: ALICE, photo_count: 3, analysis: META, analysis_date: new Date(Date.now() - 48 * 3600 * 1000).toISOString() });

  for (let i = 0; i < 3; i++) {
    const ok = await post(photos(3));
    assert.equal(ok.status, 201, `analysis ${i + 1} should be allowed`);
  }
  const callsBefore = deps.calls.length;
  const refused = await post(photos(3));
  assert.equal(refused.status, 429);
  assert.equal((await refused.json()).code, 'rate_limited');
  assert.equal(deps.calls.length, callsBefore, 'no LLM call for a refused analysis');

  // Bob is at his own limit, independent of Alice.
  assert.equal((await post(photos(3), cookieFor(TOKEN_BOB))).status, 429);
});

test('portfolio GET: lists only own rows with the legacy shape', async () => {
  const a = deps.client.seed(T, { user_id: ALICE, photo_count: 4, analysis: META, analysis_date: '2026-10-01T00:00:00Z' });
  deps.client.seed(T, { user_id: BOB, photo_count: 5, analysis: META, analysis_date: '2026-10-02T00:00:00Z' });
  const res = await h.list(request(`${URL_}?limit=5`, { cookie: ALICE_COOKIE }));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).analyses, [
    { id: a.id, photoCount: 4, analysis: META, analysisDate: '2026-10-01T00:00:00Z' },
  ]);
  assert.deepEqual(deps.client.serviceCalls, []);
});

test('portfolio: userId in query or form is rejected (400)', async () => {
  assert.equal((await h.list(request(`${URL_}?userId=${BOB}`, { cookie: ALICE_COOKIE }))).status, 400);
  assert.equal((await post(photos(3), ALICE_COOKIE, `${URL_}?userId=${BOB}`)).status, 400);
  assert.equal((await post([['userId', BOB], ...photos(3)])).status, 400);
  assert.deepEqual(deps.calls, []);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);
});

test('portfolio: no cookie -> 401', async () => {
  assert.equal((await h.list(request(URL_))).status, 401);
  assert.equal((await h.create(multipartRequest(URL_, photos(3)))).status, 401);
  assert.deepEqual(deps.calls, []);
});

test('portfolio: invalid input -> 400 (too few, photo_20, bad type, bad limit); oversized body -> 413', async () => {
  const few = await post(photos(2));
  assert.equal(few.status, 400);
  assert.match((await few.json()).error, /At least 3 photos required \(received 2\)/);
  assert.equal((await post([...photos(3), ['photo_20', jpeg()]])).status, 400);
  const gif = await post(photos(3, (i) => ({ ...jpeg(`p${i}.gif`), type: 'image/gif' })));
  assert.equal(gif.status, 400);
  assert.match((await gif.json()).error, /invalid file type/);
  assert.equal((await h.list(request(`${URL_}?limit=-1`, { cookie: ALICE_COOKIE }))).status, 400);

  const big = request(URL_, {
    method: 'POST', cookie: ALICE_COOKIE,
    headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(MAX_UPLOAD_REQUEST_BYTES + 1) },
    body: new Uint8Array(1),
  });
  assert.equal((await h.create(big)).status, 413);
  assert.deepEqual(deps.calls, []);
});

test('portfolio: LLM failure -> 502, no row (does not use up the daily limit)', async () => {
  deps.fakes.analyzePortfolioMeta = () => { throw new Error('model down'); };
  const res = await post(photos(3));
  assert.equal(res.status, 502);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);

  deps.fakes.assessPortfolioPhoto = () => { throw new Error('vision down'); };
  assert.equal((await post(photos(3))).status, 502);
  assert.equal(deps.client.tables.get(T)?.length ?? 0, 0);
});

test('portfolio client: session-only URLs, photo_N fields only', async () => {
  const { calls, fetcher } = recordingFetch((url) => (url.includes('?') ? { analyses: [] } : { id: 'x', analysis: {} }));
  await listFotoaiPortfolioAnalyses(10, fetcher);
  const f = new File([jpeg().bytes], 'a.jpg', { type: 'image/jpeg' });
  await createFotoaiPortfolioAnalysis([f, f, f], fetcher);
  assert.deepEqual(calls.map((c) => c.url), ['/api/fotoai/portfolio?limit=10', '/api/fotoai/portfolio']);
  assert.deepEqual(formKeys(calls[1].init), ['photo_0', 'photo_1', 'photo_2']);
});
