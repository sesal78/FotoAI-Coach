import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;

describe.skipIf(!db)('fotoai_photos', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'photos-a'), createTestUser(db!, 'photos-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const from = (user: TestUser, table: string) => createUserClient(testEnv(db!), user.token).from(table as never);
  const photo = (user: TestUser, over: Row = {}) => {
    const id = randomUUID();
    return { id, user_id: user.id, source: 'gallery', object_key: `${user.id}/photos/${id}/abc123.jpg`, mime: 'image/jpeg', bytes: 1024, ...over };
  };

  test('a photo with no EXIF and no GPS is accepted with nulls', async () => {
    const row = photo(a);
    expect((await from(a, 'fotoai_photos').insert(row as never)).error).toBeNull();
    const read = await from(a, 'fotoai_photos').select('status, taken_at, lat, lng, lens_model, step_id').eq('id', row.id).single();
    expect(read.data).toEqual({ status: 'pending', taken_at: null, lat: null, lng: null, lens_model: null, step_id: null });
  });

  test("a photo key outside the owner's photos path is rejected", async () => {
    const id = randomUUID();
    for (const key of [`${b.id}/photos/${id}/x.jpg`, `${a.id}/submissions/${id}/x.jpg`, `${a.id}/photos/${randomUUID()}/x.jpg`]) {
      const res = await from(a, 'fotoai_photos').insert(photo(a, { id, object_key: key }) as never);
      expect(res.error?.message, key).toMatch(/fotoai_photos_object_key_check/);
    }
  });

  test('size, source and EXIF ranges are checked', async () => {
    for (const bad of [{ bytes: 0 }, { bytes: 52_428_801 }, { source: 'web' }, { iso: 0 }, { aperture: -1 }, { lat: 95 }, { taken_offset: '11:00' }]) {
      expect((await from(a, 'fotoai_photos').insert(photo(a, bad) as never)).error, JSON.stringify(bad)).not.toBeNull();
    }
    expect((await from(a, 'fotoai_photos').insert(photo(a, { taken_offset: '+11:00', iso: 400, aperture: 2.8, shutter_s: 0.004 }) as never)).error).toBeNull();
  });

  test("a photo cannot link another user's step, frame or roll", async () => {
    const theirRoll = randomUUID();
    expect((await from(b, 'fotoai_film_rolls').insert({ id: theirRoll, user_id: b.id, stock_name: 'x', box_iso: 400, rated_iso: 400, exposures: 36 } as never)).error).toBeNull();
    expect((await from(a, 'fotoai_photos').insert(photo(a, { roll_id: theirRoll }) as never)).error?.message).toMatch(/fotoai_photos_roll_fkey/);
    expect((await from(a, 'fotoai_photos').insert(photo(a, { frame_id: randomUUID() }) as never)).error?.message).toMatch(/fotoai_photos_frame_fkey/);
    expect((await from(a, 'fotoai_photos').insert(photo(a, { step_id: randomUUID() }) as never)).error?.message).toMatch(/fotoai_photos_step_fkey/);
  });

  test('another user and anon cannot read photos', async () => {
    const row = photo(a);
    await from(a, 'fotoai_photos').insert(row as never);
    expect((await from(b, 'fotoai_photos').select('id').eq('id', row.id)).data).toHaveLength(0);
    const env = testEnv(db!);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.from('fotoai_photos').select('id');
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
