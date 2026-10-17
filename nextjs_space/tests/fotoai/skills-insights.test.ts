import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiUpstreamError } from '../../lib/fotoai/errors.ts';
import { createInsightsHandlers } from '../../lib/fotoai/handlers/insights.ts';
import { createSkillsHandlers } from '../../lib/fotoai/handlers/skills.ts';
import { getFotoaiSkillTree, listFotoaiWeeklyReports } from '../../lib/fotoai/client-features.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';

let deps: TestDeps;
let skills: ReturnType<typeof createSkillsHandlers>;
let insights: ReturnType<typeof createInsightsHandlers>;

beforeEach(() => {
  deps = createTestDeps();
  skills = createSkillsHandlers(() => deps);
  insights = createInsightsHandlers(() => deps);
});

const alice = cookieFor(TOKEN_ALICE);
const OWNER_KEYS = ['userId', 'user_id', 'userid', 'ownerId', 'owner_id'];

function seedReport(userId: string, weekStart: string, reportDate: string, summary: string) {
  return deps.client.seed('fotoai_weekly_reports', {
    user_id: userId,
    week_start: weekStart,
    week_end: weekStart.replace(/-(\d\d)$/, (_m, d) => `-${String(Number(d) + 6).padStart(2, '0')}`),
    stats: { challengesCompletedThisWeek: 3, averageCritiqueScore: 72 },
    insights: { summary },
    report_date: reportDate,
  });
}

// ---------------------------------------------------------------------------
// skills
// ---------------------------------------------------------------------------

test('skills: 401 without a session', async () => {
  const res = await skills.get(request('/api/fotoai/skills'));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'unauthenticated');
});

test('skills: any owner alias in the query is 400', async () => {
  for (const key of OWNER_KEYS) {
    const res = await skills.get(request(`/api/fotoai/skills?${key}=${BOB}`, { cookie: alice }));
    assert.equal(res.status, 400, key);
    assert.equal((await res.json()).code, 'validation');
  }
});

test('skills: owner gets the legacy tree shape built only from own XP rows', async () => {
  deps.client.seed('fotoai_user_skills', { user_id: ALICE, skill_id: 'exposure_triangle', current_xp: 150, status: 'learned' });
  deps.client.seed('fotoai_user_skills', { user_id: BOB, skill_id: 'rule_of_thirds', current_xp: 9999, status: 'mastered' });

  const res = await skills.get(request('/api/fotoai/skills', { cookie: alice }));
  assert.equal(res.status, 200);
  const tree = await res.json();
  assert.deepEqual(Object.keys(tree).sort(), ['level', 'levelProgress', 'skills', 'totalXP', 'xpForNextLevel']);
  assert.equal(tree.totalXP, 150);
  const exposure = tree.skills.find((s: any) => s.id === 'exposure_triangle');
  assert.equal(exposure.currentXP, 150);
  assert.equal(exposure.status, 'learned');
  const thirds = tree.skills.find((s: any) => s.id === 'rule_of_thirds');
  assert.equal(thirds.currentXP, 0, 'Bob XP must not leak');
  assert.notEqual(thirds.status, 'mastered');
  for (const skill of tree.skills) {
    for (const field of ['id', 'name', 'category', 'description', 'prerequisites', 'tier', 'icon', 'xpToLearn', 'xpToPractice', 'xpToMaster', 'currentXP', 'status']) {
      assert.ok(field in skill, `skill.${field}`);
    }
  }
  assert.equal(deps.client.serviceCalls.length, 0, 'reading the tree uses the user token only');
});

test('skills: a Supabase failure is a clean 502', async () => {
  deps.client.restSelect = async () => { throw new FotoaiUpstreamError(500, 'boom'); };
  const res = await skills.get(request('/api/fotoai/skills', { cookie: alice }));
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'Upstream service error', code: 'upstream' });
});

// ---------------------------------------------------------------------------
// insights
// ---------------------------------------------------------------------------

