import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import {
  addMyGear,
  defineV2Handler,
  deleteMyGear,
  getGearCatalog,
  getLoadout,
  listMyGear,
  putLoadout,
  type V2Body,
  type V2Deps,
} from '../src/index.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('v2 gear and loadout against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null }, ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); }, chat: async () => { throw new Error('no AI in this test'); } } };
    [a, b] = await Promise.all([createTestUser(db!, 'gear-a'), createTestUser(db!, 'gear-b')]);
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/x', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const add = async (user: TestUser, json: unknown) => call(addMyGear, user, { method: 'POST', json });

  test("the catalog lists Seun's 5 bodies and 9 lenses", async () => {
    const body = await (await call(getGearCatalog, a)).json();
    expect(body.bodies).toHaveLength(5);
    expect(body.lenses).toHaveLength(9);
    expect(body.bodies.find((x: { id: string }) => x.id === 'nikon-fe2').shutter.fastestSeconds).toBe(1 / 4000);
  });

  test('adding a catalog body creates a gear row the live app can read', async () => {
    const res = await add(a, { catalogId: 'nikon-fe2' });
    expect(res.status).toBe(201);
    const { item } = await res.json();
    expect(item).toMatchObject({ kind: 'body', catalogId: 'nikon-fe2', name: 'Nikon FE2' });
    const list = await (await call(listMyGear, a)).json();
    expect(list.items.map((i: { id: string }) => i.id)).toContain(item.id);
    // The live app reads category/brand/model: they are filled.
    const { data: row } = await createUserClient(deps.env, a.token)
      .from('fotoai_user_gear')
      .select('category, brand, model')
      .eq('id', item.id)
      .single();
    expect(row).toEqual({ category: 'camera', brand: 'Nikon', model: 'FE2' });
  });

  test('an unknown catalog id is a 400 that does not echo the id', async () => {
    const res = await add(a, { catalogId: 'no-such-camera' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).not.toContain('no-such-camera');
  });

  test('a malformed stored custom row does not break the gear list', async () => {
    const { error } = await createUserClient(deps.env, a.token)
      .from('fotoai_user_gear')
      .insert({ user_id: a.id, category: 'camera', brand: 'Odd', model: 'Body', custom: { kind: 'body', make: 'Odd' } } as never);
    expect(error).toBeNull();
    const res = await call(listMyGear, a);
    expect(res.status).toBe(200);
    const odd = (await res.json()).items.find((i: { name: string }) => i.name === 'Odd Body');
    expect(odd).toMatchObject({ kind: 'body', capability: null });
  });

  test('custom gear missing the shutter range is a 400 that names the field', async () => {
    const res = await add(a, {
      custom: { kind: 'body', make: 'Olympus', model: 'OM-1', type: 'film', mount: 'OM', modes: ['M'], iso: { min: 25, max: 1600 } },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation');
    expect(body.error).toContain('shutter');
  });

  test("a loadout with another user's gear is a 404; a Nikon lens on the Pentax body is a 400", async () => {
    const bBody = (await (await add(b, { catalogId: 'pentax-me-super' })).json()).item;
    const aBody = (await (await add(a, { catalogId: 'pentax-me-super' })).json()).item;
    const aNikon = (await (await add(a, { catalogId: 'nikon-ai-s-50mm-f1-4' })).json()).item;
    const aPentax = (await (await add(a, { catalogId: 'pentax-m-50mm-f1-7' })).json()).item;

    const notMine = await call(putLoadout, a, { method: 'PUT', json: { bodyGearId: bBody.id, lensGearId: aPentax.id } });
    expect(notMine.status).toBe(404);

    const misfit = await call(putLoadout, a, { method: 'PUT', json: { bodyGearId: aBody.id, lensGearId: aNikon.id } });
    expect(misfit.status).toBe(400);
    expect((await misfit.json()).error).toMatch(/does not fit/);

    const ok = await call(putLoadout, a, {
      method: 'PUT',
      json: { bodyGearId: aBody.id, lensGearId: aPentax.id, film: { stock: 'Kodak Portra 400', boxIso: 400 } },
    });
    expect(ok.status).toBe(200);
    const saved = await (await call(getLoadout, a)).json();
    expect(saved.loadout).toMatchObject({ lensGearId: aPentax.id, lens: { id: 'pentax-m-50mm-f1-7' }, film: { boxIso: 400 } });
  });

  test('a fixed-lens body makes a loadout without a lens', async () => {
    const gl = (await (await add(b, { catalogId: 'yashica-electro-35-gl' })).json()).item;
    const res = await call(putLoadout, b, { method: 'PUT', json: { bodyGearId: gl.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).loadout).toMatchObject({ lensGearId: null, lens: { id: 'yashica-electro-35-gl-40mm-f1-7' } });
  });

  test("deleting another user's gear is a 404", async () => {
    const mine = (await (await add(a, { catalogId: 'fujifilm-x-t5' })).json()).item;
    expect((await call(deleteMyGear, b, { method: 'DELETE', params: { id: mine.id } })).status).toBe(404);
    expect((await call(deleteMyGear, a, { method: 'DELETE', params: { id: mine.id } })).status).toBe(200);
  });
});
