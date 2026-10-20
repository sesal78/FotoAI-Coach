import { randomUUID } from 'node:crypto';

import { createAi } from '@fotoai/ai';
import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { mockModel } from '../../ai/test/support/mock-model.ts';
import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, seedRows, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { analysePhoto, confirmPhoto, createPhoto, defineV2Handler, listPhotoAnalyses, V2_RATE_LIMITS, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 3, 3, 3, 3]);
const quiet = { info: () => undefined, warn: () => undefined };

const CHECK = (safe = true) => JSON.stringify({ safe, matchesBrief: null, genre: 'street' });
const critique = (technical: number, composition = 50, creative = 50) =>
  JSON.stringify({
    technicalScore: technical, compositionScore: composition, creativeScore: creative, overallScore: 60,
    technicalFeedback: 'Sharp.', compositionFeedback: 'Centred.', creativeFeedback: 'Quiet.',
    strengths: ['sharp'], improvements: ['crop'], suggestedSettings: null,
  });
const EDITING = JSON.stringify({ summary: 'Warm it up.', steps: [{ tool: 'White balance', change: '+300K', why: 'Warmer dusk.' }], filmSimulation: null });
const RECREATE = JSON.stringify({
  estimatedSettings: { iso: '400', aperture: 'f/2.8', shutterSpeed: '1/250s', focalLength: '23mm', meteringMode: 'evaluative' },
  lightingAnalysis: { timeOfDay: 'dusk', lightType: 'natural', lightDirection: 'side', modifiers: 'none' },
  cameraPosition: 'eye level', lensType: 'wide prime', postProcessing: 'warm grade',
  shotRecipe: ['Find side light'], difficultyToRecreate: 'beginner', gearNeeded: [],
});

