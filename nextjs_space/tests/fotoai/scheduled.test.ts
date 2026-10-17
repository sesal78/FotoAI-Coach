// Scheduled (cron) jobs: CRON_SECRET auth, user paging, per-user isolation
// with the service role, failure isolation, weekly report de-duplication.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { bindServiceToUser } from '../../lib/fotoai/cron-data-access.ts';
import { FotoaiUpstreamError } from '../../lib/fotoai/errors.ts';
import { createScheduledHandlers } from '../../lib/fotoai/handlers/scheduled.ts';
import type { VerifiedUser } from '../../lib/fotoai/membership.ts';
import { ALICE, BOB } from './helpers/fake-supabase.ts';
import { createTestDeps, request, type TestDeps } from './helpers/deps.ts';

const SECRET = 'cron-test-secret';
const DAY = 1000 * 60 * 60 * 24;
// Wednesday 14 Oct 2026, 12:00 server-local time -> LUNCH_BREAK.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

const T_CH = 'fotoai_daily_challenges';
const T_PROGRESS = 'fotoai_user_progress';
const T_PREFS = 'fotoai_user_preferences';
const T_ACTIONS = 'fotoai_agent_actions';
const T_WEEKLY = 'fotoai_weekly_reports';
const KNOWN_USERS = new Set([ALICE, BOB]);

const ROUTES = {
  dailyChallenge: '/api/fotoai/scheduled/daily-challenge',
  streakManager: '/api/fotoai/scheduled/streak-manager',
  weatherMonitor: '/api/fotoai/scheduled/weather-monitor',
  weeklyReport: '/api/fotoai/scheduled/weekly-report',
} as const;
type Job = keyof typeof ROUTES;

interface SvcCall { op: 'select' | 'insert' | 'update'; table: string; query?: Record<string, string>; row?: Record<string, any>; patch?: Record<string, any> }

let deps: TestDeps;
let svc: SvcCall[];
let pagesRequested: number[];
let providerCalls: number;
let handlers: ReturnType<typeof createScheduledHandlers>;
let secret: string | undefined;

/** createTestDeps() plus a full record of every service-role call's filters. */
function makeDeps(): TestDeps {
  const d = createTestDeps();
  const client = d.client;
  const select = client.serviceSelect.bind(client);
  const insert = client.serviceInsert.bind(client);
  const update = client.serviceUpdate.bind(client);
  const listUsers = client.adminListUsers.bind(client);
  client.serviceSelect = (async (table: string, query: Record<string, string>) => {
    svc.push({ op: 'select', table, query: { ...query } });
    return select(table, query);
  }) as typeof client.serviceSelect;
  client.serviceInsert = (async (table: string, row: Record<string, any>) => {
    svc.push({ op: 'insert', table, row: { ...row } });
    return insert(table, row);
  }) as typeof client.serviceInsert;
  client.serviceUpdate = (async (table: string, query: Record<string, string>, patch: Record<string, any>) => {
    svc.push({ op: 'update', table, query: { ...query }, patch: { ...patch } });
    return update(table, query, patch);
  }) as typeof client.serviceUpdate;
  client.adminListUsers = async (page: number, perPage: number) => {
    pagesRequested.push(page);
    return listUsers(page, perPage);
  };
  return d;
}

function setUsers(users: VerifiedUser[]) {
  deps.client.adminListUsers = async (page: number, perPage: number) => {
    pagesRequested.push(page);
    return users.slice((page - 1) * perPage, page * perPage);
  };
}

beforeEach(() => {
  svc = [];
  pagesRequested = [];
  providerCalls = 0;
  secret = SECRET;
  deps = makeDeps();
  handlers = createScheduledHandlers(() => { providerCalls += 1; return deps; }, {
    cronSecret: () => secret,
    now: () => NOW,
    log: () => {},
  });
});

function cron(job: Job, init: { method?: string; auth?: string | null } = {}) {
  const headers: Record<string, string> = {};
  const auth = init.auth === undefined ? `Bearer ${SECRET}` : init.auth;
  if (auth !== null) headers.authorization = auth;
  return handlers[job](request(ROUTES[job], { method: init.method ?? 'GET', headers }));
}

