import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PLAN_ID, plan, ROLL_ID, roll, STEP_1 } from '../../../test/fixtures';
import { fakeApi } from '../../../test/harness';
import { ApiClientError } from '../../lib/api';
import { outbox, setFieldOwner } from '../field';
import { keys } from '../keys';
import { withoutGoogleContent } from '../persist';
import { applySent } from '../sent';
import { useLoadRoll, useLogFrame, useMakePlan, usePlan, useRoll, useRolls, useStepChange } from '../shoot';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../client', () => ({ getApi: () => mockApi.current }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(async () => {
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
});

test('a plan opened once is kept on the phone without its Google place name', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/plans/${PLAN_ID}`]: { plan: plan() } });
  const { client, wrapper } = setup();
  const view = await renderHook(() => usePlan(PLAN_ID), { wrapper });
  await waitFor(() => expect(view.result.current.plan?.title).toBe('Golden hour at Federation Square'));
  const saved = withoutGoogleContent({ timestamp: 0, buster: '', clientState: dehydrate(client) });
  const kept = saved.clientState.queries.find((q) => q.queryKey[1] === 'plan')!.state.data as { plan: { placeName: unknown; title: string } };
  expect(kept.plan.placeName).toBeNull();
  expect(kept.plan.title).toBe('Golden hour at Federation Square');
  expect(client.getQueryCache().find({ queryKey: keys.plan(PLAN_ID) })!.meta?.save).not.toBe(false);
});

test('two taps on Done send one change', async () => {
  mockApi.current = fakeApi({});
  const { wrapper } = setup();
  const change = await renderHook(() => useStepChange(PLAN_ID), { wrapper });
  await act(async () => {
    await change.result.current(STEP_1, 'done');
    await change.result.current(STEP_1, 'done');
  });
  const waiting = await outbox.list(OWNER);
  expect(waiting).toHaveLength(1);
  expect(waiting[0]).toMatchObject({ method: 'PATCH', path: `/api/v2/plans/${PLAN_ID}/steps/${STEP_1}`, body: { status: 'done' } });
});

test('a step waiting to be sent shows at once, and a newer step from the web wins once it is sent', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/plans/${PLAN_ID}`]: { plan: plan() } });
  const { client, wrapper } = setup();
  const view = await renderHook(() => ({ plan: usePlan(PLAN_ID), change: useStepChange(PLAN_ID) }), { wrapper });
  await waitFor(() => expect(view.result.current.plan.plan).toBeDefined());
  await act(async () => void (await view.result.current.change(STEP_1, 'done')));
  await waitFor(() => expect(view.result.current.plan.plan!.steps[0]!.status).toBe('done'));
  // The server had a newer change from the web (skipped): it answers applied: false with its step.
  const [item] = await outbox.list(OWNER);
  const webStep = { ...plan().steps[0]!, status: 'skipped' as const, updatedAt: '2026-10-24T09:00:00.000Z' };
  await act(async () => {
    await outbox.markSent(item!.id);
    applySent(client, item!, { step: webStep, applied: false });
  });
  await waitFor(() => expect(view.result.current.plan.plan!.steps[0]!.status).toBe('skipped'));
});

test('a frame logged offline counts at once on the roll', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/rolls/${ROLL_ID}`]: { roll: { ...roll(), frames: [] } } });
  const { wrapper } = setup();
  const view = await renderHook(() => ({ roll: useRoll(ROLL_ID), log: useLogFrame(ROLL_ID) }), { wrapper });
  await waitFor(() => expect(view.result.current.roll.roll?.framesLogged).toBe(13));
  await act(async () => void (await view.result.current.log({ frameNo: 14, settings: { mode: 'M', aperture: 8, shutterSeconds: 1 / 250, iso: 400 } })));
  await waitFor(() => expect(view.result.current.roll.roll).toMatchObject({ framesLogged: 14, framesLeft: 22 }));
  expect(view.result.current.roll.frames.map((f) => f.frameNo)).toEqual([14]);
  const [item] = await outbox.list(OWNER);
  expect(item).toMatchObject({ kind: 'frame', method: 'POST', path: `/api/v2/rolls/${ROLL_ID}/frames` });
  expect((item!.body as { id: string; shotAt: string }).id).toMatch(/^[0-9a-f-]{36}$/);
});

test("Make the plan shows the server's message (Set your loadout first)", async () => {
  mockApi.current = fakeApi({ 'POST /api/v2/plans': new ApiClientError('validation', 400, 'Set your loadout first') });
  const { wrapper } = setup();
  const make = await renderHook(() => useMakePlan(), { wrapper });
  await act(async () => void (await make.result.current.mutateAsync({ placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ' }).catch(() => undefined)));
  await waitFor(() => expect(make.result.current.error?.message).toBe('Set your loadout first'));
});

test('a sent frame stays on the roll: the answer goes into the read before the item leaves the outbox', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/rolls/${ROLL_ID}`]: { roll: { ...roll(), frames: [] } } });
  const { client, wrapper } = setup();
  const view = await renderHook(() => ({ roll: useRoll(ROLL_ID), log: useLogFrame(ROLL_ID) }), { wrapper });
  await waitFor(() => expect(view.result.current.roll.roll?.framesLogged).toBe(13));
  await act(async () => void (await view.result.current.log({ frameNo: 14, settings: { mode: 'M', iso: 400 } })));
  const [item] = await outbox.list(OWNER);
  const body = item!.body as { id: string; frameNo: number; settings: object; shotAt: string };
  const answer = { frame: { id: body.id, frameNo: 14, settings: body.settings, lensGearId: null, stepId: null, lat: null, lng: null, note: null, shotAt: body.shotAt, createdAt: body.shotAt } };
  await act(async () => applySent(client, item!, answer));
  expect(view.result.current.roll.roll?.framesLogged).toBe(14); // not counted twice
  await act(async () => await outbox.markSent(item!.id));
  await waitFor(() => expect(view.result.current.roll.frames.map((f) => f.frameNo)).toEqual([14]));
  expect(view.result.current.roll.roll).toMatchObject({ framesLogged: 14, framesLeft: 22 });
});

test('a roll loaded offline stays on screen once it is sent', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/rolls': { rolls: [] } });
  const { client, wrapper } = setup();
  const view = await renderHook(() => ({ rolls: useRolls(), load: useLoadRoll() }), { wrapper });
  await waitFor(() => expect(view.result.current.rolls.isSuccess).toBe(true));
  let id = '';
  await act(async () => void (id = await view.result.current.load({ stockId: 'kodak-portra-400', ratedIso: 400, exposures: 36, bodyGearId: roll().bodyGearId! })));
  await waitFor(() => expect(view.result.current.rolls.rolls.map((r) => r.id)).toEqual([id]));
  const [item] = await outbox.list(OWNER);
  await act(async () => applySent(client, item!, { roll: roll({ id, framesLogged: 0, framesLeft: 36 }) }));
  await act(async () => await outbox.markSent(item!.id));
  await waitFor(async () => expect(await outbox.list(OWNER)).toEqual([]));
  expect(view.result.current.rolls.rolls.map((r) => r.id)).toEqual([id]);
  const detail = await renderHook(() => useRoll(id), { wrapper });
  expect(detail.result.current.roll?.id).toBe(id);
});
