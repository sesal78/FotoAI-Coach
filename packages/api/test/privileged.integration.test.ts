import { randomUUID } from 'node:crypto';

// The test needs the service role only to clean up Storage and read back XP rows.
// eslint-disable-next-line no-restricted-imports
import { createServiceClient } from '@fotoai/db/service';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { awardPlanStepXp } from '../src/privileged/xp.ts';
import { objectInfo, PHOTO_BUCKET, signedReadUrl, signedUploadUrl } from '../src/privileged/storage.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('privileged helpers against the local Supabase', () => {
  let a: TestUser;
  const keys: string[] = [];
  beforeAll(async () => {
    a = await createTestUser(db!, 'priv-a');
  });
  afterAll(async () => {
    if (keys.length) await createServiceClient(testEnv(db!)).storage.from(PHOTO_BUCKET).remove(keys);
    await deleteTestUsers(db!, [a]);
  });

  test("an upload link for the owner's photos path works, and the object is then visible with its size", async () => {
    const env = testEnv(db!);
    const key = `${a.id}/photos/${randomUUID()}/abc123.jpg`;
    keys.push(key);
    const link = await signedUploadUrl(env, a.id, key);
    expect(link.path).toBe(key);
    expect(link.url).toMatch(/^http/);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const up = await anon.storage.from(PHOTO_BUCKET).uploadToSignedUrl(key, link.token, bytes, { contentType: 'image/jpeg' });
    expect(up.error).toBeNull();
    expect(await objectInfo(env, a.id, key)).toEqual({ bytes: 10, mime: 'image/jpeg' });
    const read = await signedReadUrl(env, a.id, key, 300);
    expect(new Uint8Array(await (await fetch(read)).arrayBuffer())).toEqual(bytes);
    expect(await objectInfo(env, a.id, `${a.id}/photos/${randomUUID()}/missing.jpg`)).toBeNull();
  });

  test('a key outside <user>/photos/ is refused before any Storage call', async () => {
    const env = { ...testEnv(db!), FOTOAI_SUPABASE_URL: 'http://127.0.0.1:1' };
    for (const key of [`${randomUUID()}/photos/${randomUUID()}/x.jpg`, `${a.id}/submissions/${randomUUID()}/x.jpg`, `${a.id}/photos/${randomUUID()}/../x.jpg`, `${a.id}/photos/x/x.jpg`]) {
      await expect(signedUploadUrl(env, a.id, key), key).rejects.toMatchObject({ code: 'validation' });
      await expect(objectInfo(env, a.id, key), key).rejects.toMatchObject({ code: 'validation' });
      await expect(signedReadUrl(env, a.id, key, 60), key).rejects.toMatchObject({ code: 'validation' });
    }
    await expect(signedReadUrl(env, a.id, `${a.id}/photos/${randomUUID()}/x.jpg`, 301)).rejects.toMatchObject({ code: 'validation' });
  });

  test('plan-step XP is applied once and is a duplicate the second time', async () => {
    const env = testEnv(db!);
    const stepId = randomUUID();
    expect(await awardPlanStepXp(env, a.id, stepId)).toEqual(['applied', 'applied', 'applied']);
    expect(await awardPlanStepXp(env, a.id, stepId)).toEqual(['duplicate', 'duplicate', 'duplicate']);
    const { data } = await createServiceClient(env).from('fotoai_xp_events').select('skill_id, xp_amount').eq('user_id', a.id).eq('source_id', stepId);
    expect((data ?? []).map((r) => r.xp_amount)).toEqual([5, 5, 5]);
  });
});