function rowsOf(table: string, user: string) {
  return (deps.client.tables.get(table) ?? []).filter((r) => r.user_id === user);
}

function callsOf(name: string) {
  return deps.calls.filter((c) => c.name === name);
}

/** Every service-role call is pinned to one known user; updates filter id AND user_id. */
function assertEveryServiceCallScoped() {
  assert.ok(svc.length > 0);
  for (const call of svc) {
    if (call.op === 'select') {
      assert.match(call.query!.user_id ?? '', /^eq\./, `select on ${call.table} has a user_id filter`);
      assert.ok(KNOWN_USERS.has(call.query!.user_id.slice(3)), `select on ${call.table} for a listed user`);
    } else if (call.op === 'insert') {
      assert.ok(KNOWN_USERS.has(call.row!.user_id), `insert into ${call.table} carries user_id`);
    } else {
      assert.deepEqual(Object.keys(call.query!).sort(), ['id', 'user_id'], `update on ${call.table} filters id and user_id`);
      assert.ok(KNOWN_USERS.has(call.query!.user_id.slice(3)));
      assert.equal(call.patch!.user_id, undefined, 'update never changes the owner');
    }
  }
}

/** All service calls made while one user's job ran (calls are sequential per user). */
function writesFor(user: string) {
  return svc.filter((c) => c.op !== 'select' && (c.row?.user_id === user || c.query?.user_id === `eq.${user}`));
}

function seedPrefs(user: string, extra: Record<string, unknown> = {}) {
  deps.client.seed(T_PREFS, { user_id: user, skill_level: 'advanced', photography_interests: ['street'], ...extra });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test('auth: missing, wrong-scheme and wrong secrets are 401 on every job, GET and POST; nothing runs', async () => {
  for (const job of Object.keys(ROUTES) as Job[]) {
    for (const method of ['GET', 'POST']) {
      for (const auth of [null, '', 'Bearer', 'Bearer wrong-secret', `Basic ${SECRET}`, `bearer ${SECRET}`, `Bearer ${SECRET}x`]) {
        const res = await cron(job, { method, auth });
        assert.equal(res.status, 401, `${job} ${method} auth=${auth}`);
        assert.equal((await res.json()).code, 'unauthenticated');
      }
    }
  }
  assert.equal(providerCalls, 0, 'deps are not even resolved');
  assert.deepEqual(pagesRequested, []);
  assert.equal(deps.client.serviceCalls.length, 0);
  assert.equal(deps.calls.length, 0);
});

test('auth: no CRON_SECRET on the server is a 500 with a clear message, never open', async () => {
  for (const value of [undefined, '', '   ']) {
    secret = value;
    for (const job of Object.keys(ROUTES) as Job[]) {
      const res = await cron(job, { auth: `Bearer ${value ?? ''}` });
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.code, 'config');
      assert.match(body.error, /CRON_SECRET is not set/);
    }
  }
  assert.equal(providerCalls, 0);
  assert.deepEqual(pagesRequested, []);
});

test('auth: the secret is read per request (rotation needs no restart)', async () => {
  secret = 'first';
  assert.equal((await cron('streakManager', { auth: 'Bearer first' })).status, 200);
  secret = 'second';
  assert.equal((await cron('streakManager', { auth: 'Bearer first' })).status, 401);
  assert.equal((await cron('streakManager', { auth: 'Bearer second' })).status, 200);
});

test('GET and POST with no body work on every job (legacy daily-challenge POST 500ed)', async () => {
  for (const job of Object.keys(ROUTES) as Job[]) {
    for (const method of ['GET', 'POST']) {
      const res = await cron(job, { method });
      assert.equal(res.status, 200, `${job} ${method}`);
      const body = await res.json();
      assert.equal(typeof body.message, 'string');
      assert.ok(Array.isArray(body.results));
    }
  }
});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

