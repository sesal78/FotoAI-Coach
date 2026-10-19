import { randomUUID } from 'node:crypto';

import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { addFrame, addMyGear, confirmPhoto, createPhoto, createRoll, defineV2Handler, matchScans, patchPlanStep, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe.skipIf(!db)('v2 scan matching against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;
  let body: string;
  let lens: string;

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
    [a, b] = await Promise.all([createTestUser(db!, 'scan-a'), createTestUser(db!, 'scan-b')]);
    body = (await (await call(addMyGear, a, { method: 'POST', json: { catalogId: 'nikon-fe2' } })).json()).item.id;
    lens = (await (await call(addMyGear, a, { method: 'POST', json: { catalogId: 'nikon-ai-s-50mm-f1-4' } })).json()).item.id;
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (h: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, h)(
      new Request('http://localhost/api/v2/x', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const scan = async (user: TestUser) => {
    const { photo, upload } = await (await call(createPhoto, user, { method: 'POST', json: { id: randomUUID(), source: 'scan', mime: 'image/jpeg', bytes: BYTES.length } })).json();
    const anon = createClient(deps.env.FOTOAI_SUPABASE_URL, deps.env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await anon.storage.from('fotoai-submissions').uploadToSignedUrl(upload.path, upload.token, BYTES, { contentType: 'image/jpeg' });
    expect((await call(confirmPhoto, user, { method: 'POST', params: { id: photo.id } })).status).toBe(200);
    return photo.id as string;
  };
  const step = async () => {
    const udb = createUserClient(deps.env, a.token);
    const plan = await udb.from('fotoai_shoot_plans').insert({ user_id: a.id, place_source: 'google', place_id: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ', plan_date: '2026-10-19', timezone: 'Australia/Melbourne', title: 't', summary: 's', loadout: {}, prompt_id: 'shoot-plan', prompt_version: 1, model: 'm' } as never).select('id').single();
    const planId = (plan.data as unknown as Row).id as string;
    const s = await udb.from('fotoai_plan_steps').insert({ plan_id: planId, user_id: a.id, position: 1, title: 's', instruction: 'i', settings: {} } as never).select('id').single();
    return { planId, stepId: (s.data as unknown as Row).id as string };
  };
  const rollWithFrames = async (count: number, stepId?: string) => {
    const roll = (await (await call(createRoll, a, { method: 'POST', json: { id: randomUUID(), stockId: 'ilford-hp5-plus', exposures: 36, bodyGearId: body } })).json()).roll;
    for (let n = 1; n <= count; n++) {
      const res = await call(addFrame, a, {
        method: 'POST',
        params: { id: roll.id },
        json: { id: randomUUID(), frameNo: n, lensGearId: lens, shotAt: new Date().toISOString(), settings: { mode: 'A', aperture: 8, iso: 400, focalMm: 50 }, ...(n === 1 && stepId ? { stepId } : {}) },
      });
      expect(res.status).toBe(201);
    }
    return roll.id as string;
  };
  const xpFor = async (stepId: string) => ((await createUserClient(deps.env, a.token).from('fotoai_xp_events').select('id').eq('source_id', stepId)).data ?? []).length;

  test('scans pair to frames in order', async () => {
    const rollId = await rollWithFrames(3);
    const photos = [await scan(a), await scan(a), await scan(a)];
    const res = await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: photos } });
    expect(res.status).toBe(200);
    expect((await res.json()).matches).toEqual(photos.map((photoId, i) => ({ photoId, frameNo: i + 1 })));
    const { data } = await createUserClient(deps.env, a.token).from('fotoai_photos').select('id, roll_id, frame_id').in('id', photos);
    expect((data as unknown as Row[]).every((p) => p.roll_id === rollId && p.frame_id !== null)).toBe(true);
  });

  test('an override moves one scan and the rest stay in order', async () => {
    const rollId = await rollWithFrames(3);
    const [p1, p2, p3] = [await scan(a), await scan(a), await scan(a)];
    const res = await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: [p1, p2, p3], overrides: { [p3!]: 1 } } });
    expect((await res.json()).matches).toEqual([
      { photoId: p1, frameNo: 2 },
      { photoId: p2, frameNo: 3 },
      { photoId: p3, frameNo: 1 },
    ]);
  });

  test('a step marked done with no photo or frame earns 0 XP', async () => {
    const { planId, stepId } = await step();
    const res = await call(patchPlanStep, a, { method: 'PATCH', params: { id: planId, stepId }, json: { status: 'done', updatedAt: new Date(Date.now() + 1000).toISOString() } });
    expect((await res.json()).applied).toBe(true);
    expect(await xpFor(stepId)).toBe(0);
  });

  test('re-linking does not award twice', async () => {
    const { stepId } = await step();
    const rollId = await rollWithFrames(1, stepId);
    expect(await xpFor(stepId)).toBe(3);
    const photo = await scan(a);
    await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: [photo] } });
    await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: [photo] } });
    expect(await xpFor(stepId)).toBe(3);
  });

  test("another user's photo is a 404, and a non-scan or unknown frame is a 400", async () => {
    const rollId = await rollWithFrames(1);
    const theirs = await scan(b);
    expect((await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: [theirs] } })).status).toBe(404);
    const mine = await scan(a);
    expect((await call(matchScans, a, { method: 'POST', params: { id: rollId }, json: { photoIds: [mine], overrides: { [mine]: 9 } } })).status).toBe(400);
    expect((await call(matchScans, b, { method: 'POST', params: { id: rollId }, json: { photoIds: [theirs] } })).status).toBe(404);
  });
});
