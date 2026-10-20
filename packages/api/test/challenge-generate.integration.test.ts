import { createAi } from '@fotoai/ai';
import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { mockModel } from '../../ai/test/support/mock-model.ts';
import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, seedRows, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, generateChallenge, V2_RATE_LIMITS, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

const ANSWER = JSON.stringify({
  challengeText: 'Shoot five doorways in side light',
  category: 'architecture',
  difficulty: 'short',
  duration: '2-4 hours',
  tips: 'Walk slowly.',
  recommendedGear: ['Fujifilm X-T5'],
  shotList: null,
  narrativeContext: null,
  editingDirection: null,
  masteryArea: null,
  technicalLevel: null,
  successCriteria: null,
  whatToLookFor: null,
});

describe.skipIf(!db)('v2 new challenge against the local Supabase', () => {
  let base: Omit<V2Deps, 'ai'>;
  let a: TestUser;
  let r: TestUser;
  let c: TestUser;

  const withModel = () => {
    const model = mockModel([ANSWER]);
    const deps: V2Deps = { ...base, ai: createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model, log: { info: () => undefined, warn: () => undefined } }) };
    return { model, deps };
  };
  const post = (deps: V2Deps, user: TestUser, payload: unknown = {}) =>
    defineV2Handler(() => deps, generateChallenge)(
      new Request('http://localhost/api/v2/challenges', {
        method: 'POST',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { params: {} },
    );
  const rowsOf = async (user: TestUser) =>
    (await createUserClient(base.env, user.token).from('fotoai_daily_challenges').select('*').order('created_at')).data!;

  beforeAll(async () => {
    const env = testEnv(db!);
    base = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null } };
    [a, r, c] = await Promise.all([createTestUser(db!, 'chgen-a'), createTestUser(db!, 'chgen-r'), createTestUser(db!, 'chgen-c')]);
    await seedRows(db!, 'fotoai_user_preferences', [{ user_id: a.id, skill_level: 'advanced', photography_interests: ['street'], home_lat: -37.81, home_lng: 144.96 }]);
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [a, r, c]);
  });

  test('a first call creates a pending dashboard challenge with no location and bumps the issued counter', async () => {
    const { deps, model } = withModel();
    const res = await post(deps, a);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.challenge).toMatchObject({ challengeText: 'Shoot five doorways in side light', challengeType: 'WEEKEND_DEEP_DIVE', status: 'pending', source: 'dashboard' });
    expect(body.challenge.location).toBeUndefined();
    expect(model.doGenerateCalls).toHaveLength(1);
    const rows = await rowsOf(a);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ location: null, status: 'pending', source: 'dashboard' });
    const progress = (await createUserClient(base.env, a.token).from('fotoai_user_progress').select('total_challenges_issued, saturday_challenges_issued').single()).data!;
    expect(progress).toEqual({ total_challenges_issued: 1, saturday_challenges_issued: 1 });
  });

  test('a second call returns the same one (200, created false) without calling the model', async () => {
    const { deps, model } = withModel();
    const res = await post(deps, a, { type: 'AFTER_WORK' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(false);
    expect(body.challenge.id).toBe((await rowsOf(a))[0]!.id);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test('force makes a new one and keeps the old one pending', async () => {
    const { deps, model } = withModel();
    const res = await post(deps, a, { type: 'AFTER_WORK', force: true });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.challenge.challengeType).toBe('AFTER_WORK');
    expect(model.doGenerateCalls).toHaveLength(1);
    const rows = await rowsOf(a);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.status)).toEqual(['pending', 'pending']);
    expect(rows[1]!.id).toBe(body.challenge.id);
  });

  test('the 21st call in an hour is 429 and the model is not called', async () => {
    const now = new Date().toISOString();
    await seedRows(db!, 'fotoai_agent_actions', Array.from({ length: V2_RATE_LIMITS.challenge_generate }, () => ({ user_id: r.id, action_type: 'API_REQUEST_CHALLENGE_GENERATE', details: { route: 'challenge_generate' }, executed_at: now })));
    const { deps, model } = withModel();
    const res = await post(deps, r);
    expect(res.status).toBe(429);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await rowsOf(r)).toHaveLength(0);
  });

  test('bad input is 400 and no AI key is a config error before the reservation', async () => {
    const { deps, model } = withModel();
    expect((await post(deps, c, { type: 'BOGUS' })).status).toBe(400);
    expect((await post(deps, c, { user_id: a.id })).status).toBe(400);
    expect((await post(deps, c, { force: 'yes' })).status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
    const off: V2Deps = { ...base, ai: createAi({ apiKey: undefined, modelId: 'gpt-6-luna' }) };
    const res = await post(off, c);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('config');
    const actions = await createUserClient(base.env, c.token).from('fotoai_agent_actions').select('id').eq('action_type', 'API_REQUEST_CHALLENGE_GENERATE');
    expect(actions.data).toHaveLength(0);
  });
});
