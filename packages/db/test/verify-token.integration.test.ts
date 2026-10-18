import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, test } from 'vitest';

import { createTokenVerifier, type Database } from '../src/index.ts';
import { createServiceClient } from '../src/service-client.ts';
import { localDbFromEnv } from './support/local-db.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('createTokenVerifier against the local Supabase', () => {
  const env = {
    FOTOAI_SUPABASE_URL: db?.url ?? '',
    FOTOAI_SUPABASE_ANON_KEY: db?.anonKey ?? '',
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: db?.serviceRoleKey ?? '',
  };

  test('a signed-in user token verifies; it stops verifying once the user is deleted', async () => {
    const service = createServiceClient(env);
    const email = `verify-${randomUUID()}@localhost.test`;
    const password = randomBytes(18).toString('base64url');
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`createUser failed: ${created.error?.message}`);
    const userId = created.data.user.id;
    try {
      const anon = createClient<Database>(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await anon.auth.signInWithPassword({ email, password });
      if (signIn.error || !signIn.data.session) throw new Error(`signIn failed: ${signIn.error?.message}`);
      const token = signIn.data.session.access_token;

      const verify = createTokenVerifier(env);
      expect(await verify(token)).toEqual({ userId, email });

      await service.auth.admin.deleteUser(userId);
      expect(await verify(token)).toBeNull();
    } finally {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  });

  test('a random string is not a valid token', async () => {
    expect(await createTokenVerifier(env)('not-a-jwt')).toBeNull();
  });
});
