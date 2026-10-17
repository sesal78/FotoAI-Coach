// Defense in depth: the fake runs with BROKEN RLS (createTestDeps({ rls: false })),
// so a user-token query returns every matching row. Alice must still never see
// or change Bob's rows: the repositories' own user_id filters have to hold.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { createCritiqueHandlers } from '../../lib/fotoai/handlers/critiques.ts';
import { createEditingHandlers } from '../../lib/fotoai/handlers/editing.ts';
import { createGearHandlers } from '../../lib/fotoai/handlers/gear.ts';
import { createInsightsHandlers } from '../../lib/fotoai/handlers/insights.ts';
import { createItineraryHandlers } from '../../lib/fotoai/handlers/itineraries.ts';
import { createPortfolioHandlers } from '../../lib/fotoai/handlers/portfolio.ts';
import { createReverseHandlers } from '../../lib/fotoai/handlers/reverse.ts';
import { createSubmissionHandlers } from '../../lib/fotoai/handlers/submissions.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

const cookie = cookieFor(TOKEN_ALICE);
const DATE = '2026-10-01T10:00:00Z';

let deps: TestDeps;
const own: Record<string, Record<string, any>> = {};
const bobs: Record<string, Record<string, any>> = {};

function seedPair(key: string, table: string, row: Record<string, unknown>) {
  own[key] = deps.client.seed(table, { ...row, user_id: ALICE });
  bobs[key] = deps.client.seed(table, { ...row, user_id: BOB });
}

const get = (url: string) => request(url, { cookie });
const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

beforeEach(() => {
  deps = createTestDeps({ rls: false });
  seedPair('challenge', 'fotoai_daily_challenges', {
    challenge_type: 'AFTER_WORK', challenge_text: 'Shoot shadows', status: 'pending', issued_date: DATE,
  });
  own.submission = deps.client.seed('fotoai_challenge_submissions', {
    user_id: ALICE, challenge_id: own.challenge.id, notes: 'a', feedback_status: 'ready', submitted_at: DATE,
    photo_object_key: `${ALICE}/submissions/x/a.jpg`,
  });
  bobs.submission = deps.client.seed('fotoai_challenge_submissions', {
    user_id: BOB, challenge_id: bobs.challenge.id, notes: 'b', feedback_status: 'ready', submitted_at: DATE,
    photo_object_key: `${BOB}/submissions/x/b.jpg`,
  });
  seedPair('gear', 'fotoai_user_gear', { category: 'camera', brand: 'Fujifilm', model: 'X-T5' });
  seedPair('critique', 'fotoai_photo_critiques', {
    submission_id: null, photo_object_key: null, overall_score: 70, technical_score: 70, composition_score: 70,
    creative_score: 70, critique_date: DATE,
  });
  bobs.critique.submission_id = bobs.submission.id;
  seedPair('reverse', 'fotoai_reverse_analyses', { photo_object_key: null, result: { note: 'r' }, analysis_date: DATE });
  seedPair('editing', 'fotoai_editing_recipes', {
    original_photo_object_key: null, edited_photo_object_key: null, recipe: { note: 'e' }, analysis_date: DATE,
  });
  seedPair('portfolio', 'fotoai_portfolio_analyses', { photo_count: 3, analysis: { note: 'p' }, analysis_date: DATE });
  seedPair('itinerary', 'fotoai_itineraries', {
    location: 'Fitzroy', title: 't', description: 'd', spots: [], status: 'active', generated_date: DATE,
  });
  seedPair('report', 'fotoai_weekly_reports', {
    week_start: '2026-09-24', week_end: '2026-10-01', stats: {}, insights: {}, report_date: DATE,
  });
});

test('broken RLS really is broken: the fake returns Bob\'s rows for Alice\'s token', async () => {
  const rows = await deps.client.restSelect('fotoai_user_gear', {}, TOKEN_ALICE);
  assert.deepEqual(rows.map((r) => r.user_id).sort(), [ALICE, BOB].sort());
});