test('users: pages through adminListUsers(page, 100) until a short page (250 users -> 3 pages)', async () => {
  const many: VerifiedUser[] = Array.from({ length: 250 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${(i + 1).toString(16).padStart(12, '0')}`,
    email: `user${i}@test.invalid`,
    name: `User ${i}`,
  }));
  setUsers(many);
  const late = many[230].id; // on page 3; legacy only ever saw the first 25 users
  deps.client.seed(T_PROGRESS, { user_id: late, current_streak: 4, last_completion_date: daysAgo(5) });

  const res = await cron('streakManager');
  assert.equal(res.status, 200);
  assert.deepEqual(pagesRequested, [1, 2, 3]);
  const body = await res.json();
  assert.equal(body.results.length, 250, 'every listed user was visited once');
  assert.deepEqual(body.results.filter((r: any) => r.status !== 'skipped'), [{ userId: late, status: 'streak_reset', previousStreak: 4 }]);
  assert.ok(body.results.every((r: any) => r.userId === late || r.reason === 'not a FotoAI user'), 'the other 249 have no FotoAI rows');
  assert.equal(rowsOf(T_PROGRESS, late)[0].current_streak, 0);
  const visited = new Set(svc.filter((c) => c.op === 'select' && c.table === T_PROGRESS).map((c) => c.query!.user_id));
  assert.equal(visited.size, 250, 'every listed user was visited');
});

test('users: an exact multiple of 100 stops at the first empty page', async () => {
  setUsers(Array.from({ length: 200 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${(i + 1).toString(16).padStart(12, '0')}`, email: null, name: null,
  })));
  assert.equal((await cron('streakManager')).status, 200);
  assert.deepEqual(pagesRequested, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// daily-challenge
// ---------------------------------------------------------------------------

const LLM_CHALLENGE = {
  challengeText: 'Shoot <b>reflections</b>',
  difficulty: 'medium',
  category: 'street',
  duration: '30 mins',
  tips: 'Use a polariser',
  recommendedGear: ['Fujifilm X-T5'],
};

test('daily-challenge: one challenge per user with preferences, own progress, own email; skipped on re-run', async () => {
  seedPrefs(ALICE, { current_location: 'Fitzroy' });
  seedPrefs(BOB, { current_location: 'Paris' });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Fujifilm', model: 'X-T5' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'camera', brand: 'Canon', model: 'R5' });
  deps.client.seed(T_PROGRESS, { user_id: BOB, total_challenges_issued: 5, lunch_break_issued: 1 });
  deps.fakes.getWeather = () => ({ condition: 'Clear', temperature: 70 });
  deps.fakes.generateChallenge = () => ({ ...LLM_CHALLENGE });
  deps.fakes.sendChallengeEmail = () => true;

  const res = await cron('dailyChallenge');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.message, 'Daily challenge generation completed');
  const aliceRow = rowsOf(T_CH, ALICE)[0];
  const bobRow = rowsOf(T_CH, BOB)[0];
  assert.deepEqual(body.results, [
    { userId: ALICE, status: 'success', challengeId: aliceRow.id, emailSent: true },
    { userId: BOB, status: 'success', challengeId: bobRow.id, emailSent: true },
  ]);
  assert.equal(aliceRow.challenge_type, 'LUNCH_BREAK', 'weekday noon with lunch photography on');
  assert.equal(aliceRow.location, 'Fitzroy');
  assert.equal(bobRow.location, 'Paris');

  const gens = callsOf('generateChallenge').map((c) => c.args[0] as any);
  assert.deepEqual(gens[0].userProfile.gear, ['Fujifilm X-T5']);
  assert.equal(gens[0].userProfile.name, 'Alice');
  assert.deepEqual(gens[1].userProfile.gear, ['Canon R5']);

  assert.equal(rowsOf(T_PROGRESS, ALICE)[0].total_challenges_issued, 1, 'progress row created');
  assert.equal(rowsOf(T_PROGRESS, BOB)[0].total_challenges_issued, 6);
  assert.equal(rowsOf(T_PROGRESS, BOB)[0].lunch_break_issued, 2);
  assert.deepEqual(rowsOf(T_ACTIONS, ALICE).map((a) => a.action_type), ['CHALLENGE_SENT']);
  assert.deepEqual(rowsOf(T_ACTIONS, BOB).map((a) => a.action_type), ['CHALLENGE_SENT']);

  const emails = callsOf('sendChallengeEmail');
  assert.deepEqual(emails.map((c) => c.args[0]), ['alice@test.invalid', 'bob@test.invalid']);
  assert.equal((emails[0].args[2] as any).challengeText, 'Shoot <b>reflections</b>', 'passed as is: lib/email.ts escapes HTML');
  assert.ok(!JSON.stringify(body).includes('@'), 'no emails in the response');
  assert.ok(!JSON.stringify(deps.logs).includes('@'), 'no emails in the logs');
  assertEveryServiceCallScoped();

  // Second run the same day: legacy "already has today's challenge" rule.
  const again = await (await cron('dailyChallenge')).json();
  assert.deepEqual(again.results.map((r: any) => r.status), ['skipped', 'skipped']);
  assert.equal(again.results[0].challengeId, aliceRow.id);
  assert.equal(rowsOf(T_CH, ALICE).length, 1);
  assert.equal(callsOf('generateChallenge').length, 2);
  assert.equal(callsOf('sendChallengeEmail').length, 2);
});

