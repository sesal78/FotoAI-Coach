// Challenge generation, challenge email and chatbot sync (session-only, owner-scoped).

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { generateChallengeFor, type GenerationDataAccess } from '../../lib/fotoai/challenge-generation.ts';
import { createChallengeEmailHandlers } from '../../lib/fotoai/handlers/challenge-email.ts';
import { createChallengeSyncHandlers } from '../../lib/fotoai/handlers/challenge-sync.ts';
import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

const T_CH = 'fotoai_daily_challenges';
const T_PROGRESS = 'fotoai_user_progress';
const aliceCookie = cookieFor(TOKEN_ALICE);
const GEN_URL = '/api/fotoai/challenges/generate';
const EMAIL_URL = '/api/fotoai/challenges/email';
const SYNC_URL = '/api/fotoai/challenges/sync';

let deps: TestDeps;
let challenges: ReturnType<typeof createChallengeHandlers>;
let email: ReturnType<typeof createChallengeEmailHandlers>;
let sync: ReturnType<typeof createChallengeSyncHandlers>;

const LLM_RESULT = {
  challengeText: 'Shoot reflections in shop windows',
  difficulty: 'medium',
  category: 'street',
  duration: '2-4 hours',
  tips: 'Use a polariser',
  recommendedGear: ['Fujifilm X-T5'],
  shotList: ['wide establishing', 'detail'],
  narrativeContext: 'A city that looks back',
  editingDirection: 'Muted tones',
  masteryArea: 'Exposure',
  technicalLevel: 7,
  successCriteria: 'Sharp reflections',
  whatToLookFor: 'Clipped highlights',
};

beforeEach(() => {
  deps = createTestDeps();
  const provider = () => deps;
  challenges = createChallengeHandlers(provider);
  email = createChallengeEmailHandlers(provider);
  sync = createChallengeSyncHandlers(provider);

  deps.client.seed('fotoai_user_preferences', {
    user_id: ALICE, skill_level: 'advanced', photography_interests: ['street'], current_location: 'Fitzroy',
    home_location: 'Melbourne', work_days: ['Monday'],
  });
  deps.client.seed('fotoai_user_preferences', {
    user_id: BOB, skill_level: 'beginner', photography_interests: ['macro'], current_location: 'Paris',
    home_location: 'Lyon',
  });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Fujifilm', model: 'X-T5' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'camera', brand: 'Canon', model: 'R5' });
  deps.client.seed(T_PROGRESS, { user_id: BOB, total_challenges_issued: 5, saturday_challenges_issued: 2 });

  deps.fakes.getWeather = () => ({ condition: 'Clouds', temperature: 61 });
  deps.fakes.generateChallenge = () => ({ ...LLM_RESULT });
});

function rowsOf(table: string, user: string) {
  return (deps.client.tables.get(table) ?? []).filter((r) => r.user_id === user);
}

