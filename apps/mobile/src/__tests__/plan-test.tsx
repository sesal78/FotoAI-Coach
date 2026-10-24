import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { plan, PLAN_ID, roll, ROLL_ID, STEP_1 } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import PlanScreen from '../app/plan/[id]';
import { outbox, setFieldOwner } from '../data/field';
import { applySent } from '../data/sent';
import { createSync } from '../data/sync';
import { ApiClientError } from '../lib/api';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: '11111111-aaaa-4bbb-8ccc-000000000001' }), router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() } }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));

const routes = (over: Record<string, unknown> = {}) => ({
  [`GET /api/v2/plans/${PLAN_ID}`]: { plan: plan() },
  'GET /api/v2/rolls': { rolls: [] },
  ...over,
});

beforeEach(async () => {
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
  (router.push as jest.Mock).mockClear();
});

test("the plan shows its steps in order, with times in the place's timezone and the settings", async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<PlanScreen />);
  expect(await screen.findByText('Golden hour at Federation Square')).toBeTruthy();
  expect(screen.getByText('Federation Square')).toBeTruthy();
  expect(screen.getByText('Nikon FM2 · 50mm f/1.8 · Kodak Portra 400')).toBeTruthy();
  const titles = screen.getAllByTestId('step-card').map((c) => c.props.accessibilityLabel);
  expect(titles).toEqual(['1. Warm light on the facade', '2. Blue hour skyline']);
  // 18:40 at the place (UTC+11), whatever the phone's own timezone.
  expect(screen.getByText('18:40')).toBeTruthy();
  expect(screen.getByText('A · f/8 · ISO 400')).toBeTruthy();
  expect(screen.getByText('M · f/2.8 · 1/4 s · ISO 400')).toBeTruthy();
});

test('Done works with no signal, shows at once, and is sent once when back online', async () => {
  mockApi.current = fakeApi(routes({ [`PATCH /api/v2/plans/${PLAN_ID}/steps/${STEP_1}`]: (b: unknown) => ({ step: { ...plan().steps[0], ...(b as object) }, applied: true }) }));
  const { client } = await renderScreen(<PlanScreen />);
  await act(async () => await fireEvent.press((await screen.findAllByText('Done'))[0]!));
  await waitFor(() => expect(screen.getAllByText('Undo')).toHaveLength(1));
  expect(screen.getByText('Done ✓')).toBeTruthy();
  let online = false;
  const sync = createSync({ outbox, request: (path, opts) => mockApi.current!.request(path, opts), getOwner: () => OWNER, isOnline: () => online, onSent: (item, answer) => applySent(client, item, answer) });
  await act(async () => await sync.run());
  expect(mockApi.current.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  online = true;
  await act(async () => await sync.run());
  await act(async () => await sync.run());
  expect(mockApi.current.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
  expect(screen.getByText('Done ✓')).toBeTruthy();
});

test('a step the server says is newer (changed on the web) replaces the local one', async () => {
  const webStep = { ...plan().steps[0]!, status: 'skipped' as const, updatedAt: '2030-01-01T00:00:00.000Z' };
  mockApi.current = fakeApi(routes({ [`PATCH /api/v2/plans/${PLAN_ID}/steps/${STEP_1}`]: { step: webStep, applied: false } }));
  const { client } = await renderScreen(<PlanScreen />);
  await act(async () => await fireEvent.press((await screen.findAllByText('Done'))[0]!));
  const sync = createSync({ outbox, request: (path, opts) => mockApi.current!.request(path, opts), getOwner: () => OWNER, isOnline: () => true, onSent: (item, answer) => applySent(client, item, answer) });
  await act(async () => await sync.run());
  await waitFor(() => expect(screen.getByText('Skipped')).toBeTruthy());
  expect(screen.queryByText('Done ✓')).toBeNull();
});

test("Log a frame on a step opens the loaded roll with that step's settings", async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/rolls': { rolls: [roll()] } }));
  await renderScreen(<PlanScreen />);
  await act(async () => await fireEvent.press((await screen.findAllByText('Log a frame'))[0]!));
  expect(router.push).toHaveBeenLastCalledWith(`/roll/${ROLL_ID}?stepId=${STEP_1}&mode=A&aperture=8`);
});

test('without a loaded roll there is no Log a frame', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<PlanScreen />);
  await screen.findByText('Golden hour at Federation Square');
  expect(screen.queryByText('Log a frame')).toBeNull();
});

test('Mark plan done waits in the outbox and shows at once', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<PlanScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Mark plan done')));
  await waitFor(() => expect(screen.getByText('This plan is done.')).toBeTruthy());
  expect(await outbox.list(OWNER)).toEqual([expect.objectContaining({ kind: 'plan', method: 'PATCH', body: { status: 'done' } })]);
});

test('loading, error with Retry, and offline', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi(routes({ [`GET /api/v2/plans/${PLAN_ID}`]: () => new Promise((r) => (release = r)) }));
  const first = await renderScreen(<PlanScreen />);
  expect(await screen.findByText('Loading the plan…')).toBeTruthy();
  await act(async () => release({ plan: plan() }));
  await first.unmount();

  mockApi.current = fakeApi(routes({ [`GET /api/v2/plans/${PLAN_ID}`]: new ApiClientError('not_found', 404, 'Plan not found') }));
  const second = await renderScreen(<PlanScreen />);
  expect(await screen.findByText('Plan not found')).toBeTruthy();
  expect(screen.getByText('Retry')).toBeTruthy();
  await second.unmount();

  mockApi.current = fakeApi(routes({ [`GET /api/v2/plans/${PLAN_ID}`]: new ApiClientError('offline', 0, 'No connection') }));
  await renderScreen(<PlanScreen />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});

test('a plan opened from the phone (no Google place name) says it is saved here', async () => {
  mockApi.current = fakeApi(routes({ [`GET /api/v2/plans/${PLAN_ID}`]: { plan: plan({ placeName: null }) } }));
  await renderScreen(<PlanScreen />);
  expect(await screen.findByText('Saved on this phone')).toBeTruthy();
});