test('insights: 401 without a session', async () => {
  const res = await insights.list(request('/api/fotoai/insights'));
  assert.equal(res.status, 401);
});

test('insights: any owner alias in the query is 400', async () => {
  for (const key of OWNER_KEYS) {
    const res = await insights.list(request(`/api/fotoai/insights?${key}=${BOB}&limit=5`, { cookie: alice }));
    assert.equal(res.status, 400, key);
  }
});

test('insights: owner sees only own reports, newest first, without userId', async () => {
  seedReport(ALICE, '2026-09-28', '2026-10-05T08:00:00.000Z', 'older');
  seedReport(ALICE, '2026-10-05', '2026-10-12T08:00:00.000Z', 'newer');
  seedReport(BOB, '2026-10-05', '2026-10-13T08:00:00.000Z', 'bob');

  const res = await insights.list(request('/api/fotoai/insights', { cookie: alice }));
  assert.equal(res.status, 200);
  const { reports } = await res.json();
  assert.equal(reports.length, 2);
  assert.deepEqual(reports.map((r: any) => r.insights.summary), ['newer', 'older']);
  assert.deepEqual(Object.keys(reports[0]).sort(), ['id', 'insights', 'reportDate', 'stats', 'weekEnd', 'weekStart']);
  assert.equal(reports[0].weekStart, '2026-10-05');
  assert.equal(reports[0].weekEnd, '2026-10-11');
  assert.equal(reports[0].stats.challengesCompletedThisWeek, 3);
  assert.equal(reports[0].reportDate, '2026-10-12T08:00:00.000Z');
  assert.equal(JSON.stringify(reports).includes(BOB), false);
});

test('insights: limit is applied and capped at 50; bad limits are 400', async () => {
  for (let i = 0; i < 3; i += 1) seedReport(ALICE, `2026-0${i + 1}-01`, `2026-0${i + 1}-08T00:00:00.000Z`, `r${i}`);
  const one = await insights.list(request('/api/fotoai/insights?limit=1', { cookie: alice }));
  assert.equal((await one.json()).reports.length, 1);

  let seenLimit = '';
  const realSelect = deps.client.restSelect.bind(deps.client);
  deps.client.restSelect = async (table, query, token) => { seenLimit = query.limit; return realSelect(table, query, token); };
  const capped = await insights.list(request('/api/fotoai/insights?limit=500', { cookie: alice }));
  assert.equal(capped.status, 200);
  assert.equal(seenLimit, '50');

  for (const bad of ['0', '-1', 'abc', '2.5']) {
    const res = await insights.list(request(`/api/fotoai/insights?limit=${bad}`, { cookie: alice }));
    assert.equal(res.status, 400, bad);
  }
});

test('insights: a Supabase failure is a clean 502', async () => {
  deps.client.restSelect = async () => { throw new FotoaiUpstreamError(503, 'down'); };
  const res = await insights.list(request('/api/fotoai/insights', { cookie: alice }));
  assert.equal(res.status, 502);
});

// ---------------------------------------------------------------------------
// browser fetchers
// ---------------------------------------------------------------------------

test('client: skills and insights fetchers call session-only FotoAI URLs', async () => {
  const urls: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith('/api/fotoai/insights')) return Response.json({ reports: [{ id: 'r1', weekStart: 'a', weekEnd: 'b', stats: {}, insights: {}, reportDate: 'c' }] });
    return Response.json({ skills: [], totalXP: 0, level: 1, levelProgress: 0, xpForNextLevel: 100 });
  };
  const tree = await getFotoaiSkillTree(fetcher);
  const reports = await listFotoaiWeeklyReports({ limit: 5 }, fetcher);
  assert.equal(tree.totalXP, 0);
  assert.equal(reports.length, 1);
  assert.deepEqual(urls, ['/api/fotoai/skills', '/api/fotoai/insights?limit=5']);
  assert.equal(urls.some((u) => /user_?id|owner/i.test(u)), false);
});