function callsOf(name: string) {
  return deps.calls.filter((c) => c.name === name);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

test('generate: uses only the caller\'s preferences and gear, maps every field, logs CHALLENGE_SENT', async () => {
  const res = await challenges.generate(jsonRequest(GEN_URL, { challengeType: 'STORY_DRIVEN', forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.message, 'Challenge generated successfully');
  assert.equal(body.challenge.challengeText, LLM_RESULT.challengeText);
  assert.deepEqual(body.challenge.shotList, LLM_RESULT.shotList);
  assert.equal(body.challenge.technicalLevel, 5, 'technical_level clamped to the 1-5 check');
  assert.equal(body.challenge.user_id, undefined);

  const [gen] = callsOf('generateChallenge');
  const ctx = gen.args[0] as any;
  assert.equal(ctx.userProfile.skillLevel, 'advanced');
  assert.deepEqual(ctx.userProfile.interests, ['street']);
  assert.deepEqual(ctx.userProfile.gear, ['Fujifilm X-T5']);
  assert.equal(ctx.location, 'Fitzroy');
  assert.equal(ctx.challengeType, 'STORY_DRIVEN');
  assert.equal(ctx.weather.condition, 'Clouds');
  assert.ok(!JSON.stringify(ctx).includes('Canon') && !JSON.stringify(ctx).includes('Paris') && !JSON.stringify(ctx).includes('macro'));
  assert.deepEqual(callsOf('getWeather')[0].args, ['Fitzroy']);

  const [row] = rowsOf(T_CH, ALICE);
  assert.equal(row.challenge_type, 'STORY_DRIVEN');
  assert.equal(row.status, 'pending');
  assert.equal(row.location, 'Fitzroy');
  assert.equal(row.weather_conditions, 'Clouds, 61°F');
  assert.deepEqual(row.recommended_gear, ['Fujifilm X-T5']);
  assert.deepEqual(row.shot_list, LLM_RESULT.shotList);
  assert.equal(row.technical_level, 5);
  assert.equal(row.mastery_area, 'Exposure');
  assert.equal(row.success_criteria, 'Sharp reflections');
  assert.equal(row.narrative_context, 'A city that looks back');
  assert.equal(row.editing_direction, 'Muted tones');
  assert.equal(row.what_to_look_for, 'Clipped highlights');
  assert.equal(rowsOf(T_CH, BOB).length, 0);

  const [action] = rowsOf('fotoai_agent_actions', ALICE);
  assert.equal(action.action_type, 'CHALLENGE_SENT');
  assert.equal(action.details.challengeId, row.id);
  assert.equal(deps.client.serviceCalls.length, 0, 'no service-role use');
});

test('generate: bumps total and per-type issued counters on the caller\'s progress only', async () => {
  await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  let [progress] = rowsOf(T_PROGRESS, ALICE);
  assert.equal(progress.total_challenges_issued, 1, 'progress row created on first issue');
  assert.equal(progress.saturday_challenges_issued, 1, 'WEEKEND_DEEP_DIVE is the default type');

  await challenges.generate(jsonRequest(GEN_URL, { challengeType: 'AFTER_WORK', forceGenerate: true }, { cookie: aliceCookie }));
  [progress] = rowsOf(T_PROGRESS, ALICE);
  assert.equal(progress.total_challenges_issued, 2);
  assert.equal(progress.after_work_issued, 1);
  assert.equal(progress.saturday_challenges_issued, 1);

  await challenges.generate(jsonRequest(GEN_URL, { challengeType: 'TECHNICAL_MASTERY', forceGenerate: true }, { cookie: aliceCookie }));
  [progress] = rowsOf(T_PROGRESS, ALICE);
  assert.equal(progress.total_challenges_issued, 3, 'types without a per-type counter still bump the total');

  const [bob] = rowsOf(T_PROGRESS, BOB);
  assert.equal(bob.total_challenges_issued, 5);
  assert.equal(bob.saturday_challenges_issued, 2);
});

test('generate: returns today\'s pending challenge unless forceGenerate', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 36 * 3600 * 1000);
  deps.client.seed(T_CH, { user_id: ALICE, challenge_type: 'LUNCH_BREAK', challenge_text: 'old', status: 'pending', issued_date: yesterday.toISOString() });
  deps.client.seed(T_CH, { user_id: ALICE, challenge_type: 'CHATBOT_GENERATED', challenge_text: 'chat', status: 'pending', issued_date: now.toISOString() });
  deps.client.seed(T_CH, { user_id: BOB, challenge_type: 'AFTER_WORK', challenge_text: 'bob today', status: 'pending', issued_date: now.toISOString() });

  // Yesterday's, chatbot and Bob's challenges do not block generation.
  let res = await challenges.generate(jsonRequest(GEN_URL, {}, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  const first = (await res.json()).challenge;
  assert.equal(callsOf('generateChallenge').length, 1);

  // Now a pending challenge from today exists: returned as-is, no LLM call.
  res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: false }, { cookie: aliceCookie }));
  assert.equal(res.status, 200);
  const again = await res.json();
  assert.equal(again.message, 'Challenge already exists for today');
  assert.equal(again.challenge.id, first.id);
  assert.equal(callsOf('generateChallenge').length, 1);
  assert.equal(rowsOf(T_PROGRESS, ALICE)[0].total_challenges_issued, 1, 'no counter bump for a returned challenge');

  // forceGenerate always creates a new one.
  res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  assert.notEqual((await res.json()).challenge.id, first.id);
  assert.equal(callsOf('generateChallenge').length, 2);
});

