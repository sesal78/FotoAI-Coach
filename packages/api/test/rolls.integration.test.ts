import { randomUUID } from 'node:crypto';

import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { addFrame, addMyGear, createRoll, defineV2Handler, getRoll, listRolls, patchRoll, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;

describe.skipIf(!db)('v2 film rolls and frames against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;
  let meSuper: string;
  let pentax50: string;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = {
      env,
      now: () => new Date(),
      verifyToken: createTokenVerifier(env),
      fetch,
      weather: { get: async () => null },
      ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); } },
    };
    [a, b] = await Promise.all([createTestUser(db!, 'roll-a'), createTestUser(db!, 'roll-b')]);
    meSuper = (await (await call(addMyGear, a, { method: 'POST', json: { catalogId: 'pentax-me-super' } })).json()).item.id;
    pentax50 = (await (await call(addMyGear, a, { method: 'POST', json: { catalogId: 'pentax-m-50mm-f1-7' } })).json()).item.id;
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/rolls', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const newRoll = async (over: Row = {}) => {
    const json = { id: randomUUID(), stockId: 'kodak-portra-400', exposures: 36, bodyGearId: meSuper, ...over };
    return { json, res: await call(createRoll, a, { method: 'POST', json }) };
  };
  const frameBody = (over: Row = {}) => ({
    id: randomUUID(), frameNo: 1, lensGearId: pentax50, shotAt: new Date().toISOString(),
    settings: { mode: 'M', aperture: 8, shutterSeconds: 1 / 250, iso: 400, focalMm: 50 }, ...over,
  });

  test('a roll is loaded on the caller\'s film body; a digital body is a 400', async () => {
    const { res } = await newRoll();
    expect(res.status).toBe(201);
    expect((await res.json()).roll).toMatchObject({ stockName: 'Kodak Portra 400', boxIso: 400, ratedIso: 400, status: 'loaded', framesLogged: 0, framesLeft: 36 });
    const xt5 = (await (await call(addMyGear, a, { method: 'POST', json: { catalogId: 'fujifilm-x-t5' } })).json()).item.id;
    expect((await newRoll({ bodyGearId: xt5 })).res.status).toBe(400);
    expect((await newRoll({ stockId: 'kodak-colorplus-200' })).res.status).toBe(400);
  });

  test('replaying the same client id is a no-op that returns the stored record', async () => {
    const { json, res } = await newRoll();
    const roll = (await res.json()).roll;
    const again = await call(createRoll, a, { method: 'POST', json: { ...json, exposures: 24 } });
    expect(again.status).toBe(200);
    expect((await again.json()).roll).toEqual(roll);
    const frame = frameBody();
    const first = await call(addFrame, a, { method: 'POST', json: frame, params: { id: roll.id } });
    expect(first.status).toBe(201);
    const stored = (await first.json()).frame;
    const replay = await call(addFrame, a, { method: 'POST', json: { ...frame, note: 'changed' }, params: { id: roll.id } });
    expect(replay.status).toBe(200);
    expect((await replay.json()).frame).toEqual(stored);
  });

  test('a frame beyond the exposure count plus 2 is a 400; frame 38 of 36 is fine', async () => {
    const roll = (await (await newRoll()).res.json()).roll;
    expect((await call(addFrame, a, { method: 'POST', json: frameBody({ frameNo: 38 }), params: { id: roll.id } })).status).toBe(201);
    const over = await call(addFrame, a, { method: 'POST', json: frameBody({ frameNo: 39 }), params: { id: roll.id } });
    expect(over.status).toBe(400);
    const dup = await call(addFrame, a, { method: 'POST', json: frameBody({ frameNo: 38 }), params: { id: roll.id } });
    expect(dup.status).toBe(400);
    expect((await dup.json()).error).toMatch(/already logged/);
  });

  test('1/4000 on the ME Super is a 400 that names the shutter', async () => {
    const roll = (await (await newRoll()).res.json()).roll;
    const res = await call(addFrame, a, { method: 'POST', json: frameBody({ settings: { mode: 'M', aperture: 2, shutterSeconds: 1 / 4000, iso: 400, focalMm: 50 } }), params: { id: roll.id } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shutterSeconds/);
  });

  test('a frame linked to a step awards plan-step XP once', async () => {
    const db2 = createUserClient(deps.env, a.token);
    const plan = await db2.from('fotoai_shoot_plans').insert({ user_id: a.id, place_source: 'google', place_id: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ', plan_date: '2026-10-19', timezone: 'Australia/Melbourne', title: 't', summary: 's', loadout: {}, prompt_id: 'shoot-plan', prompt_version: 1, model: 'm' } as never).select('id').single();
    const planId = (plan.data as unknown as Row).id as string;
    const step = await db2.from('fotoai_plan_steps').insert({ plan_id: planId, user_id: a.id, position: 1, title: 's', instruction: 'i', settings: {} } as never).select('id').single();
    const stepId = (step.data as unknown as Row).id as string;
    const roll = (await (await newRoll()).res.json()).roll;
    expect((await call(addFrame, a, { method: 'POST', json: frameBody({ frameNo: 1, stepId }), params: { id: roll.id } })).status).toBe(201);
    expect((await call(addFrame, a, { method: 'POST', json: frameBody({ frameNo: 2, stepId }), params: { id: roll.id } })).status).toBe(201);
    const { data } = await db2.from('fotoai_xp_events').select('xp_amount').eq('source_id', stepId);
    expect((data as unknown as Row[]).map((r) => r.xp_amount)).toEqual([5, 5, 5]);
  });

  test('status only moves forward', async () => {
    const roll = (await (await newRoll()).res.json()).roll;
    const done = await call(patchRoll, a, { method: 'PATCH', json: { status: 'finished' }, params: { id: roll.id } });
    expect((await done.json()).roll).toMatchObject({ status: 'finished', finishedAt: expect.any(String) });
    expect((await call(patchRoll, a, { method: 'PATCH', json: { status: 'loaded' }, params: { id: roll.id } })).status).toBe(400);
    expect((await call(patchRoll, a, { method: 'PATCH', json: { status: 'scanned' }, params: { id: roll.id } })).status).toBe(200);
  });

  test("another user's roll is a 404, and lists show only my rolls with frame counts", async () => {
    const roll = (await (await newRoll()).res.json()).roll;
    expect((await call(getRoll, b, { params: { id: roll.id } })).status).toBe(404);
    expect((await call(addFrame, b, { method: 'POST', json: frameBody(), params: { id: roll.id } })).status).toBe(404);
    await call(addFrame, a, { method: 'POST', json: frameBody(), params: { id: roll.id } });
    const full = (await (await call(getRoll, a, { params: { id: roll.id } })).json()).roll;
    expect(full.frames).toHaveLength(1);
    const mine = (await (await call(listRolls, a)).json()).rolls as Array<{ id: string; framesLogged: number }>;
    expect(mine.find((r) => r.id === roll.id)).toMatchObject({ framesLogged: 1 });
    expect((await (await call(listRolls, b)).json()).rolls).toHaveLength(0);
  });
});
