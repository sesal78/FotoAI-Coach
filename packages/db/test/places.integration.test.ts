import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const PLACE = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';

describe.skipIf(!db)('fotoai_places', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'places-a'), createTestUser(db!, 'places-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const as = (user: TestUser) => createUserClient(testEnv(db!), user.token).from('fotoai_places' as never);

  test('a user pin with a name and coordinates and no place_id is accepted', async () => {
    const { data, error } = await as(a)
      .insert({ user_id: a.id, source: 'user', name: 'Point Ormond lookout', lat: -37.8836, lng: 144.9862, notes: 'sunset over the bay' } as never)
      .select('id, favourite, place_id')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ favourite: true, place_id: null });
  });

  test('a Google row with a name or coordinates is rejected by the check', async () => {
    const ok = await as(a).insert({ user_id: a.id, source: 'google', place_id: PLACE } as never);
    expect(ok.error).toBeNull();
    for (const extra of [{ name: 'Federation Square' }, { lat: -37.81, lng: 144.96 }]) {
      const bad = await as(a).insert({ user_id: a.id, source: 'google', place_id: `${PLACE}x`, ...extra } as never);
      expect(bad.error?.message, JSON.stringify(extra)).toMatch(/fotoai_places_source_shape_check/);
    }
    const pinWithPlace = await as(a).insert({ user_id: a.id, source: 'user', place_id: PLACE, name: 'x', lat: 0, lng: 0 } as never);
    expect(pinWithPlace.error?.message).toMatch(/fotoai_places_source_shape_check/);
    const pinOutOfRange = await as(a).insert({ user_id: a.id, source: 'user', name: 'x', lat: 91, lng: 0 } as never);
    expect(pinOutOfRange.error).not.toBeNull();
  });

  test('the same Google place twice for one user is rejected; two users may save it', async () => {
    const twice = await as(a).insert({ user_id: a.id, source: 'google', place_id: PLACE } as never);
    expect(twice.error?.message).toMatch(/fotoai_places_user_place_key/);
    const other = await as(b).insert({ user_id: b.id, source: 'google', place_id: PLACE } as never);
    expect(other.error).toBeNull();
  });

  test('another user cannot read, change or delete my spots', async () => {
    const mine = (await as(a).select('id').eq('source', 'user')) as unknown as { data: Row[] };
    const id = mine.data[0]!.id as string;
    const read = (await as(b).select('id').eq('id', id)) as unknown as { data: Row[] };
    expect(read.data).toHaveLength(0);
    const upd = (await as(b).update({ notes: 'mine now' } as never).eq('id', id).select('id')) as unknown as { data: Row[] };
    expect(upd.data).toHaveLength(0);
    const del = (await as(b).delete().eq('id', id).select('id')) as unknown as { data: Row[] };
    expect(del.data).toHaveLength(0);
    const steal = await as(b).insert({ user_id: a.id, source: 'user', name: 'x', lat: 0, lng: 0 } as never);
    expect(steal.error).not.toBeNull();
  });

  test('anon has no access', async () => {
    const env = testEnv(db!);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.from('fotoai_places').select('id');
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const ins = await anon.from('fotoai_places').insert({ user_id: a.id, source: 'user', name: 'x', lat: 0, lng: 0 });
    expect(ins.error).not.toBeNull();
  });
});
