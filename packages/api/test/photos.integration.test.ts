import { randomUUID } from 'node:crypto';

import { createAi } from '@fotoai/ai';
import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { mockModel } from '../../ai/test/support/mock-model.ts';
import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { confirmPhoto, createPhoto, defineV2Handler, getPhotoUrl, listPhotos, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6, 5, 4, 3, 2]);

describe.skipIf(!db)('v2 photos against the local Supabase (real Storage)', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = {
      env,
      now: () => new Date(),
      verifyToken: createTokenVerifier(env),
      fetch,
      weather: { get: async () => null },
      // Every check says safe and on brief, so confirm awards XP as before the checks (2E-2b).
      ai: createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model: mockModel([JSON.stringify({ safe: true, matchesBrief: 'yes', genre: 'street' })]), log: { info: () => undefined, warn: () => undefined } }),
    };
    [a, b] = await Promise.all([createTestUser(db!, 'photo-a'), createTestUser(db!, 'photo-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string>; query?: string } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request(`http://localhost/api/v2/photos${init.query ?? ''}`, {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const upload = async (link: { path: string; token: string }, bytes = BYTES) => {
    const anon = createClient(deps.env.FOTOAI_SUPABASE_URL, deps.env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await anon.storage.from('fotoai-submissions').uploadToSignedUrl(link.path, link.token, bytes, { contentType: 'image/jpeg' });
    expect(error).toBeNull();
  };
  const create = (user: TestUser, over: Row = {}) => call(createPhoto, user, { method: 'POST', json: { id: randomUUID(), source: 'camera', mime: 'image/jpeg', bytes: BYTES.length, ...over } });
  const planStep = async (user: TestUser, startsAt: string) => {
    const udb = createUserClient(deps.env, user.token);
    const plan = await udb.from('fotoai_shoot_plans').insert({ user_id: user.id, place_source: 'google', place_id: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ', plan_date: startsAt.slice(0, 10), timezone: 'Australia/Melbourne', title: 't', summary: 's', loadout: {}, prompt_id: 'shoot-plan', prompt_version: 1, model: 'm' } as never).select('id').single();
    const planId = (plan.data as unknown as Row).id as string;
    const step = await udb.from('fotoai_plan_steps').insert({ plan_id: planId, user_id: user.id, position: 1, title: 's', instruction: 'i', settings: {}, starts_at: startsAt } as never).select('id').single();
    return (step.data as unknown as Row).id as string;
  };

  test('upload, confirm and read: the signed read link serves the bytes', async () => {
    const res = await create(a);
    expect(res.status).toBe(201);
    const { photo, upload: link } = await res.json();
    expect(photo).toMatchObject({ status: 'pending', source: 'camera' });
    expect(link.path).toMatch(new RegExp(`^${a.id}/photos/${photo.id}/[a-z0-9]+\\.jpg$`));
    await upload(link);
    const done = await call(confirmPhoto, a, { method: 'POST', params: { id: photo.id } });
    expect(done.status).toBe(200);
    expect((await done.json()).photo).toMatchObject({ status: 'ready' });
    const { url, expiresAt } = await (await call(getPhotoUrl, a, { params: { id: photo.id } })).json();
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    expect(new Uint8Array(await (await fetch(url)).arrayBuffer())).toEqual(BYTES);
    const list = (await (await call(listPhotos, a)).json()).photos as Array<{ id: string }>;
    expect(list.map((p) => p.id)).toContain(photo.id);
  });

  test('EXIF with no GPS is accepted, with coordinates null', async () => {
    const res = await create(a, { exif: { cameraMake: 'RICOH', cameraModel: 'GR IIIx', focalMm: 26.1, aperture: 2.8, iso: 200, takenAt: '2026-10-19T08:00:00+11:00' } });
    const { photo } = await res.json();
    expect(photo).toMatchObject({ cameraModel: 'GR IIIx', lensModel: null, lat: null, lng: null, takenOffset: null });
  });

  test('a photo is matched to the one step whose start is within 45 minutes; two candidates leave it unmatched', async () => {
    const c = await createTestUser(db!, 'photo-c');
    try {
      const stepId = await planStep(c, '2026-10-20T08:00:00.000Z');
      const one = await (await create(c, { exif: { takenAt: '2026-10-20T08:30:00.000Z' } })).json();
      await upload(one.upload);
      const matched = (await (await call(confirmPhoto, c, { method: 'POST', params: { id: one.photo.id } })).json()).photo;
      expect(matched.stepId).toBe(stepId);
      const { data } = await createUserClient(deps.env, c.token).from('fotoai_xp_events').select('xp_amount').eq('source_id', stepId);
      expect((data as unknown as Row[]).length).toBe(3);
      await planStep(c, '2026-10-20T08:20:00.000Z');
      const two = await (await create(c, { exif: { takenAt: '2026-10-20T08:10:00.000Z' } })).json();
      await upload(two.upload);
      expect((await (await call(confirmPhoto, c, { method: 'POST', params: { id: two.photo.id } })).json()).photo.stepId).toBeNull();
    } finally {
      await deleteTestUsers(db!, [c]);
    }
  });

  test("another user's step id is a 404", async () => {
    const stepId = await planStep(b, '2026-10-21T08:00:00.000Z');
    expect((await create(a, { stepId })).status).toBe(404);
  });

  test('confirm with no uploaded object, or the wrong size, is a 400', async () => {
    const none = await (await create(a)).json();
    expect((await call(confirmPhoto, a, { method: 'POST', params: { id: none.photo.id } })).status).toBe(400);
    const wrong = await (await create(a)).json();
    await upload(wrong.upload, new Uint8Array([1, 2, 3]));
    const res = await call(confirmPhoto, a, { method: 'POST', params: { id: wrong.photo.id } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/size/i);
  });

  test('a replayed create returns the same photo', async () => {
    const json = { id: randomUUID(), source: 'gallery', mime: 'image/jpeg', bytes: BYTES.length };
    const first = await (await call(createPhoto, a, { method: 'POST', json })).json();
    const again = await call(createPhoto, a, { method: 'POST', json });
    expect(again.status).toBe(200);
    const body = await again.json();
    expect(body.photo).toEqual(first.photo);
    expect(body.upload.path).toBe(first.upload.path);
    await upload(body.upload);
    await call(confirmPhoto, a, { method: 'POST', params: { id: json.id } });
    const ready = await (await call(createPhoto, a, { method: 'POST', json })).json();
    expect(ready.photo.status).toBe('ready');
    expect(ready.upload).toBeUndefined();
    expect((await call(getPhotoUrl, b, { params: { id: json.id } })).status).toBe(404);
  });

  test('a confirm replay after a lost award still earns the plan-step XP', async () => {
    const c = await createTestUser(db!, 'photo-d');
    try {
      const stepId = await planStep(c, '2026-10-22T08:00:00.000Z');
      const { photo, upload: link } = await (await create(c, { stepId })).json();
      await upload(link);
      // The ready flag was saved but the award never ran (a crash between the two).
      await createUserClient(deps.env, c.token).from('fotoai_photos').update({ status: 'ready' } as never).eq('id', photo.id);
      expect((await call(confirmPhoto, c, { method: 'POST', params: { id: photo.id } })).status).toBe(200);
      const { data } = await createUserClient(deps.env, c.token).from('fotoai_xp_events').select('id').eq('source_id', stepId);
      expect((data as unknown as Row[]).length).toBe(3);
    } finally {
      await deleteTestUsers(db!, [c]);
    }
  });

  test('an uppercase client id is stored lowercase and works end to end', async () => {
    const id = randomUUID().toUpperCase();
    const res = await call(createPhoto, a, { method: 'POST', json: { id, source: 'gallery', mime: 'image/jpeg', bytes: BYTES.length } });
    expect(res.status).toBe(201);
    const { photo, upload: link } = await res.json();
    expect(photo.id).toBe(id.toLowerCase());
    await upload(link);
    expect((await call(confirmPhoto, a, { method: 'POST', params: { id: id.toLowerCase() } })).status).toBe(200);
  });

  test('confirm checks the uploaded type, not only the size', async () => {
    const { photo, upload: link } = await (await create(a)).json();
    const anon = createClient(deps.env.FOTOAI_SUPABASE_URL, deps.env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await anon.storage.from('fotoai-submissions').uploadToSignedUrl(link.path, link.token, BYTES, { contentType: 'application/octet-stream' });
    const res = await call(confirmPhoto, a, { method: 'POST', params: { id: photo.id } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/type/i);
  });

  test('the 201st upload in an hour is 429', async () => {
    const used = (await createUserClient(deps.env, a.token).from('fotoai_agent_actions').select('id', { count: 'exact', head: true }).eq('user_id', a.id).eq('action_type', 'API_REQUEST_PHOTO_UPLOAD')).count ?? 0;
    const at = new Date().toISOString();
    await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .insert(Array.from({ length: 200 - used }, () => ({ user_id: a.id, action_type: 'API_REQUEST_PHOTO_UPLOAD', details: {}, success: true, executed_at: at })) as never);
    expect((await create(a)).status).toBe(429);
  });
});
