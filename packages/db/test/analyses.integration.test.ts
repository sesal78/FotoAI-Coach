import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;

describe.skipIf(!db)('analyses on v2 photos, and the Auto theme', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'analyses-a'), createTestUser(db!, 'analyses-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const from = (user: TestUser, table: string) => createUserClient(testEnv(db!), user.token).from(table as never);
  const addPhoto = async (user: TestUser) => {
    const id = randomUUID();
    const object_key = `${user.id}/photos/${id}/abc123.jpg`;
    const res = await from(user, 'fotoai_photos').insert({ id, user_id: user.id, source: 'gallery', object_key, mime: 'image/jpeg', bytes: 1024 } as never);
    expect(res.error).toBeNull();
    return { id, object_key };
  };
  const analysis = (user: TestUser, photo: { id: string; object_key: string }, over: Row = {}) => ({
    user_id: user.id,
    photo_id: photo.id,
    photo_object_key: photo.object_key,
    ...over,
  });

  test("an analysis can only link the owner's photo", async () => {
    const mine = await addPhoto(a);
    const theirs = await addPhoto(b);
    const ok = await from(a, 'fotoai_photo_critiques').insert(analysis(a, mine) as never).select('mode, photo_id').single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ mode: 'critique', photo_id: mine.id });
    const bad = await from(a, 'fotoai_photo_critiques').insert(analysis(a, { id: theirs.id, object_key: mine.object_key }) as never);
    expect(bad.error?.message).toMatch(/fotoai_photo_critiques_photo_fkey/);
  });

  test('a mode outside the three is rejected, and details are bounded', async () => {
    const photo = await addPhoto(a);
    for (const mode of ['editing', 'recreate']) {
      expect((await from(a, 'fotoai_photo_critiques').insert(analysis(a, photo, { mode, details: { summary: 'x' } }) as never)).error, mode).toBeNull();
    }
    expect((await from(a, 'fotoai_photo_critiques').insert(analysis(a, photo, { mode: 'reverse' }) as never)).error?.message).toMatch(/mode_check/);
    const huge = { summary: 'x'.repeat(16_001) };
    expect((await from(a, 'fotoai_photo_critiques').insert(analysis(a, photo, { mode: 'editing', details: huge }) as never)).error?.message).toMatch(/details_check/);
  });

  test('deleting the photo keeps its analyses with no photo link', async () => {
    const photo = await addPhoto(a);
    const made = await from(a, 'fotoai_photo_critiques').insert(analysis(a, photo) as never).select('id').single();
    expect(made.error).toBeNull();
    expect((await from(a, 'fotoai_photos').delete().eq('id', photo.id)).error).toBeNull();
    const kept = await from(a, 'fotoai_photo_critiques').select('photo_id, user_id').eq('id', (made.data as unknown as { id: string }).id).single();
    expect(kept.data).toEqual({ photo_id: null, user_id: a.id });
  });

  test('theme auto is accepted; other values are not', async () => {
    expect((await from(a, 'fotoai_user_preferences').insert({ user_id: a.id, theme: 'auto' } as never)).error).toBeNull();
    expect((await from(b, 'fotoai_user_preferences').insert({ user_id: b.id, theme: 'neon' } as never)).error?.message).toMatch(/theme_check/);
  });
});