test('daily-challenge: non-members are skipped as not a FotoAI user; Saturday is WEEKEND_DEEP_DIVE', async () => {
  seedPrefs(BOB);
  deps.fakes.getWeather = () => null;
  deps.fakes.generateChallenge = () => ({ ...LLM_CHALLENGE });
  deps.fakes.sendChallengeEmail = () => true;
  const saturday = createScheduledHandlers(() => deps, {
    cronSecret: () => SECRET, now: () => new Date(2026, 9, 17, 9, 0, 0), log: () => {},
  });
  const res = await saturday.dailyChallenge(request(ROUTES.dailyChallenge, { headers: { authorization: `Bearer ${SECRET}` } }));
  const body = await res.json();
  assert.deepEqual(body.results.map((r: any) => [r.userId, r.status, r.reason]), [[ALICE, 'skipped', 'not a FotoAI user'], [BOB, 'success', undefined]]);
  assert.equal(rowsOf(T_CH, BOB)[0].challenge_type, 'WEEKEND_DEEP_DIVE');
  assert.equal(rowsOf(T_CH, ALICE).length, 0);
});

test('daily-challenge: one user\'s LLM failure does not stop the others; email failure is not a job failure', async () => {
  seedPrefs(ALICE);
  seedPrefs(BOB);
  deps.fakes.getWeather = () => null;
  deps.fakes.generateChallenge = (ctx: any) => {
    if (ctx.userProfile.name === 'Alice') throw new Error('LLM timeout');
    return { ...LLM_CHALLENGE };
  };
  deps.fakes.sendChallengeEmail = () => { throw new Error('SMTP down'); };

  const body = await (await cron('dailyChallenge')).json();
  assert.equal(body.results[0].userId, ALICE);
  assert.equal(body.results[0].status, 'error');
  assert.match(body.results[0].error, /LLM timeout/);
  assert.equal(body.results[1].userId, BOB);
  assert.equal(body.results[1].status, 'success');
  assert.equal(body.results[1].emailSent, false);
  assert.equal(rowsOf(T_CH, ALICE).length, 0);
  assert.equal(rowsOf(T_CH, BOB).length, 1);
  assert.ok(deps.logs.some((l) => l.level === 'error' && l.message.includes(ALICE)));
});

// ---------------------------------------------------------------------------
// streak-manager
// ---------------------------------------------------------------------------

test('streak-manager: resets only lapsed users, by id AND user_id, and logs STREAK_RESET for that user', async () => {
  const alice = deps.client.seed(T_PROGRESS, { user_id: ALICE, current_streak: 5, longest_streak: 9, last_completion_date: daysAgo(3) });
  const bob = deps.client.seed(T_PROGRESS, { user_id: BOB, current_streak: 3, longest_streak: 3, last_completion_date: daysAgo(1) });

  const body = await (await cron('streakManager')).json();
  assert.equal(body.message, 'Streak management completed');
  assert.deepEqual(body.results, [
    { userId: ALICE, status: 'streak_reset', previousStreak: 5 },
    { userId: BOB, status: 'streak_maintained', currentStreak: 3 },
  ]);
  assert.equal(alice.current_streak, 0);
  assert.equal(alice.longest_streak, 9);
  assert.equal(alice.last_streak_update, NOW.toISOString());
  assert.equal(bob.current_streak, 3);
  assert.equal(bob.last_streak_update, undefined, 'Bob\'s row untouched');

  const [action] = rowsOf(T_ACTIONS, ALICE);
  assert.equal(action.action_type, 'STREAK_RESET');
  assert.deepEqual(action.details, { previousStreak: 5, daysSinceCompletion: 2 });
  assert.equal(rowsOf(T_ACTIONS, BOB).length, 0);

  assertEveryServiceCallScoped();
  const update = svc.find((c) => c.op === 'update')!;
  assert.deepEqual(update.query, { id: `eq.${alice.id}`, user_id: `eq.${ALICE}` });
  assert.equal(writesFor(BOB).length, 0, 'Alice\'s job never wrote Bob\'s rows, Bob\'s job wrote nothing');
});

