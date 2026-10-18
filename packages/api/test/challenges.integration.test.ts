import { createTokenVerifier } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, seedRows, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, getActiveChallenge, getChallenge, listChallenges, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('v2 challenges against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;
  let other: TestUser;
  const ids: Record<string, string> = {};

  // Call handlers exactly as the route files do, so errors become envelopes.
  const route = (body: V2Body) => (request: Request, params: Record<string, string> = {}) =>
    defineV2Handler(() => deps, body)(request, { params });

  const req = (user: TestUser, path: string) =>
    new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${user.token}` } });

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null } };
    [a, b, other] = await Promise.all([createTestUser(db!, 'v2ch-a'), createTestUser(db!, 'v2ch-b'), createTestUser(db!, 'v2ch-o')]);
    const tie = '2026-10-18T05:00:00+00:00';
    const base = { challenge_type: 'AFTER_WORK', challenge_text: 'x' };
    const rows = await seedRows(db!, 'fotoai_daily_challenges', [
      { ...base, user_id: a.id, challenge_text: 'tie-old', status: 'pending', issued_date: tie, created_at: '2026-10-18T05:00:01+00:00' },
      { ...base, user_id: a.id, challenge_text: 'tie-new', status: 'pending', issued_date: tie, created_at: '2026-10-18T05:00:02+00:00' },
      { ...base, user_id: a.id, challenge_text: 'accepted-older', status: 'accepted', issued_date: '2026-10-17T05:00:00+00:00' },
      { ...base, user_id: a.id, challenge_text: 'done', status: 'completed', issued_date: '2026-10-16T05:00:00+00:00' },
      { ...base, user_id: b.id, challenge_text: 'b-pending', status: 'pending', issued_date: '2026-10-18T06:00:00+00:00' },
      { ...base, user_id: other.id, challenge_text: 'o-done', status: 'completed', issued_date: '2026-10-18T06:00:00+00:00' },
    ]);
    for (const row of rows) ids[String(row.challenge_text)] = String(row.id);
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [a, b, other]);
  });

  test('active picks the newest pending or accepted challenge, newest created_at on a tie', async () => {
    const res = await route(getActiveChallenge)(req(a, '/api/v2/challenges/active'));
    expect(res.status).toBe(200);
    expect((await res.json()).challenge.id).toBe(ids['tie-new']);
  });

  test('active is null when a user has only completed challenges', async () => {
    const res = await route(getActiveChallenge)(req(other, '/api/v2/challenges/active'));
    expect(await res.json()).toEqual({ challenge: null });
  });

  test('list pages by cursor without repeats or gaps', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const path: string = `/api/v2/challenges?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
      const body: { challenges: Array<{ challengeText: string }>; nextCursor: string | null } = await (
        await route(listChallenges)(req(a, path))
      ).json();
      seen.push(...body.challenges.map((c: { challengeText: string }) => c.challengeText));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
    expect(seen.slice(2)).toEqual(['accepted-older', 'done']);
  });

  test("another user's challenges are never returned", async () => {
    const asB = await (await route(listChallenges)(req(b, '/api/v2/challenges'))).json();
    expect(asB.challenges.map((c: { challengeText: string }) => c.challengeText)).toEqual(['b-pending']);
    const asA = await (await route(listChallenges)(req(a, '/api/v2/challenges?status=pending'))).json();
    expect(asA.challenges.map((c: { challengeText: string }) => c.challengeText).sort()).toEqual(['tie-new', 'tie-old']);
  });

  test("detail returns the owner's challenge and 404 for another user's id", async () => {
    const own = await route(getChallenge)(req(a, '/api/v2/challenges/x'), { id: ids['done']! });
    expect(own.status).toBe(200);
    expect((await own.json()).challenge.challengeText).toBe('done');
    const notMine = await route(getChallenge)(req(a, '/api/v2/challenges/x'), { id: ids['b-pending']! });
    expect(notMine.status).toBe(404);
    const badId = await route(getChallenge)(req(a, '/api/v2/challenges/x'), { id: 'not-a-uuid' });
    expect(badId.status).toBe(400);
  });
});
