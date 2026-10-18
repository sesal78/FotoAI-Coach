import { CATALOG } from '@fotoai/core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { createServiceClient } from '../src/service-client.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null ? null : Number(v));

describe.skipIf(!db)('gear catalog tables', () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await createTestUser(db!, 'gear-cat');
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [user]);
  });
  const asUser = () => createUserClient(testEnv(db!), user.token);

  test('the database catalog equals catalog.ts', async () => {
    const { data: bodies, error: e1 } = await asUser().from('fotoai_gear_bodies').select('*').order('id');
    const { data: lenses, error: e2 } = await asUser().from('fotoai_gear_lenses').select('*').order('id');
    expect(e1).toBeNull();
    expect(e2).toBeNull();
    expect((bodies as Row[]).map((r) => ({
      id: r.id, make: r.make, model: r.model, type: r.type, mount: r.mount, modes: r.modes,
      shutter: {
        slowestSeconds: num(r.shutter_slowest_s), fastestSeconds: num(r.shutter_fastest_s), bulb: r.bulb,
        ...(r.shutter_aperture_limits ? { apertureLimits: r.shutter_aperture_limits } : {}),
      },
      flashSyncSeconds: num(r.flash_sync_s),
      iso: r.iso_min === null ? null : { min: num(r.iso_min), max: num(r.iso_max) },
      metering: r.metering, fixedLensId: r.fixed_lens_id, sources: r.sources,
    }))).toEqual([...CATALOG.bodies].sort((a, b) => a.id.localeCompare(b.id)));
    expect((lenses as Row[]).map((r) => ({
      id: r.id, make: r.make, model: r.model, mount: r.mount,
      focalMm: { min: num(r.focal_min_mm), max: num(r.focal_max_mm) },
      maxAperture: { wide: num(r.max_aperture_wide), tele: num(r.max_aperture_tele) },
      minAperture: num(r.min_aperture), sources: r.sources,
    }))).toEqual([...CATALOG.lenses].sort((a, b) => a.id.localeCompare(b.id)));
  });

  test('users can read the catalog but cannot write it', async () => {
    const insert = await asUser().from('fotoai_gear_lenses').insert({ id: 'x', make: 'x', model: 'x', focal_min_mm: 1, focal_max_mm: 1, max_aperture_wide: 1, max_aperture_tele: 1, min_aperture: 2, sources: ['https://x'] });
    expect(insert.error).not.toBeNull();
    const update = await asUser().from('fotoai_gear_bodies').update({ model: 'hacked' }).eq('id', 'nikon-fe2').select();
    expect(update.error !== null || (update.data as Row[]).length === 0).toBe(true);
    const del = await asUser().from('fotoai_gear_lenses').delete().eq('id', 'nikon-ai-s-50mm-f1-4').select();
    expect(del.error !== null || (del.data as Row[]).length === 0).toBe(true);
    const still = await createServiceClient(testEnv(db!)).from('fotoai_gear_bodies' as never).select('model').eq('id', 'nikon-fe2').single();
    expect((still.data as unknown as Row).model).toBe('FE2');
  });

  test('a gear row may link a catalog body or lens, or carry custom data, but not two of them', async () => {
    const base = { user_id: user.id, category: 'camera', brand: 'Nikon', model: 'FE2' };
    const ok = await asUser().from('fotoai_user_gear').insert({ ...base, body_id: 'nikon-fe2' }).select('id').single();
    expect(ok.error).toBeNull();
    const both = await asUser().from('fotoai_user_gear').insert({ ...base, body_id: 'nikon-fe2', lens_id: 'nikon-ai-s-50mm-f1-4' });
    expect(both.error?.message).toMatch(/fotoai_user_gear_one_link_check/);
    const unknown = await asUser().from('fotoai_user_gear').insert({ ...base, body_id: 'leica-m6' });
    expect(unknown.error).not.toBeNull();
  });
});
