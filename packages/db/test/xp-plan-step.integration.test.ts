import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createServiceClient } from '../src/service-client.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('fotoai_award_skill_xp with plan_step', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(db!, 'xp-plan');
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [user]);
  });

  test('plan_step XP is awarded once per step', async () => {
    const service = createServiceClient(testEnv(db!));
    const award = () =>
      service.rpc('fotoai_award_skill_xp', {
        p_user_id: user.id,
        p_skill_id: 'composition-basics',
        p_xp_amount: 10,
        p_source_kind: 'plan_step',
        p_source_id: stepId,
        p_xp_to_learn: 50,
        p_xp_to_practice: 150,
        p_xp_to_master: 400,
        p_prerequisite_skills: [],
      });
    const stepId = randomUUID();

    const first = await award();
    expect(first.error).toBeNull();
    expect((first.data as { outcome: string }).outcome).toBe('applied');

    const again = await award();
    expect(again.error).toBeNull();
    expect((again.data as { outcome: string }).outcome).toBe('duplicate');
  });
});