test('generate: 401 without a session, 400 for userId or invalid input, no LLM call', async () => {
  let res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }));
  assert.equal(res.status, 401);
  res = await challenges.generate(jsonRequest(GEN_URL, { userId: BOB, forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  res = await challenges.generate(jsonRequest(`${GEN_URL}?userId=${BOB}`, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  res = await challenges.generate(jsonRequest(GEN_URL, { challengeType: 'DROP TABLE' }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: 'yes' }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  res = await challenges.generate(jsonRequest(GEN_URL, { extra: 1 }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  assert.equal(deps.calls.length, 0);
  assert.equal(rowsOf(T_CH, ALICE).length + rowsOf(T_CH, BOB).length, 0);
});

test('generate: LLM failure is a 502 with nothing written; missing preferences is a 404', async () => {
  deps.fakes.generateChallenge = () => { throw new Error('LLM API error: 500'); };
  let res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'upstream');
  assert.equal(rowsOf(T_CH, ALICE).length, 0);
  assert.equal(rowsOf(T_PROGRESS, ALICE).length, 0);
  assert.equal(rowsOf('fotoai_agent_actions', ALICE).length, 0);

  deps.fakes.generateChallenge = () => ({ challengeText: '' });
  res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 502, 'empty LLM result is rejected');

  deps.client.tables.set('fotoai_user_preferences', []);
  res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 404);
});

test('generate: weather failure is tolerated (no weather in prompt or row)', async () => {
  deps.fakes.getWeather = () => { throw new Error('weather down'); };
  const res = await challenges.generate(jsonRequest(GEN_URL, { forceGenerate: true }, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  assert.equal((callsOf('generateChallenge')[0].args[0] as any).weather, undefined);
  assert.equal(rowsOf(T_CH, ALICE)[0].weather_conditions, null);
});

test('generateChallengeFor: accepts an injected data access (cron-style scope without a token)', async () => {
  const inserted: Array<{ scope: unknown; row: Record<string, unknown> }> = [];
  const issued: string[] = [];
  const data: GenerationDataAccess<{ userId: string }> = {
    getPreferences: async () => ({
      skillLevel: 'professional', photographyInterests: ['night'], avoidsStyles: [], workDays: [], workStartTime: '09:00',
      workEndTime: '17:00', lunchStartTime: '12:00', lunchEndTime: '13:00', primaryPhotoDay: 'Saturday',
      secondaryPhotoDays: [], lunchBreakPhotography: true, eveningPhotography: true, wfhFlexibility: true,
      adaptToWeather: true, adaptToCalendar: true, officeLocation: null, homeLocation: 'Hobart', currentLocation: null,
    }),
    listGearNames: async () => ['Sony A7'],
    listRecentChallengeTexts: async () => [],
    findPendingIssuedSince: async () => null,
    insertChallenge: async (scope, row) => {
      inserted.push({ scope, row });
      return { id: 'x', user_id: scope.userId, ...row } as any;
    },
    incrementIssued: async (_scope, type) => { issued.push(type); },
    logAgentAction: async () => {},
  };
  const result = await generateChallengeFor({ data, services: deps.services }, { userId: BOB }, {
    challengeType: 'LUNCH_BREAK', displayName: 'Bob',
  });
  assert.equal(result.created, true);
  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0].scope, { userId: BOB });
  assert.equal(inserted[0].row.location, 'Hobart');
  assert.deepEqual(issued, ['LUNCH_BREAK']);
  assert.equal((callsOf('generateChallenge')[0].args[0] as any).userProfile.name, 'Bob');
  assert.equal(deps.client.serviceCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

test('email: sends to the session user\'s own address with bounded, cleaned fields', async () => {
  deps.fakes.sendChallengeEmail = () => true;
  const res = await email.send(jsonRequest(EMAIL_URL, {
    challengeText: 'Shoot <b>reflections</b>', category: 'street', recommendedGear: ['X-T5'], location: 'Fitzroy',
  }, { cookie: aliceCookie }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);
  const [call] = callsOf('sendChallengeEmail');
  assert.equal(call.args[0], 'alice@test.invalid');
  assert.equal(call.args[1], 'Photographer');
  const sent = call.args[2] as any;
  assert.equal(sent.challengeText, 'Shoot breflections/b');
  assert.equal(sent.difficulty, 'intermediate');
  assert.equal(sent.duration, '30 mins');
  assert.deepEqual(sent.recommendedGear, ['X-T5']);
});

test('email: 401, 400 for userId/missing/oversized/unknown fields, 502 when mail fails', async () => {
  deps.fakes.sendChallengeEmail = () => true;
  let res = await email.send(jsonRequest(EMAIL_URL, { challengeText: 'x' }));
  assert.equal(res.status, 401);
  for (const bad of [
    { challengeText: 'x', userId: BOB },
    {},
    { challengeText: 'x'.repeat(4001) },
    { challengeText: 'x', recommendedGear: 'not-an-array' },
    { challengeText: 'x', to: 'evil@test.invalid' },
  ]) {
    res = await email.send(jsonRequest(EMAIL_URL, bad, { cookie: aliceCookie }));
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(callsOf('sendChallengeEmail').length, 0);

  deps.fakes.sendChallengeEmail = () => false;
  res = await email.send(jsonRequest(EMAIL_URL, { challengeText: 'x' }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
  deps.fakes.sendChallengeEmail = () => { throw new Error('smtp down'); };
  res = await email.send(jsonRequest(EMAIL_URL, { challengeText: 'x' }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
});

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

test('sync: creates then updates only the caller\'s pending CHATBOT_GENERATED challenge', async () => {
  const dashboardOne = deps.client.seed(T_CH, { user_id: ALICE, challenge_type: 'AFTER_WORK', challenge_text: 'dash', status: 'pending', issued_date: new Date().toISOString() });
  const bobChat = deps.client.seed(T_CH, { user_id: BOB, challenge_type: 'CHATBOT_GENERATED', challenge_text: 'bob chat', status: 'pending', issued_date: new Date().toISOString() });

  let res = await sync.sync(jsonRequest(SYNC_URL, { challengeText: 'first', recommendedGear: 'Tripod', tips: 'slow down' }, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.created, true);
  assert.equal(created.challenge.challengeType, 'CHATBOT_GENERATED');
  assert.deepEqual(created.challenge.recommendedGear, ['Tripod']);
  assert.equal(created.challenge.category, 'General');

  res = await sync.sync(jsonRequest(SYNC_URL, { challengeText: 'second', category: 'street' }, { cookie: aliceCookie }));
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.updated, true);
  assert.equal(updated.challenge.id, created.challenge.id);
  assert.equal(updated.challenge.challengeText, 'second');
  assert.equal(updated.challenge.tips, 'slow down', 'missing fields keep stored values');
  assert.deepEqual(updated.challenge.recommendedGear, ['Tripod']);

  assert.equal(dashboardOne.challenge_text, 'dash', 'dashboard challenge never overwritten');
  assert.equal(bobChat.challenge_text, 'bob chat');
  assert.equal(rowsOf(T_PROGRESS, ALICE).length, 0, 'sync does not touch counters (legacy behaviour)');

  res = await sync.status(request(SYNC_URL, { cookie: aliceCookie }));
  const status = await res.json();
  assert.equal(status.hasChallenge, true);
  assert.ok([dashboardOne.id, created.challenge.id].includes(status.challenge.id));
  assert.notEqual(status.challenge.id, bobChat.id);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('sync: 401 without a session, 400 for userId or bad input', async () => {
  assert.equal((await sync.status(request(SYNC_URL))).status, 401);
  assert.equal((await sync.sync(jsonRequest(SYNC_URL, { challengeText: 'x' }))).status, 401);
  assert.equal((await sync.status(request(`${SYNC_URL}?userId=${BOB}`, { cookie: aliceCookie }))).status, 400);
  assert.equal((await sync.sync(jsonRequest(SYNC_URL, { challengeText: 'x', userId: ALICE }, { cookie: aliceCookie }))).status, 400);
  assert.equal((await sync.sync(jsonRequest(SYNC_URL, {}, { cookie: aliceCookie }))).status, 400);
  assert.equal((await sync.sync(jsonRequest(SYNC_URL, { challengeText: 42 }, { cookie: aliceCookie }))).status, 400);
  assert.equal(rowsOf(T_CH, ALICE).length, 0);
});
