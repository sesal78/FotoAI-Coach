import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;

describe.skipIf(!db)('fotoai_film_rolls and fotoai_film_frames', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'rolls-a'), createTestUser(db!, 'rolls-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const from = (user: TestUser, table: string) => createUserClient(testEnv(db!), user.token).from(table as never);
  const gear = async (user: TestUser, bodyId = 'pentax-me-super') => {
    const { data, error } = await from(user, 'fotoai_user_gear').insert({ user_id: user.id, category: 'camera', brand: 'Pentax', model: 'ME Super', body_id: bodyId } as never).select('id').single();
    expect(error).toBeNull();
    return (data as unknown as Row).id as string;
  };
  const roll = async (user: TestUser, over: Row = {}) => {
    const id = randomUUID();
    const { error } = await from(user, 'fotoai_film_rolls').insert({ id, user_id: user.id, stock_id: 'kodak-portra-400', stock_name: 'Kodak Portra 400', box_iso: 400, rated_iso: 400, exposures: 36, ...over } as never);
    expect(error).toBeNull();
    return id;
  };
  const frame = (user: TestUser, rollId: string, frameNo: number, over: Row = {}) => ({
    id: randomUUID(), roll_id: rollId, user_id: user.id, frame_no: frameNo, settings: { mode: 'A', aperture: 8 }, shot_at: new Date().toISOString(), ...over,
  });

  test('a roll and its frames are saved and read back by the owner', async () => {
    const id = await roll(a, { body_gear_id: await gear(a) });
    expect((await from(a, 'fotoai_film_frames').insert([frame(a, id, 1), frame(a, id, 2)] as never)).error).toBeNull();
    const read = await from(a, 'fotoai_film_rolls').select('status, exposures').eq('id', id).single();
    expect(read.data).toMatchObject({ status: 'loaded', exposures: 36 });
    expect((await from(a, 'fotoai_film_frames').select('frame_no').eq('roll_id', id).order('frame_no')).data).toEqual([{ frame_no: 1 }, { frame_no: 2 }]);
  });

  test('a frame cannot be changed or deleted by the user, but deleting the roll deletes its frames', async () => {
    const id = await roll(a);
    const f = frame(a, id, 1);
    await from(a, 'fotoai_film_frames').insert(f as never);
    const upd = await from(a, 'fotoai_film_frames').update({ note: 'changed' } as never).eq('id', f.id).select('id');
    expect(upd.error !== null || (upd.data as unknown as Row[]).length === 0).toBe(true);
    const del = await from(a, 'fotoai_film_frames').delete().eq('id', f.id).select('id');
    expect(del.error !== null || (del.data as unknown as Row[]).length === 0).toBe(true);
    expect((await from(a, 'fotoai_film_rolls').delete().eq('id', id)).error).toBeNull();
    expect((await from(a, 'fotoai_film_frames').select('id').eq('roll_id', id)).data).toHaveLength(0);
  });

  test("a frame cannot point at another user's roll, gear or step", async () => {
    const theirRoll = await roll(b);
    expect((await from(a, 'fotoai_film_frames').insert(frame(a, theirRoll, 1) as never)).error).not.toBeNull();
    const mine = await roll(a);
    const theirGear = await gear(b);
    expect((await from(a, 'fotoai_film_frames').insert(frame(a, mine, 1, { lens_gear_id: theirGear }) as never)).error?.message).toMatch(/fotoai_film_frames_lens_fkey/);
    expect((await from(a, 'fotoai_film_frames').insert(frame(a, mine, 2, { step_id: randomUUID() }) as never)).error?.message).toMatch(/fotoai_film_frames_step_fkey/);
    expect((await from(a, 'fotoai_film_rolls').insert({ id: randomUUID(), user_id: a.id, stock_name: 'x', box_iso: 400, rated_iso: 400, exposures: 36, body_gear_id: theirGear } as never)).error?.message).toMatch(/fotoai_film_rolls_body_fkey/);
  });

  test('the same frame number twice on one roll is rejected', async () => {
    const id = await roll(a);
    expect((await from(a, 'fotoai_film_frames').insert(frame(a, id, 5) as never)).error).toBeNull();
    expect((await from(a, 'fotoai_film_frames').insert(frame(a, id, 5) as never)).error?.message).toMatch(/fotoai_film_frames_roll_frame_key/);
  });

  test('deleting the body gear keeps the roll, with body_gear_id null', async () => {
    const g = await gear(a);
    const id = await roll(a, { body_gear_id: g });
    expect((await from(a, 'fotoai_user_gear').delete().eq('id', g)).error).toBeNull();
    expect((await from(a, 'fotoai_film_rolls').select('body_gear_id').eq('id', id).single()).data).toMatchObject({ body_gear_id: null });
  });

  test('another user and anon cannot read rolls or frames', async () => {
    const id = await roll(a);
    await from(a, 'fotoai_film_frames').insert(frame(a, id, 1) as never);
    expect((await from(b, 'fotoai_film_rolls').select('id').eq('id', id)).data).toHaveLength(0);
    expect((await from(b, 'fotoai_film_frames').select('id').eq('roll_id', id)).data).toHaveLength(0);
    const env = testEnv(db!);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    for (const table of ['fotoai_film_rolls', 'fotoai_film_frames']) {
      const { data, error } = await anon.from(table).select('id');
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });
});
