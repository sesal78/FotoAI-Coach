// Per-user rate limits on the FotoAI LLM routes. Each admitted call records one
// fotoai_agent_actions row with the user token; the limit counts the caller's
// own rows of that route inside the window.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { createChatHandlers } from '../../lib/fotoai/handlers/chat.ts';
import { createCritiqueHandlers } from '../../lib/fotoai/handlers/critiques.ts';
import { createEditingHandlers } from '../../lib/fotoai/handlers/editing.ts';
import { createItineraryHandlers } from '../../lib/fotoai/handlers/itineraries.ts';
import { createLocationHandlers } from '../../lib/fotoai/handlers/locations.ts';
import { createReverseHandlers } from '../../lib/fotoai/handlers/reverse.ts';
import { LLM_RATE_LIMITS, LLM_RATE_WINDOW_MS, llmActionType, type LlmRoute } from '../../lib/fotoai/rate-limit.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, type TestDeps } from './helpers/deps.ts';
import { jpeg, multipartRequest } from './ai-test-utils.ts';

const T_ACTIONS = 'fotoai_agent_actions';
const ALICE_COOKIE = cookieFor(TOKEN_ALICE);
const BOB_COOKIE = cookieFor(TOKEN_BOB);

let deps: TestDeps;
let challenges: ReturnType<typeof createChallengeHandlers>;

interface RouteCase {
  route: LlmRoute;
  /** The fake service the route's LLM call goes through. */
  llm: string;
  call: (cookie: string) => Promise<Response>;
}

let cases: RouteCase[];

beforeEach(() => {
  deps = createTestDeps();
  const provider = () => deps;
  challenges = createChallengeHandlers(provider);
  const chat = createChatHandlers(provider);
  const critiques = createCritiqueHandlers(provider);
  const reverse = createReverseHandlers(provider);
  const editing = createEditingHandlers(provider);
  const itineraries = createItineraryHandlers(provider);
  const locations = createLocationHandlers(provider);

  for (const user of [ALICE, BOB]) {
    deps.client.seed('fotoai_user_preferences', { user_id: user, skill_level: 'advanced', photography_interests: ['street'] });
  }
  deps.fakes.callLLM = () => ({ content: '{"locations":[],"summary":"none"}', model: 'fake' });
  deps.fakes.getWeather = () => ({ condition: 'Clear', temperature: 70 });
  deps.fakes.generateChallenge = () => ({ challengeText: 'Shoot reflections' });
  deps.fakes.critiquePhoto = () => ({ technicalScore: 50, compositionScore: 50, creativeScore: 50, overallScore: 50 });
  deps.fakes.reverseEngineerPhoto = () => ({ shotRecipe: ['step'] });
  deps.fakes.generateEditingRecipe = () => ({ steps: ['step'] });
  deps.fakes.generateItinerary = () => ({ title: 'Tour', spots: [] });

  cases = [
    { route: 'challenge_generate', llm: 'generateChallenge',
      call: (cookie) => challenges.generate(jsonRequest('/api/fotoai/challenges/generate', { forceGenerate: true }, { cookie })) },
    { route: 'chat', llm: 'callLLM',
      call: (cookie) => chat.send(jsonRequest('/api/fotoai/chat', { messages: [{ role: 'user', content: 'tips?' }] }, { cookie })) },
    { route: 'critique', llm: 'critiquePhoto',
      call: (cookie) => critiques.create(multipartRequest('/api/fotoai/critiques', [['photo', jpeg()]], cookie)) },
    { route: 'reverse', llm: 'reverseEngineerPhoto',
      call: (cookie) => reverse.create(multipartRequest('/api/fotoai/reverse', [['photo', jpeg()]], cookie)) },
    { route: 'editing', llm: 'generateEditingRecipe',
      call: (cookie) => editing.create(multipartRequest('/api/fotoai/editing', [['originalPhoto', jpeg('a.jpg')], ['editedPhoto', jpeg('b.jpg')]], cookie)) },
    { route: 'itinerary', llm: 'generateItinerary',
      call: (cookie) => itineraries.create(jsonRequest('/api/fotoai/itineraries', { location: 'Fitzroy' }, { cookie })) },
    { route: 'locations', llm: 'callLLM',
      call: (cookie) => locations.scout(jsonRequest('/api/fotoai/locations', { query: 'street art' }, { cookie })) },
  ];
});

function seedActions(user: string, route: LlmRoute, count: number, ageMs: number, actionType = llmActionType(route)) {
  for (let i = 0; i < count; i++) {
    deps.client.seed(T_ACTIONS, {
      user_id: user, action_type: actionType, details: { route }, success: true,
      executed_at: new Date(Date.now() - ageMs - i).toISOString(),
    });
  }
}

function llmCalls(name: string): number {
  return deps.calls.filter((c) => c.name === name).length;
}

function actionsOf(user: string, route: LlmRoute) {
  return (deps.client.tables.get(T_ACTIONS) ?? []).filter((r) => r.user_id === user && r.action_type === llmActionType(route));
}