test('streak-manager: a streak already at 0 is not re-reset or re-logged; no completion is skipped', async () => {
  deps.client.seed(T_PROGRESS, { user_id: ALICE, current_streak: 0, last_completion_date: daysAgo(10) });
  deps.client.seed(T_PROGRESS, { user_id: BOB, current_streak: 0, last_completion_date: null });
  const body = await (await cron('streakManager')).json();
  assert.deepEqual(body.results, [{ userId: ALICE, status: 'streak_already_reset', daysSinceCompletion: 9 }]);
  assert.equal(svc.filter((c) => c.op !== 'select').length, 0);
});

// ---------------------------------------------------------------------------
// weather-monitor
// ---------------------------------------------------------------------------

test('weather-monitor: alerts users with a location and adaptToWeather when the score is >= 80', async () => {
  seedPrefs(ALICE, { adapt_to_weather: true, current_location: 'Fitzroy', home_location: 'Melbourne' });
  seedPrefs(BOB, { adapt_to_weather: true, current_location: null, home_location: null });
  deps.fakes.getWeather = (location: string) => ({ condition: 'Clear', temperature: 68, location });
  deps.fakes.analyzeWeatherForPhotography = () => ({ score: 85, recommendation: 'Golden light', suggestedStyles: ['landscape', 'street', 'portrait', 'macro'] });
  deps.fakes.sendWeatherAlert = () => true;

  const body = await (await cron('weatherMonitor')).json();
  assert.equal(body.message, 'Weather monitoring completed');
  assert.deepEqual(body.results, [{ userId: ALICE, status: 'alert_sent', score: 85, emailSent: true }]);
  assert.deepEqual(callsOf('getWeather').map((c) => c.args[0]), ['Fitzroy'], 'Bob has no location: no lookup, no San Francisco fallback');
  const [alert] = callsOf('sendWeatherAlert');
  assert.equal(alert.args[0], 'alice@test.invalid');
  assert.equal((alert.args[2] as any).suggestion, 'Great time for landscape, street, portrait photography!');
  const [action] = rowsOf(T_ACTIONS, ALICE);
  assert.equal(action.action_type, 'WEATHER_ALERT');
  assert.deepEqual(action.details, { location: 'Fitzroy', weather: { condition: 'Clear', temperature: 68 }, score: 85, emailSent: true });
  assert.equal(rowsOf(T_ACTIONS, BOB).length, 0);
  assertEveryServiceCallScoped();
});

test('weather-monitor: low score is no_alert; adaptToWeather off is skipped; a weather failure is per user', async () => {
  seedPrefs(ALICE, { adapt_to_weather: true, home_location: 'Melbourne' });
  seedPrefs(BOB, { adapt_to_weather: true, home_location: 'Lyon' });
  deps.fakes.getWeather = (location: string) => {
    if (location === 'Melbourne') throw new Error('weather API down');
    return { condition: 'Rain', temperature: 50 };
  };
  deps.fakes.analyzeWeatherForPhotography = () => ({ score: 40, recommendation: 'Stay in', suggestedStyles: [] });
  let body = await (await cron('weatherMonitor')).json();
  assert.equal(body.results[0].status, 'error');
  assert.deepEqual(body.results[1], { userId: BOB, status: 'no_alert', score: 40 });
  assert.equal(callsOf('sendWeatherAlert').length, 0);
  assert.equal(svc.filter((c) => c.op !== 'select').length, 0);

  for (const row of deps.client.tables.get(T_PREFS)!) row.adapt_to_weather = false;
  deps.calls.length = 0;
  body = await (await cron('weatherMonitor')).json();
  assert.deepEqual(body.results, []);
  assert.equal(callsOf('getWeather').length, 0);
});