test('challenges: list/get/patch never reach Bob\'s challenge', async () => {
  const h = createChallengeHandlers(() => deps);
  const list = await (await h.list(get('/api/fotoai/challenges'))).json();
  assert.deepEqual(ids(list.challenges), [own.challenge.id]);
  assert.equal((await h.get(get(`/api/fotoai/challenges/${bobs.challenge.id}`), { params: { id: bobs.challenge.id } })).status, 404);
  const patch = await h.patch(jsonRequest(`/api/fotoai/challenges/${bobs.challenge.id}`, { status: 'completed' }, { cookie, method: 'PATCH' }), { params: { id: bobs.challenge.id } });
  assert.equal(patch.status, 404);
  assert.equal(bobs.challenge.status, 'pending');
});

test('submissions: list/get/photo/delete never reach Bob\'s submission', async () => {
  const h = createSubmissionHandlers(() => deps);
  const list = await (await h.list(get('/api/fotoai/submissions'))).json();
  assert.deepEqual(ids(list.submissions), [own.submission.id]);
  const byChallenge = await (await h.list(get(`/api/fotoai/submissions?challengeId=${bobs.challenge.id}`))).json();
  assert.deepEqual(byChallenge.submissions, []);
  const ctx = { params: { id: bobs.submission.id } };
  assert.equal((await h.get(get(`/api/fotoai/submissions/${bobs.submission.id}`), ctx)).status, 404);
  assert.equal((await h.photo(get(`/api/fotoai/submissions/${bobs.submission.id}/photo`), ctx)).status, 404);
  assert.equal((await h.remove(request(`/api/fotoai/submissions/${bobs.submission.id}`, { method: 'DELETE', cookie }), ctx)).status, 404);
  assert.ok(deps.client.tables.get('fotoai_challenge_submissions')!.includes(bobs.submission), 'Bob\'s row survives');
  assert.deepEqual(deps.client.serviceCalls, [], 'nothing signed or removed');
});

test('gear: list/delete never reach Bob\'s gear', async () => {
  const h = createGearHandlers(() => deps);
  const list = await (await h.list(get('/api/fotoai/gear'))).json();
  assert.deepEqual(ids(list.gear), [own.gear.id]);
  const del = await h.remove(request(`/api/fotoai/gear/${bobs.gear.id}`, { method: 'DELETE', cookie }), { params: { id: bobs.gear.id } });
  assert.equal(del.status, 404);
  assert.ok(deps.client.tables.get('fotoai_user_gear')!.includes(bobs.gear));
});

test('critiques: list/get never reach Bob\'s critique', async () => {
  const h = createCritiqueHandlers(() => deps);
  const list = await (await h.list(get('/api/fotoai/critiques'))).json();
  assert.deepEqual(ids(list.critiques), [own.critique.id]);
  const bySubmission = await (await h.list(get(`/api/fotoai/critiques?submissionId=${bobs.submission.id}`))).json();
  assert.deepEqual(bySubmission.critiques, []);
  assert.equal((await h.get(get(`/api/fotoai/critiques/${bobs.critique.id}`), { params: { id: bobs.critique.id } })).status, 404);
});

test('reverse, editing, portfolio, itineraries, insights: lists hold only Alice\'s rows', async () => {
  const reverse = await (await createReverseHandlers(() => deps).list(get('/api/fotoai/reverse'))).json();
  assert.deepEqual(ids(reverse.analyses), [own.reverse.id]);
  const editing = await (await createEditingHandlers(() => deps).list(get('/api/fotoai/editing'))).json();
  assert.deepEqual(ids(editing.recipes), [own.editing.id]);
  const portfolio = await (await createPortfolioHandlers(() => deps).list(get('/api/fotoai/portfolio'))).json();
  assert.deepEqual(ids(portfolio.analyses), [own.portfolio.id]);
  const itineraries = await (await createItineraryHandlers(() => deps).list(get('/api/fotoai/itineraries'))).json();
  assert.deepEqual(ids(itineraries.itineraries), [own.itinerary.id]);
  const insights = await (await createInsightsHandlers(() => deps).list(get('/api/fotoai/insights'))).json();
  assert.deepEqual(ids(insights.reports), [own.report.id]);
});
