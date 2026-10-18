import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, test } from 'vitest';

import { createUserClient, type Database } from '../src/index.ts';
import { createServiceClient } from '../src/service-client.ts';
import { assertLocal, localDbFromEnv, resolveDb } from './support/local-db.ts';

test('refuses a non-local Supabase URL', () => {
  expect(() => assertLocal('https://supabase.techiesandbox.com')).toThrow(/local/);
  expect(() => assertLocal('http://127.0.0.1.evil.example:54321')).toThrow(/local/);
  expect(() => assertLocal('http://127.0.0.1:54321')).not.toThrow();
});

test('fails instead of skipping when FOTOAI_REQUIRE_DB_TESTS=1', () => {
  expect(() => resolveDb({ FOTOAI_REQUIRE_DB_TESTS: '1' })).toThrow(/FOTOAI_TEST_SUPABASE_URL/);
  expect(resolveDb({})).toBeNull();
});

const db = localDbFromEnv();

describe.skipIf(!db)('RLS on fotoai_user_gear', () => {
  const env = {
    FOTOAI_SUPABASE_URL: db?.url ?? '',
    FOTOAI_SUPABASE_ANON_KEY: db?.anonKey ?? '',
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: db?.serviceRoleKey ?? '',
  };
  const service = db ? createServiceClient(env) : null;
  const created: string[] = [];

  async function newUser(): Promise<{ id: string; token: string }> {
    const email = `rls-${randomUUID()}@localhost.test`;
    const password = randomBytes(18).toString('base64url');
    const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    created.push(data.user.id);
    const anon = createClient<Database>(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await anon.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) throw new Error(`signIn failed: ${signIn.error?.message}`);
    return { id: data.user.id, token: signIn.data.session.access_token };
  }

  async function addGear(user: { id: string; token: string }): Promise<string> {
    const { data, error } = await createUserClient(env, user.token)
      .from('fotoai_user_gear')
      .insert({ user_id: user.id, category: 'camera', brand: 'Nikon', model: 'FE2' })
      .select('id')
      .single();
    if (error || !data) throw new Error(`insert failed: ${error?.message}`);
    return data.id;
  }

  let a: { id: string; token: string };
  let b: { id: string; token: string };
  let bGear: string;

  test('a user sees and edits only their own gear', async () => {
    a = await newUser();
    b = await newUser();
    const aGear = await addGear(a);
    bGear = await addGear(b);

    const asA = createUserClient(env, a.token);
    const seen = await asA.from('fotoai_user_gear').select('id');
    expect(seen.error).toBeNull();
    expect(seen.data?.map((row) => row.id)).toEqual([aGear]);

    const edit = await asA.from('fotoai_user_gear').update({ model: 'hijacked' }).eq('id', bGear).select('id');
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual([]);
  });

  test("the service client sees both users' rows", async () => {
    const { data, error } = await service!.from('fotoai_user_gear').select('id, model').in('user_id', [a.id, b.id]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.find((row) => row.id === bGear)?.model).toBe('FE2');
  });

  afterAll(async () => {
    for (const id of created) await service!.auth.admin.deleteUser(id);
  });
});
