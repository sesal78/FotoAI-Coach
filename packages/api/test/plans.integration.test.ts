import { readFileSync } from 'node:fs';

import { createAi } from '@fotoai/ai';
import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import {
  addMyGear,
  defineV2Handler,
  generatePlan,
  getPlan,
  listPlans,
  patchPlanStep,
  putLoadout,
  type V2Body,
  type V2Deps,
} from '../src/index.ts';

const db = localDbFromEnv();
const DETAILS = readFileSync(new URL('../../places/test/fixtures/places-details.json', import.meta.url), 'utf8');
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';

const settings = (s: Record<string, unknown>) => ({ aperture: null, shutterSeconds: null, iso: null, focalMm: null, whiteBalance: null, filmSimulation: null, ...s });
const PLAN = JSON.stringify({
  title: 'Federation Square at dusk',
  summary: 'Two frames around sunset.',
  steps: [
    { title: 'Facade', instruction: 'Frame the facade from the steps.', tip: null, startsAt: '2026-10-18T19:10:00+11:00', settings: settings({ mode: 'A', aperture: 8, iso: 125, focalMm: 24 }) },
    { title: 'Blue hour', instruction: 'Wait for the lights.', tip: 'Use a wall as a rest.', startsAt: null, settings: settings({ mode: 'A', aperture: 4, iso: 800, focalMm: 35 }) },
  ],
});

