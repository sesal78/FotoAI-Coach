import { SKILL_TREE } from '@fotoai/core';
import { createTokenVerifier } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, seedRows, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, getProgress, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('v2 progress against the local Supabase', () => {
  let deps: V2Deps;
  let fresh: TestUser;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = {
      env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null },
      ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); }, chat: async () => { throw new Error('no AI in this test'); } },
    };
    [fresh, a, b] = await Promise.all([createTestUser(db!, 'prog-f'), createTestUser(db!, 'prog-a'), createTestUser(db!, 'prog-b')]);
    await seedRows(db!, 'fotoai_user_skills', [
      { user_id: a.id, skill_id: 'exposure_triangle', current_xp: 250, status: 'learned' },
      { user_id: a.id, skill_id: 'rule_of_thirds', current_xp: 150, status: 'available' },
      { user_id: b.id, skill_id: 'exposure_triangle', current_xp: 9000, status: 'mastered' },
    ]);
    await seedRows(db!, 'fotoai_user_progress', [
      { user_id: a.id, total_challenges_completed: 4, total_challenges_issued: 7, current_streak: 2, longest_streak: 5, last_completion_date: '2026-10-19T08:00:00+00:00' },
    ]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [fresh, a, b]);
  });

  const get = (user: TestUser) =>
    defineV2Handler(() => deps, getProgress)(new Request('http://localhost/api/v2/me/progress', { headers: { authorization: `Bearer ${user.token}` } }), { params: {} });

  test('a new user is level 1 with zero XP and every skill available or locked by its prerequisites', async () => {
    const res = await get(fresh);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.xp).toEqual({ total: 0, level: 1, levelStart: 0, nextLevelAt: 100, progress: 0 });
    expect(body.streak).toEqual({ current: 0, longest: 0, lastCompletionDate: null });
    expect(body.challenges).toEqual({ completed: 0, issued: 0 });
    expect(body.skills).toHaveLength(SKILL_TREE.length);
    for (const s of body.skills) {
      const node = SKILL_TREE.find((n) => n.id === s.id)!;
      expect(s.currentXP).toBe(0);
      expect(s.status).toBe(node.prerequisites.length === 0 ? 'available' : 'locked');
    }
  });

  test('XP totals and the streak match the rows', async () => {
    const body = await (await get(a)).json();
    expect(body.xp).toEqual({ total: 400, level: 3, levelStart: 400, nextLevelAt: 900, progress: 0 });
    expect(body.streak).toEqual({ current: 2, longest: 5, lastCompletionDate: expect.stringMatching(/^2026-10-19T08:00:00/) });
    expect(body.challenges).toEqual({ completed: 4, issued: 7 });
    const exposure = body.skills.find((s: { id: string }) => s.id === 'exposure_triangle');
    expect(exposure).toMatchObject({ currentXP: 250, status: 'learned', name: expect.any(String), xpToLearn: expect.any(Number), icon: expect.any(String) });
  });

  test("another user's rows never show", async () => {
    const body = await (await get(a)).json();
    expect(body.xp.total).toBe(400);
    expect(body.skills.find((s: { id: string }) => s.id === 'exposure_triangle').currentXP).toBe(250);
  });
});