// ---------------------------------------------------------------------------
// weekly-report
// ---------------------------------------------------------------------------

const INSIGHTS = { summary: 'Good week', highlights: ['Streak'], skillBreakdown: 'Composition up', recommendation: 'Try night', motivationalNote: 'Keep going' };
const WEEK_START = (() => { const d = new Date(NOW); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();

function seedWeeklyData() {
  seedPrefs(ALICE, { skill_level: 'beginner' });
  deps.client.seed(T_PROGRESS, { user_id: ALICE, current_streak: 2, longest_streak: 6 });
  // Alice: this week 3 issued (2 completed street), last week 1 completed.
  deps.client.seed(T_CH, { user_id: ALICE, status: 'completed', category: 'street', issued_date: daysAgo(1), challenge_type: 'LUNCH_BREAK', challenge_text: 'a' });
  deps.client.seed(T_CH, { user_id: ALICE, status: 'completed', category: 'street', issued_date: daysAgo(3), challenge_type: 'LUNCH_BREAK', challenge_text: 'b' });
  deps.client.seed(T_CH, { user_id: ALICE, status: 'pending', category: 'macro', issued_date: daysAgo(4), challenge_type: 'LUNCH_BREAK', challenge_text: 'c' });
  deps.client.seed(T_CH, { user_id: ALICE, status: 'completed', category: 'night', issued_date: daysAgo(10), challenge_type: 'LUNCH_BREAK', challenge_text: 'd' });
  deps.client.seed(T_CH, { user_id: ALICE, status: 'completed', category: 'old', issued_date: daysAgo(30), challenge_type: 'LUNCH_BREAK', challenge_text: 'e' });
  deps.client.seed('fotoai_challenge_submissions', { user_id: ALICE, submitted_at: daysAgo(1) });
  deps.client.seed('fotoai_challenge_submissions', { user_id: ALICE, submitted_at: daysAgo(2) });
  deps.client.seed('fotoai_challenge_submissions', { user_id: ALICE, submitted_at: daysAgo(9) });
  deps.client.seed('fotoai_photo_critiques', { user_id: ALICE, overall_score: 80, technical_score: 70, composition_score: 90, creative_score: 60, critique_date: daysAgo(1) });
  deps.client.seed('fotoai_photo_critiques', { user_id: ALICE, overall_score: 90, technical_score: 80, composition_score: 80, creative_score: 70, critique_date: daysAgo(2) });
  deps.client.seed('fotoai_photo_critiques', { user_id: ALICE, overall_score: 60, technical_score: 60, composition_score: 60, creative_score: 60, critique_date: daysAgo(8) });
  // Bob: lots of activity that must never leak into Alice's numbers. His
  // preferences row makes him a FotoAI member (no progress row).
  seedPrefs(BOB);
  for (let i = 0; i < 5; i += 1) {
    deps.client.seed(T_CH, { user_id: BOB, status: 'completed', category: 'portrait', issued_date: daysAgo(1), challenge_type: 'AFTER_WORK', challenge_text: 'x' });
    deps.client.seed('fotoai_photo_critiques', { user_id: BOB, overall_score: 10, technical_score: 10, composition_score: 10, creative_score: 10, critique_date: daysAgo(1) });
  }
  deps.fakes.generateWeeklyInsights = () => ({ ...INSIGHTS });
  deps.fakes.sendWeeklyReport = () => true;
}

test('weekly-report: computes each user\'s own stats, stores one report, emails it, logs WEEKLY_INSIGHTS_REPORT', async () => {
  seedWeeklyData();
  const body = await (await cron('weeklyReport')).json();
  assert.equal(body.message, 'Weekly insights report generation completed');
  const [aliceReport] = rowsOf(T_WEEKLY, ALICE);
  const [bobReport] = rowsOf(T_WEEKLY, BOB);
  assert.deepEqual(body.results, [
    { userId: ALICE, status: 'success', reportId: aliceReport.id, challengesCompleted: 2, emailSent: true },
    { userId: BOB, status: 'success', reportId: bobReport.id, challengesCompleted: 5, emailSent: true },
  ]);

  assert.equal(aliceReport.week_start, WEEK_START);
  assert.equal(aliceReport.week_end, NOW.toISOString().split('T')[0]);
  assert.deepEqual(aliceReport.insights, INSIGHTS);
  assert.deepEqual(aliceReport.stats, {
    weekStart: WEEK_START,
    weekEnd: NOW.toISOString().split('T')[0],
    challengesCompletedThisWeek: 2,
    challengesCompletedLastWeek: 1,
    submissionsThisWeek: 2,
    averageCritiqueScore: 85,
    previousAverageCritiqueScore: 60,
    scoreTrend: { technical: 75, composition: 85, creative: 65 },
    previousScoreTrend: { technical: 60, composition: 60, creative: 60 },
    topCategories: ['street'],
    challengeCompletionRate: 67,
    currentStreak: 2,
    longestStreak: 6,
  });
  assert.equal(bobReport.stats.averageCritiqueScore, 10);
  assert.equal(bobReport.stats.currentStreak, 0, 'no progress row');

  const [aliceInsights] = callsOf('generateWeeklyInsights');
  assert.equal((aliceInsights.args[0] as any).userName, 'Alice');
  assert.equal((aliceInsights.args[0] as any).skillLevel, 'beginner');
  const mails = callsOf('sendWeeklyReport');
  assert.deepEqual(mails.map((c) => c.args[0]), ['alice@test.invalid', 'bob@test.invalid']);
  assert.equal((mails[0].args[2] as any).completionRate, 67);

  const [action] = rowsOf(T_ACTIONS, ALICE);
  assert.equal(action.action_type, 'WEEKLY_INSIGHTS_REPORT');
  assert.deepEqual(action.details, { reportId: aliceReport.id, challengesCompleted: 2, averageScore: 85, emailSent: true });
  assertEveryServiceCallScoped();
  assert.ok(!JSON.stringify(body).includes('@'));
});

test('weekly-report: a second run for the same week does not duplicate, generate or email again', async () => {
  seedWeeklyData();
  await cron('weeklyReport');
  const again = await (await cron('weeklyReport')).json();
  assert.deepEqual(again.results.map((r: any) => [r.userId, r.status]), [[ALICE, 'skipped'], [BOB, 'skipped']]);
  assert.equal(again.results[0].reportId, rowsOf(T_WEEKLY, ALICE)[0].id);
  assert.equal(rowsOf(T_WEEKLY, ALICE).length, 1);
  assert.equal(rowsOf(T_WEEKLY, BOB).length, 1);
  assert.equal(callsOf('generateWeeklyInsights').length, 2);
  assert.equal(callsOf('sendWeeklyReport').length, 2);
  assert.equal(rowsOf(T_ACTIONS, ALICE).length, 1);
});

test('weekly-report: losing the unique (user_id, week_start) race is a skip, not an error or a second email', async () => {
  seedWeeklyData();
  const insert = deps.client.serviceInsert;
  deps.client.serviceInsert = (async (table: string, row: Record<string, any>) => {
    if (table === T_WEEKLY && row.user_id === ALICE) throw new FotoaiUpstreamError(409, 'duplicate key');
    return insert(table, row);
  }) as typeof insert;
  const body = await (await cron('weeklyReport')).json();
  assert.deepEqual(body.results[0], { userId: ALICE, status: 'skipped', reason: 'Report already exists for this week' });
  assert.equal(body.results[1].status, 'success');
  assert.deepEqual(callsOf('sendWeeklyReport').map((c) => c.args[0]), ['bob@test.invalid']);
});

test('weekly-report: one user\'s insights failure does not stop the others and stores nothing for them', async () => {
  seedWeeklyData();
  deps.fakes.generateWeeklyInsights = (ctx: any) => {
    if (ctx.userName === 'Alice') throw new Error('LLM 503');
    return { ...INSIGHTS };
  };
  const body = await (await cron('weeklyReport')).json();
  assert.equal(body.results[0].status, 'error');
  assert.match(body.results[0].error, /LLM 503/);
  assert.equal(body.results[1].status, 'success');
  assert.equal(rowsOf(T_WEEKLY, ALICE).length, 0);
  assert.equal(rowsOf(T_WEEKLY, BOB).length, 1);
});

// ---------------------------------------------------------------------------
// Membership: the shared Supabase Auth also lists other apps' users
// ---------------------------------------------------------------------------

test('membership: a shared-Auth user with no FotoAI preferences or progress row is skipped by every job before any LLM, email or write', async () => {
  const OTHER = '33333333-3333-4333-8333-333333333333';
  setUsers([{ id: OTHER, email: 'other-app@test.invalid', name: 'Other' }]);
  // Rows in other FotoAI tables do not make someone a member.
  deps.client.seed(T_CH, { user_id: OTHER, status: 'completed', category: 'street', issued_date: daysAgo(1), challenge_type: 'LUNCH_BREAK', challenge_text: 'x' });
  for (const name of ['getWeather', 'generateChallenge', 'generateWeeklyInsights', 'sendChallengeEmail', 'sendWeeklyReport', 'sendWeatherAlert', 'analyzeWeatherForPhotography']) {
    deps.fakes[name] = () => { throw new Error(`${name} must not be called for a non-member`); };
  }

  for (const job of Object.keys(ROUTES) as Job[]) {
    svc.length = 0;
    const res = await cron(job);
    assert.equal(res.status, 200, job);
    assert.deepEqual((await res.json()).results, [{ userId: OTHER, status: 'skipped', reason: 'not a FotoAI user' }], job);
    assert.ok(svc.length > 0, `${job} read membership`);
    for (const call of svc) {
      assert.equal(call.op, 'select', `${job}: only the membership read, got ${call.op} on ${call.table}`);
      assert.ok([T_PREFS, T_PROGRESS].includes(call.table), `${job}: membership read only, got ${call.table}`);
      assert.equal(call.query!.user_id, `eq.${OTHER}`);
    }
  }
  assert.deepEqual(deps.calls, [], 'no LLM, weather or email call');
  assert.equal(rowsOf(T_WEEKLY, OTHER).length, 0);
  assert.equal(rowsOf(T_ACTIONS, OTHER).length, 0);
  assert.equal(rowsOf(T_PROGRESS, OTHER).length, 0, 'no progress row created');
});

test('membership: a progress row alone (no preferences) makes a user a member', async () => {
  deps.client.seed(T_PROGRESS, { user_id: ALICE, current_streak: 5, last_completion_date: daysAgo(3) });
  const body = await (await cron('streakManager')).json();
  assert.deepEqual(body.results, [
    { userId: ALICE, status: 'streak_reset', previousStreak: 5 },
    { userId: BOB, status: 'skipped', reason: 'not a FotoAI user' },
  ]);
});

// ---------------------------------------------------------------------------
// The user-bound service access itself
// ---------------------------------------------------------------------------

test('bindServiceToUser: refuses other users\' filters, rows and owner changes; updates match id AND user_id', async () => {
  const bobRow = deps.client.seed(T_PROGRESS, { user_id: BOB, current_streak: 7 });
  const alice = bindServiceToUser(deps.client, ALICE);

  await assert.rejects(alice.select(T_PROGRESS, { user_id: `eq.${BOB}` }), /another user/);
  assert.deepEqual(await alice.select(T_PROGRESS, {}), [], 'filter is forced to Alice');
  await assert.rejects(alice.insert(T_ACTIONS, { user_id: BOB, action_type: 'X' }), /another user/);
  await assert.rejects(alice.updateById(T_PROGRESS, bobRow.id, { current_streak: 0 }), /not found/i);
  assert.equal(bobRow.current_streak, 7, 'Bob\'s row unchanged');
  await assert.rejects(alice.updateById(T_PROGRESS, bobRow.id, { user_id: BOB }), /changes the owner/);
  await assert.rejects(alice.updateById(T_PROGRESS, 'not-a-uuid', {}), /UUID/);
  assert.throws(() => bindServiceToUser(deps.client, 'not-a-uuid'), /UUID/);

  const inserted = await alice.insert<Record<string, any>>(T_ACTIONS, { action_type: 'X' });
  assert.equal(inserted.user_id, ALICE);
});