describe.skipIf(!db)('v2 Analyse against the local Supabase (real Storage, mock model)', () => {
  let base: Omit<V2Deps, 'ai'>;
  let a: TestUser;
  let b: TestUser;
  let r: TestUser;
  let critiqued: string;
  let firstXp: number;

  const withAnswers = (...answers: string[]) => {
    const model = mockModel(answers);
    return { model, deps: { ...base, ai: createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model, log: quiet }) } as V2Deps };
  };
  const noAi = () => ({ ...base, ai: createAi({ apiKey: undefined, modelId: 'gpt-6-luna', log: quiet }) }) as V2Deps;
  const call = (deps: V2Deps, body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/photos', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  /** An uploaded, confirmed photo: checked with `check` (a model answer), or unchecked with null. */
  const readyPhoto = async (user: TestUser, check: string | null) => {
    const made = await (await call(noAi(), createPhoto, user, { method: 'POST', json: { id: randomUUID(), source: 'camera', mime: 'image/jpeg', bytes: BYTES.length, exif: { iso: 400, aperture: 2.8 } } })).json();
    const anon = createClient(base.env.FOTOAI_SUPABASE_URL, base.env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    expect((await anon.storage.from('fotoai-submissions').uploadToSignedUrl(made.upload.path, made.upload.token, BYTES, { contentType: 'image/jpeg' })).error).toBeNull();
    const deps = check ? withAnswers(check).deps : noAi();
    expect((await call(deps, confirmPhoto, user, { method: 'POST', params: { id: made.photo.id } })).status).toBe(200);
    return made.photo.id as string;
  };
  const analyse = (deps: V2Deps, user: TestUser, id: string, json: unknown) => call(deps, analysePhoto, user, { method: 'POST', params: { id }, json });
  const critiqueXp = async (user: TestUser, photoId: string) =>
    (await createUserClient(base.env, user.token).from('fotoai_xp_events').select('id').eq('source_kind', 'critique_bonus').eq('source_id', photoId)).data!.length;
  const rowsFor = async (user: TestUser, photoId: string) =>
    (await createUserClient(base.env, user.token).from('fotoai_photo_critiques' as never).select('*').eq('photo_id', photoId)).data as unknown as Row[];

  beforeAll(async () => {
    const env = testEnv(db!);
    base = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null } };
    [a, b, r] = await Promise.all([createTestUser(db!, 'analyse-a'), createTestUser(db!, 'analyse-b'), createTestUser(db!, 'analyse-r')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b, r]);
  });

  test('a critique stores scores and awards critique XP', async () => {
    critiqued = await readyPhoto(a, CHECK());
    const { deps, model } = withAnswers(critique(80));
    const res = await analyse(deps, a, critiqued, { mode: 'critique' });
    expect(res.status).toBe(201);
    const { analysis } = await res.json();
    expect(analysis).toMatchObject({ mode: 'critique', photoId: critiqued, critique: { technicalScore: 80, compositionScore: 50, strengths: ['sharp'] } });
    expect(JSON.stringify(model.doGenerateCalls[0]!.prompt)).toContain('ISO 400');
    const rows = await rowsFor(a, critiqued);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mode: 'critique', technical_score: 80, details: null });
    expect(String(rows[0]!.photo_object_key)).toMatch(new RegExp(`^${a.id}/photos/${critiqued}/`));
    // Technical is over the threshold; a new user's locked technical skills are skipped (live rule).
    firstXp = await critiqueXp(a, critiqued);
    expect(firstXp).toBeGreaterThan(0);
  });

  test('a second critique of the same photo awards no more XP', async () => {
    const { deps } = withAnswers(critique(95, 95, 95));
    expect((await analyse(deps, a, critiqued, { mode: 'critique' })).status).toBe(201);
    expect(await rowsFor(a, critiqued)).toHaveLength(2);
    expect(await critiqueXp(a, critiqued)).toBe(firstXp);
  });

  test('editing and recreate store details and award no XP', async () => {
    const id = await readyPhoto(a, CHECK());
    const edit = await (await analyse(withAnswers(EDITING).deps, a, id, { mode: 'editing' })).json();
    expect(edit.analysis).toMatchObject({ mode: 'editing', editing: { summary: 'Warm it up.', filmSimulation: null } });
    const again = await (await analyse(withAnswers(RECREATE).deps, a, id, { mode: 'recreate' })).json();
    expect(again.analysis).toMatchObject({ mode: 'recreate', recreate: { lensType: 'wide prime', difficultyToRecreate: 'beginner' } });
    const rows = await rowsFor(a, id);
    expect(rows.map((row) => row.mode).sort()).toEqual(['editing', 'recreate']);
    for (const row of rows) expect(row).toMatchObject({ technical_score: null, details: expect.any(Object) });
    expect(await critiqueXp(a, id)).toBe(0);
  });

  test('an unsafe photo cannot be analysed and the model is not called', async () => {
    const id = await readyPhoto(a, CHECK(false));
    const { deps, model } = withAnswers(critique(90));
    const res = await analyse(deps, a, id, { mode: 'critique' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('This photo cannot be analysed');
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await rowsFor(a, id)).toHaveLength(0);
  });

  test('an unchecked photo is checked first', async () => {
    const id = await readyPhoto(a, null);
    const { deps, model } = withAnswers(CHECK(), critique(60));
    expect((await analyse(deps, a, id, { mode: 'critique' })).status).toBe(201);
    expect(model.doGenerateCalls).toHaveLength(2);
    const photo = (await createUserClient(base.env, a.token).from('fotoai_photos').select('checked_at, check_safe').eq('id', id).single()).data!;
    expect(photo).toMatchObject({ check_safe: true, checked_at: expect.any(String) });
  });

  test("another user's photo is 404 and bad input is 400, both without the model", async () => {
    const { deps, model } = withAnswers(critique(90));
    expect((await analyse(deps, b, critiqued, { mode: 'critique' })).status).toBe(404);
    expect((await analyse(deps, a, critiqued, { mode: 'reverse' })).status).toBe(400);
    expect((await analyse(deps, a, critiqued, { mode: 'critique', user_id: b.id })).status).toBe(400);
    expect((await analyse(deps, a, 'not-a-uuid', { mode: 'critique' })).status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
    const res = await analyse(noAi(), a, critiqued, { mode: 'critique' });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('config');
  });

  test('the 31st analysis in an hour is 429 and the model is not called', async () => {
    const id = await readyPhoto(r, CHECK());
    const now = new Date().toISOString();
    await seedRows(db!, 'fotoai_agent_actions', Array.from({ length: V2_RATE_LIMITS.photo_analyse }, () => ({ user_id: r.id, action_type: 'API_REQUEST_PHOTO_ANALYSE', details: { route: 'photo_analyse' }, executed_at: now })));
    const { deps, model } = withAnswers(critique(90));
    expect((await analyse(deps, r, id, { mode: 'critique' })).status).toBe(429);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("GET lists only the caller's analyses, newest first", async () => {
    const res = await call(noAi(), listPhotoAnalyses, a, { params: { id: critiqued } });
    expect(res.status).toBe(200);
    const { analyses } = await res.json();
    expect(analyses.map((x: { critique: { technicalScore: number } }) => x.critique.technicalScore)).toEqual([95, 80]);
    expect((await call(noAi(), listPhotoAnalyses, b, { params: { id: critiqued } })).status).toBe(404);
  });
});