describe.skipIf(!db)('v2 shoot plans against the local Supabase', () => {
  let deps: V2Deps;
  let model: MockLanguageModelV4;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = { ...testEnv(db!), GOOGLE_MAPS_SERVER_API_KEY: 'AIzaFAKE-test', OPENAI_API_KEY: 'sk-test' };
    model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: PLAN }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: { inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 200, text: 200, reasoning: 0 } },
        warnings: [],
      }),
    });
    deps = {
      env,
      now: () => new Date(),
      verifyToken: createTokenVerifier(env),
      fetch: async () => new Response(DETAILS),
      weather: { get: async () => null },
      ai: createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model, log: { info: () => undefined, warn: () => undefined } }),
    };
    [a, b] = await Promise.all([createTestUser(db!, 'plan-a'), createTestUser(db!, 'plan-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/plans', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const useKit = async (user: TestUser, bodyId: string, lensId: string, film?: unknown) => {
    const body = (await (await call(addMyGear, user, { method: 'POST', json: { catalogId: bodyId } })).json()).item;
    const lens = (await (await call(addMyGear, user, { method: 'POST', json: { catalogId: lensId } })).json()).item;
    const res = await call(putLoadout, user, { method: 'PUT', json: { bodyGearId: body.id, lensGearId: lens.id, ...(film ? { film } : {}) } });
    expect(res.status).toBe(200);
  };

  test('no saved loadout is a 400 that says so', async () => {
    const res = await call(generatePlan, a, { method: 'POST', json: { placeId: FED, date: '2026-10-18' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/loadout/i);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test('a plan is generated, saved with only the place_id, and read back with the fresh name', async () => {
    await useKit(a, 'fujifilm-x-t5', 'sigma-18-50mm-f2-8-dc-dn-x');
    const res = await call(generatePlan, a, { method: 'POST', json: { placeId: FED, date: '2026-10-18' } });
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    expect(plan).toMatchObject({ placeSource: 'google', placeId: FED, placeName: 'Federation Square', date: '2026-10-18', timezone: 'Australia/Melbourne', status: 'active' });
    expect(plan.steps).toHaveLength(2);
    expect(plan.title).toBe('this spot at dusk');
    const { data: row } = await createUserClient(deps.env, a.token).from('fotoai_shoot_plans').select('*').eq('id', plan.id).single();
    expect(JSON.stringify(row)).not.toMatch(/federation square/i);
    const read = await (await call(getPlan, a, { params: { id: plan.id } })).json();
    expect(read.plan).toMatchObject({ id: plan.id, placeName: 'Federation Square', placeUnavailable: false });
    expect(read.plan.steps.map((s: { position: number }) => s.position)).toEqual([1, 2]);
    const list = await (await call(listPlans, a)).json();
    expect(list.plans.map((p: { id: string }) => p.id)).toContain(plan.id);
  });

  test('a film body with no film loaded is a 400', async () => {
    const c = await createTestUser(db!, 'plan-c');
    try {
      const body = (await (await call(addMyGear, c, { method: 'POST', json: { catalogId: 'nikon-fe2' } })).json()).item;
      const lens = (await (await call(addMyGear, c, { method: 'POST', json: { catalogId: 'nikon-ai-s-50mm-f1-4' } })).json()).item;
      expect((await call(putLoadout, c, { method: 'PUT', json: { bodyGearId: body.id, lensGearId: lens.id } })).status).toBe(200);
      const res = await call(generatePlan, c, { method: 'POST', json: { placeId: FED } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/film/i);
    } finally {
      await deleteTestUsers(db!, [c]);
    }
  });

  test('a step patch with an older updatedAt is not applied and returns the stored step', async () => {
    const plan = (await (await call(listPlans, a)).json()).plans[0];
    const full = (await (await call(getPlan, a, { params: { id: plan.id } })).json()).plan;
    const stepId = full.steps[0].id;
    const later = new Date(Date.now() + 60_000).toISOString();
    const done = await call(patchPlanStep, a, { method: 'PATCH', json: { status: 'done', updatedAt: later }, params: { id: plan.id, stepId } });
    expect(await done.json()).toMatchObject({ applied: true, step: { status: 'done' } });
    const older = await call(patchPlanStep, a, { method: 'PATCH', json: { status: 'skipped', updatedAt: new Date(Date.now() - 60_000).toISOString() }, params: { id: plan.id, stepId } });
    expect(older.status).toBe(200);
    expect(await older.json()).toMatchObject({ applied: false, step: { status: 'done' } });
  });

  test('replaying the same step patch is a no-op that returns the stored step', async () => {
    const plan = (await (await call(listPlans, a)).json()).plans[0];
    const full = (await (await call(getPlan, a, { params: { id: plan.id } })).json()).plan;
    const stepId = full.steps[1].id;
    const patch = { status: 'done', updatedAt: new Date(Date.now() + 120_000).toISOString() };
    const first = await (await call(patchPlanStep, a, { method: 'PATCH', json: patch, params: { id: plan.id, stepId } })).json();
    const again = await call(patchPlanStep, a, { method: 'PATCH', json: patch, params: { id: plan.id, stepId } });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ applied: false, step: first.step });
    const future = await call(patchPlanStep, a, { method: 'PATCH', json: { status: 'todo', updatedAt: new Date(Date.now() + 3_600_000).toISOString() }, params: { id: plan.id, stepId } });
    expect(future.status).toBe(400);
  });

  test("another user's plan and step are 404", async () => {
    const plan = (await (await call(listPlans, a)).json()).plans[0];
    const full = (await (await call(getPlan, a, { params: { id: plan.id } })).json()).plan;
    expect((await call(getPlan, b, { params: { id: plan.id } })).status).toBe(404);
    const steal = await call(patchPlanStep, b, { method: 'PATCH', json: { status: 'done', updatedAt: new Date().toISOString() }, params: { id: plan.id, stepId: full.steps[0].id } });
    expect(steal.status).toBe(404);
  });

  test('the 21st plan in an hour is 429 and the model is not called', async () => {
    const used = (await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.id)
      .eq('action_type', 'API_REQUEST_PLAN_GENERATE')).count ?? 0;
    const at = new Date().toISOString();
    await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .insert(Array.from({ length: 20 - used }, () => ({ user_id: a.id, action_type: 'API_REQUEST_PLAN_GENERATE', details: {}, success: true, executed_at: at })) as never);
    const calls = model.doGenerateCalls.length;
    const res = await call(generatePlan, a, { method: 'POST', json: { placeId: FED } });
    expect(res.status).toBe(429);
    expect(model.doGenerateCalls).toHaveLength(calls);
  });
});
