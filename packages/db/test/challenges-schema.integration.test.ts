import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createServiceClient, type ServiceClient } from '../src/service-client.ts';
import { localDbFromEnv } from './support/local-db.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('fotoai_daily_challenges source and status', () => {
  let service: ServiceClient;
  let userId: string;

  beforeAll(async () => {
    service = createServiceClient({
      FOTOAI_SUPABASE_URL: db!.url,
      FOTOAI_SUPABASE_SERVICE_ROLE_KEY: db!.serviceRoleKey,
    });
    const { data, error } = await service.auth.admin.createUser({
      email: `challenges-${randomUUID()}@localhost.test`,
      password: randomBytes(18).toString('base64url'),
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await service.auth.admin.deleteUser(userId);
  });

  // Untyped insert: these columns are what the migration adds, so the test must not depend on regenerated types.
  const insert = (row: Record<string, unknown>) =>
    (service.from('fotoai_daily_challenges') as unknown as {
      insert: (r: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
    })
      .insert({ user_id: userId, challenge_text: 'test', issued_date: new Date().toISOString(), ...row })
      .select('id, source, status')
      .single();

  test('challenge source defaults to dashboard and accepts only known sources', async () => {
    const chat = await insert({ challenge_type: 'CHATBOT_GENERATED', status: 'pending' });
    expect(chat.error).toBeNull();
    expect(chat.data?.source).toBe('dashboard');

    const job = await insert({ challenge_type: 'AFTER_WORK', status: 'pending', source: 'job' });
    expect(job.error).toBeNull();
    expect(job.data?.source).toBe('job');

    const bad = await insert({ challenge_type: 'AFTER_WORK', status: 'pending', source: 'nope' });
    expect(bad.error?.message).toMatch(/fotoai_daily_challenges_source_check/);
  });

  test('superseded is a valid challenge status; unknown statuses are rejected', async () => {
    const superseded = await insert({ challenge_type: 'AFTER_WORK', status: 'superseded' });
    expect(superseded.error).toBeNull();
    expect(superseded.data?.status).toBe('superseded');

    const bogus = await insert({ challenge_type: 'AFTER_WORK', status: 'bogus' });
    expect(bogus.error?.message).toMatch(/fotoai_daily_challenges_status_check/);
  });
});
