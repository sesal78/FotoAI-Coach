import { createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { reserveCalls, V2_RATE_LIMITS, type Principal } from '../src/index.ts';

const db = localDbFromEnv();
const NOW = new Date();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe.skipIf(!db)('v2 rate limits against the local Supabase', () => {
  let a: TestUser;
  let b: TestUser;
  const env = () => testEnv(db!);
  const principal = (u: TestUser): Principal => ({ userId: u.id, email: u.email, accessToken: u.token });
  const rows = async (u: TestUser, actionType: string) => {
    const { count } = await createUserClient(env(), u.token)
      .from('fotoai_agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .eq('action_type', actionType);
    return count ?? 0;
  };
  const seed = async (u: TestUser, actionType: string, n: number, at: string) => {
    const { error } = await createUserClient(env(), u.token)
      .from('fotoai_agent_actions')
      .insert(Array.from({ length: n }, () => ({ user_id: u.id, action_type: actionType, details: {}, success: true, executed_at: at })) as never);
    expect(error).toBeNull();
  };

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'rate-a'), createTestUser(db!, 'rate-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  test('the 121st places call within an hour is a 429', async () => {
    expect(V2_RATE_LIMITS.places).toBe(120);
    await seed(a, 'API_REQUEST_PLACES', 120, minutesAgo(5));
    await expect(reserveCalls(env(), principal(a), 'places', 1, NOW)).rejects.toMatchObject({ code: 'rate_limited', status: 429 });
    await expect(reserveCalls(env(), principal(a), 'places', 1, NOW)).rejects.toThrow(/120 places requests per hour/);
  });

  test('one user’s calls do not count against another', async () => {
    await expect(reserveCalls(env(), principal(b), 'places', 1, NOW)).resolves.toBeUndefined();
    expect(await rows(b, 'API_REQUEST_PLACES')).toBe(1);
  });

  test('a batch of 5 is refused when only 4 are left, and writes nothing', async () => {
    await seed(b, 'API_REQUEST_PLACE_PHOTOS', V2_RATE_LIMITS.place_photos - 4, minutesAgo(10));
    const before = await rows(b, 'API_REQUEST_PLACE_PHOTOS');
    await expect(reserveCalls(env(), principal(b), 'place_photos', 5, NOW)).rejects.toMatchObject({ code: 'rate_limited' });
    expect(await rows(b, 'API_REQUEST_PLACE_PHOTOS')).toBe(before);
    await expect(reserveCalls(env(), principal(b), 'place_photos', 4, NOW)).resolves.toBeUndefined();
    expect(await rows(b, 'API_REQUEST_PLACE_PHOTOS')).toBe(before + 4);
  });

  test('rows older than an hour do not count', async () => {
    const c = await createTestUser(db!, 'rate-c');
    try {
      await seed(c, 'API_REQUEST_PLACES', 120, minutesAgo(61));
      await expect(reserveCalls(env(), principal(c), 'places', 1, NOW)).resolves.toBeUndefined();
    } finally {
      await deleteTestUsers(db!, [c]);
    }
  });
});
