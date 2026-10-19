import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;

describe.skipIf(!db)('fotoai_coach_messages and photo checks', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'coach-a'), createTestUser(db!, 'coach-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const from = (user: TestUser, table: string) => createUserClient(testEnv(db!), user.token).from(table as never);

  test('coach messages are owner-only and cannot be edited', async () => {
    const id = randomUUID();
    const row = { id, user_id: a.id, role: 'user', content: 'what should I shoot?', context: { screen: 'today' } };
    expect((await from(a, 'fotoai_coach_messages').insert(row as never)).error).toBeNull();
    const read = await from(a, 'fotoai_coach_messages').select('role, content, context, proposal').eq('id', id).single();
    expect(read.data).toEqual({ role: 'user', content: 'what should I shoot?', context: { screen: 'today' }, proposal: null });

    // No update grant: the content stays as written.
    const edit = await from(a, 'fotoai_coach_messages').update({ content: 'changed' } as never).eq('id', id).select('id');
    expect(edit.error !== null || (edit.data ?? []).length === 0).toBe(true);
    expect((await from(a, 'fotoai_coach_messages').select('content').eq('id', id).single()).data).toEqual({ content: 'what should I shoot?' });

    // Another user cannot read, write as a, or delete a's rows; anon reads nothing.
    expect((await from(b, 'fotoai_coach_messages').select('id').eq('id', id)).data).toHaveLength(0);
    expect((await from(b, 'fotoai_coach_messages').insert({ ...row, id: randomUUID() } as never)).error).not.toBeNull();
    await from(b, 'fotoai_coach_messages').delete().eq('id', id);
    expect((await from(a, 'fotoai_coach_messages').select('id').eq('id', id)).data).toHaveLength(1);
    const env = testEnv(db!);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const anonRead = await anon.from('fotoai_coach_messages').select('id');
    expect(anonRead.error !== null || (anonRead.data ?? []).length === 0).toBe(true);

    // The owner may delete (clear history).
    expect((await from(a, 'fotoai_coach_messages').delete().eq('id', id)).error).toBeNull();
    expect((await from(a, 'fotoai_coach_messages').select('id').eq('id', id)).data).toHaveLength(0);
  });

  test('a coach message needs a known role and 1 to 4000 characters', async () => {
    const base = (over: Row) => ({ id: randomUUID(), user_id: a.id, role: 'assistant', content: 'ok', ...over });
    for (const bad of [{ role: 'system' }, { content: '' }, { content: 'x'.repeat(4001) }]) {
      expect((await from(a, 'fotoai_coach_messages').insert(base(bad) as never)).error, JSON.stringify(bad).slice(0, 40)).not.toBeNull();
    }
    expect((await from(a, 'fotoai_coach_messages').insert(base({ content: 'x'.repeat(4000), proposal: { kind: 'challenge' } }) as never)).error).toBeNull();
  });

  test('a photo check outside the allowed answers is rejected', async () => {
    const id = randomUUID();
    const photo = { id, user_id: a.id, source: 'gallery', object_key: `${a.id}/photos/${id}/abc123.jpg`, mime: 'image/jpeg', bytes: 1024 };
    expect((await from(a, 'fotoai_photos').insert(photo as never)).error).toBeNull();
    for (const bad of [{ check_matches: 'maybe' }, { check_genre: 'g'.repeat(41) }]) {
      expect((await from(a, 'fotoai_photos').update(bad as never).eq('id', id)).error, JSON.stringify(bad).slice(0, 40)).not.toBeNull();
    }
    const ok = { check_safe: true, check_matches: 'unclear', check_genre: 'street', checked_at: '2026-10-19T09:00:00Z', check_prompt: 'photo-check@v1' };
    expect((await from(a, 'fotoai_photos').update(ok as never).eq('id', id)).error).toBeNull();
    const read = await from(a, 'fotoai_photos').select('check_safe, check_matches, check_genre, check_prompt').eq('id', id).single();
    expect(read.data).toEqual({ check_safe: true, check_matches: 'unclear', check_genre: 'street', check_prompt: 'photo-check@v1' });
  });
});