test('rate limits: limits are generous named constants with a one-hour window', () => {
  assert.equal(LLM_RATE_WINDOW_MS, 60 * 60 * 1000);
  for (const route of ['challenge_generate', 'chat', 'critique', 'reverse', 'editing', 'itinerary', 'locations'] as const) {
    assert.ok(Number.isInteger(LLM_RATE_LIMITS[route]) && LLM_RATE_LIMITS[route] >= 10, `${route}: ${LLM_RATE_LIMITS[route]}`);
  }
});

test('rate limits: every LLM route refuses the caller at the limit with 429 and makes no LLM call; Bob is unaffected', async () => {
  for (const c of cases) {
    seedActions(ALICE, c.route, LLM_RATE_LIMITS[c.route], 60_000);
    const before = llmCalls(c.llm);
    const refused = await c.call(ALICE_COOKIE);
    assert.equal(refused.status, 429, `${c.route}: ${JSON.stringify(await refused.clone().json())}`);
    assert.equal((await refused.json()).code, 'rate_limited', c.route);
    assert.equal(llmCalls(c.llm), before, `${c.route}: no LLM call when refused`);
    assert.equal(actionsOf(ALICE, c.route).length, LLM_RATE_LIMITS[c.route], `${c.route}: a refusal records nothing`);

    const ok = await c.call(BOB_COOKIE);
    assert.ok(ok.status === 200 || ok.status === 201, `${c.route}: Bob got ${ok.status} ${JSON.stringify(await ok.clone().json())}`);
    assert.equal(llmCalls(c.llm), before + 1, `${c.route}: Bob's call reached the LLM`);
  }
  assert.equal(deps.client.serviceCalls.filter((s) => s.keys.includes(T_ACTIONS)).length, 0, 'counted with the user token only');
});

test('rate limits: old actions and other routes do not count; an admitted call records exactly one own action', async () => {
  for (const c of cases) {
    deps.client.tables.set(T_ACTIONS, []);
    seedActions(ALICE, c.route, LLM_RATE_LIMITS[c.route], LLM_RATE_WINDOW_MS + 60_000);
    const other = c.route === 'chat' ? 'reverse' : 'chat';
    seedActions(ALICE, c.route, LLM_RATE_LIMITS[c.route], 60_000, llmActionType(other));
    seedActions(BOB, c.route, LLM_RATE_LIMITS[c.route], 60_000);
    const before = actionsOf(ALICE, c.route).length;

    const res = await c.call(ALICE_COOKIE);
    assert.ok(res.status === 200 || res.status === 201, `${c.route}: ${res.status} ${JSON.stringify(await res.clone().json())}`);
    const after = actionsOf(ALICE, c.route);
    assert.equal(after.length, before + 1, c.route);
    const recorded = after.find((r) => Date.parse(r.executed_at) > Date.now() - 10_000)!;
    assert.equal(recorded.user_id, ALICE);
    assert.equal(recorded.success, true);
  }
});

test('rate limits: parallel calls cannot pass the limit together', async () => {
  const chat = cases.find((c) => c.route === 'chat')!;
  seedActions(ALICE, 'chat', LLM_RATE_LIMITS.chat - 2, 60_000);
  const results = await Promise.all(Array.from({ length: 8 }, () => chat.call(ALICE_COOKIE)));
  const statuses = results.map((r) => r.status);
  assert.ok(statuses.every((s) => s === 200 || s === 429), statuses.join(','));
  const ok = statuses.filter((s) => s === 200).length;
  assert.ok(ok <= 2, `at most 2 admitted, got ${statuses.join(',')}`);
  assert.equal(llmCalls('callLLM'), ok, 'one LLM call per admitted request');
});

test('rate limits: challenge generate at the limit still returns today\'s challenge, but refuses a new generation', async () => {
  const generate = cases.find((c) => c.route === 'challenge_generate')!;
  seedActions(ALICE, 'challenge_generate', LLM_RATE_LIMITS.challenge_generate, 60_000);
  const today = deps.client.seed('fotoai_daily_challenges', {
    user_id: ALICE, challenge_type: 'AFTER_WORK', challenge_text: 'Today', status: 'pending', issued_date: new Date().toISOString(),
  });

  const cached = await challenges.generate(jsonRequest('/api/fotoai/challenges/generate', {}, { cookie: ALICE_COOKIE }));
  assert.equal(cached.status, 200);
  assert.equal((await cached.json()).challenge.id, today.id);

  assert.equal((await generate.call(ALICE_COOKIE)).status, 429, 'forceGenerate is limited');
  today.status = 'skipped';
  const fresh = await challenges.generate(jsonRequest('/api/fotoai/challenges/generate', {}, { cookie: ALICE_COOKIE }));
  assert.equal(fresh.status, 429, 'skip-then-generate is limited too');
  assert.equal(llmCalls('generateChallenge'), 0);
});
