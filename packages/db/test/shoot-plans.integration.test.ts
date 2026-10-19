import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createUserClient } from '../src/index.ts';
import { localDbFromEnv } from './support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from './support/seed.ts';

const db = localDbFromEnv();
type Row = Record<string, unknown>;
const PLACE = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';

describe.skipIf(!db)('fotoai_shoot_plans and fotoai_plan_steps', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser(db!, 'plans-a'), createTestUser(db!, 'plans-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });
  const from = (user: TestUser, table: string) => createUserClient(testEnv(db!), user.token).from(table as never);
  const planRow = (user: TestUser, over: Row = {}) => ({
    user_id: user.id, place_source: 'google', place_id: PLACE, plan_date: '2026-10-18', timezone: 'Australia/Melbourne',
    title: 'Evening light', summary: 'A short walk.', loadout: { bodyId: 'fujifilm-x-t5' }, prompt_id: 'shoot-plan', prompt_version: 1, model: 'gpt-6-luna',
    ...over,
  });
  const stepRow = (user: TestUser, planId: string, position: number) => ({
    plan_id: planId, user_id: user.id, position, title: `Step ${position}`, instruction: 'Frame the steps.', settings: { mode: 'A', aperture: 8 },
  });
  const newPlan = async (user: TestUser, over: Row = {}) => {
    const { data, error } = await from(user, 'fotoai_shoot_plans').insert(planRow(user, over) as never).select('id').single();
    expect(error).toBeNull();
    return (data as unknown as Row).id as string;
  };

  test('a plan and its steps are saved and read back by the owner', async () => {
    const id = await newPlan(a);
    const steps = await from(a, 'fotoai_plan_steps').insert([stepRow(a, id, 1), stepRow(a, id, 2)] as never).select('id, status');
    expect(steps.error).toBeNull();
    expect((steps.data as unknown as Row[]).map((s) => s.status)).toEqual(['todo', 'todo']);
    const read = await from(a, 'fotoai_shoot_plans').select('id, status, notes').eq('id', id).single();
    expect(read.data).toMatchObject({ status: 'active', notes: [] });
  });

  test("a step cannot point at another user's plan", async () => {
    const theirs = await newPlan(b);
    const mine = await from(a, 'fotoai_plan_steps').insert(stepRow(a, theirs, 1) as never);
    expect(mine.error).not.toBeNull();
  });

  test('a Google plan without a place_id, or a user plan with one, is rejected', async () => {
    const noPlace = await from(a, 'fotoai_shoot_plans').insert(planRow(a, { place_id: null }) as never);
    expect(noPlace.error?.message).toMatch(/fotoai_shoot_plans_place_check/);
    const userWithPlace = await from(a, 'fotoai_shoot_plans').insert(planRow(a, { place_source: 'user' }) as never);
    expect(userWithPlace.error?.message).toMatch(/fotoai_shoot_plans_place_check/);
  });

  test('deleting the pin keeps the plan, with spot_id null', async () => {
    const pin = await from(a, 'fotoai_places').insert({ user_id: a.id, source: 'user', name: 'Lookout', lat: -37.88, lng: 144.98 } as never).select('id').single();
    const spotId = (pin.data as unknown as Row).id as string;
    const id = await newPlan(a, { place_source: 'user', place_id: null, spot_id: spotId });
    expect((await from(a, 'fotoai_places').delete().eq('id', spotId)).error).toBeNull();
    const read = await from(a, 'fotoai_shoot_plans').select('spot_id').eq('id', id).single();
    expect(read.data).toMatchObject({ spot_id: null });
  });

  test("a plan cannot point at another user's spot", async () => {
    const theirs = await from(b, 'fotoai_places').insert({ user_id: b.id, source: 'user', name: 'Theirs', lat: -37.8, lng: 144.9 } as never).select('id').single();
    const spotId = (theirs.data as unknown as Row).id as string;
    const steal = await from(a, 'fotoai_shoot_plans').insert(planRow(a, { place_source: 'user', place_id: null, spot_id: spotId }) as never);
    expect(steal.error?.message).toMatch(/fotoai_shoot_plans_spot_fkey/);
  });

  test('deleting a plan deletes its steps', async () => {
    const id = await newPlan(a);
    await from(a, 'fotoai_plan_steps').insert(stepRow(a, id, 1) as never);
    expect((await from(a, 'fotoai_shoot_plans').delete().eq('id', id)).error).toBeNull();
    const steps = await from(a, 'fotoai_plan_steps').select('id').eq('plan_id', id);
    expect(steps.data).toHaveLength(0);
  });

  test('a step position outside 1..20 or a duplicate position is rejected', async () => {
    const id = await newPlan(a);
    expect((await from(a, 'fotoai_plan_steps').insert(stepRow(a, id, 21) as never)).error).not.toBeNull();
    expect((await from(a, 'fotoai_plan_steps').insert(stepRow(a, id, 1) as never)).error).toBeNull();
    expect((await from(a, 'fotoai_plan_steps').insert(stepRow(a, id, 1) as never)).error).not.toBeNull();
  });

  test('another user and anon cannot read or change plans or steps', async () => {
    const id = await newPlan(a);
    await from(a, 'fotoai_plan_steps').insert(stepRow(a, id, 1) as never);
    expect((await from(b, 'fotoai_shoot_plans').select('id').eq('id', id)).data).toHaveLength(0);
    expect((await from(b, 'fotoai_plan_steps').select('id').eq('plan_id', id)).data).toHaveLength(0);
    const upd = await from(b, 'fotoai_plan_steps').update({ status: 'done' } as never).eq('plan_id', id).select('id');
    expect(upd.data).toHaveLength(0);
    const env = testEnv(db!);
    const anon = createClient(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    for (const table of ['fotoai_shoot_plans', 'fotoai_plan_steps']) {
      const { data, error } = await anon.from(table).select('id');
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });
});
