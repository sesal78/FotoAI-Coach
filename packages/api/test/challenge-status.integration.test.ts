import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, seedRows, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, patchChallenge, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('v2 challenge status against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;
  const ids: Record<string, string> = {};
  const now = new Date('2026-10-19T09:00:00Z');

  const patch = (user: TestUser, id: string, body: unknown) =>
    defineV2Handler(() => deps, patchChallenge)(
      new Request(`http://localhost/api/v2/challenges/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: { id } },
    );

  const progressOf = async (user: TestUser) =>
    (await createUserClient(deps.env, user.token).from('fotoai_user_progress').select('*').single()).data!;
  const xpEventsFor = async (user: TestUser, challengeId: string) =>
    (await createUserClient(deps.env, user.token).from('fotoai_xp_events').select('id').eq('source_kind', 'challenge_complete').eq('source_id', challengeId)).data!;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = {
      env, now: () => now, verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null },
      ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); }, chat: async () => { throw new Error('no AI in this test'); } },
    };
    [a, b] = await Promise.all([createTestUser(db!, 'v2cs-a'), createTestUser(db!, 'v2cs-b')]);
    const base = { challenge_type: 'AFTER_WORK', category: 'street', difficulty: 'quick', issued_date: '2026-10-19T05:00:00+00:00' };
    const rows = await seedRows(db!, 'fotoai_daily_challenges', [
      { ...base, user_id: a.id, challenge_text: 'walk', status: 'pending' },
      { ...base, user_id: a.id, challenge_text: 'done-already', status: 'completed' },
      { ...base, user_id: b.id, challenge_text: 'b-only', status: 'pending' },
    ]);
    for (const row of rows) ids[String(row.challenge_text)] = String(row.id);
    await seedRows(db!, 'fotoai_user_progress', [
      { user_id: a.id, total_challenges_completed: 5, current_streak: 2, longest_streak: 2, last_completion_date: '2026-10-18T09:00:00+00:00', after_work_completed: 1 },
    ]);
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  test('pending → accepted → completed updates the streak once and awards XP once', async () => {
    const accepted = await patch(a, ids['walk']!, { status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ changed: true, challenge: { status: 'accepted', completedDate: null } });
    expect((await progressOf(a)).total_challenges_completed).toBe(5);

    const completed = await patch(a, ids['walk']!, { status: 'completed' });
    expect(completed.status).toBe(200);
    const body = await completed.json();
    expect(body).toMatchObject({ changed: true, challenge: { status: 'completed' } });
    expect(Date.parse(body.challenge.completedDate)).toBe(now.getTime());

    const progress = await progressOf(a);
    expect(progress).toMatchObject({ total_challenges_completed: 6, current_streak: 3, longest_streak: 3, after_work_completed: 2 });
    expect((await xpEventsFor(a, ids['walk']!)).length).toBeGreaterThan(0);
  });

  test('completing twice is a no-op', async () => {
    const before = await progressOf(a);
    const xpBefore = (await xpEventsFor(a, ids['walk']!)).length;
    const again = await patch(a, ids['walk']!, { status: 'completed' });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ changed: false, challenge: { status: 'completed' } });
    expect(await progressOf(a)).toEqual(before);
    expect((await xpEventsFor(a, ids['walk']!)).length).toBe(xpBefore);
  });

  test('a completed challenge cannot go back to pending, and bad bodies are 400', async () => {
    const back = await patch(a, ids['done-already']!, { status: 'accepted' });
    expect(back.status).toBe(400);
    expect((await back.json()).error).toMatch(/completed.*accepted/);
    expect((await patch(a, ids['done-already']!, { status: 'pending' })).status).toBe(400);
    expect((await patch(a, ids['done-already']!, { status: 'completed', extra: 1 })).status).toBe(400);
    expect((await patch(a, 'not-a-uuid', { status: 'accepted' })).status).toBe(400);
  });

  test("another user's id is a 404 and their row is unchanged", async () => {
    const res = await patch(a, ids['b-only']!, { status: 'completed' });
    expect(res.status).toBe(404);
    const row = (await createUserClient(deps.env, b.token).from('fotoai_daily_challenges').select('status').eq('id', ids['b-only']!).single()).data!;
    expect(row.status).toBe('pending');
  });

  test('an uppercase id works like the lowercase one', async () => {
    const res = await patch(a, ids['done-already']!.toUpperCase(), { status: 'completed' });
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(false);
  });
});
