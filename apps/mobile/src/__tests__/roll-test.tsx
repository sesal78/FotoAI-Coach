import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BODY_ID, filmLoadout, roll, ROLL_ID, STEP_1 } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import LoadRoll from '../app/roll/load';
import RollScreen from '../app/roll/[id]';
import { outbox, setFieldOwner } from '../data/field';
import { applySent } from '../data/sent';
import { createSync } from '../data/sync';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const mockParams: { current: Record<string, string> } = { current: {} };
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams.current, router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: async () => null,
}));

const rollRoutes = (r = roll(), over: Record<string, unknown> = {}) => ({
  'GET /api/v2/me/loadout': { loadout: filmLoadout() },
  'GET /api/v2/rolls': { rolls: [r] },
  [`GET /api/v2/rolls/${r.id}`]: { roll: { ...r, frames: [] } },
  ...over,
});

beforeEach(async () => {
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
  mockParams.current = {};
  (router.replace as jest.Mock).mockClear();
});

test('a roll loads with a known stock: the one in the loadout is chosen, and the body is the loadout body', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/loadout': { loadout: filmLoadout() }, 'GET /api/v2/rolls': { rolls: [] } });
  await renderScreen(<LoadRoll />);
  expect(await screen.findByText('Kodak Portra 400 (ISO 400)')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('24')));
  await act(async () => await fireEvent.press(screen.getByText('Load the roll')));
  await waitFor(async () => expect(await outbox.list(OWNER)).toHaveLength(1));
  const [item] = await outbox.list(OWNER);
  expect(item).toMatchObject({ kind: 'roll', method: 'POST', path: '/api/v2/rolls' });
  expect(item!.body).toMatchObject({ stockId: 'kodak-portra-400', ratedIso: 400, exposures: 24, bodyGearId: BODY_ID });
  expect(router.replace).toHaveBeenLastCalledWith(`/roll/${(item!.body as { id: string }).id}`);
});

test('a roll loads with my own film, and the push is shown', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/loadout': { loadout: filmLoadout({ film: null }) }, 'GET /api/v2/rolls': { rolls: [] } });
  await renderScreen(<LoadRoll />);
  await act(async () => await fireEvent.press(await screen.findByText('My own film')));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Film name'), 'Lomo Metropolis'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Box ISO'), '400'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Rated ISO'), '800'));
  expect(screen.getByText('+1 stop push')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Load the roll')));
  await waitFor(async () => expect(await outbox.list(OWNER)).toHaveLength(1));
  expect((await outbox.list(OWNER))[0]!.body).toMatchObject({ stockName: 'Lomo Metropolis', boxIso: 400, ratedIso: 800, exposures: 36 });
});

test('a digital body cannot load a roll, and a loaded roll must be finished first', async () => {
  const digital = filmLoadout({ film: null });
  digital.body = { ...digital.body, capability: { ...(digital.body.capability as object), type: 'digital' } as never };
  mockApi.current = fakeApi({ 'GET /api/v2/me/loadout': { loadout: digital }, 'GET /api/v2/rolls': { rolls: [] } });
  const first = await renderScreen(<LoadRoll />);
  expect(await screen.findByText('Film rolls need a film camera in your loadout.')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi(rollRoutes());
  await renderScreen(<LoadRoll />);
  expect(await screen.findByText('Finish the roll in the camera first.')).toBeTruthy();
});

test('the counter counts a frame logged offline, and the frame is sent once when back online', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll(), { [`POST /api/v2/rolls/${ROLL_ID}/frames`]: (b: unknown) => ({ frame: { ...(b as object), lensGearId: null, stepId: null, lat: null, lng: null, note: null, createdAt: 'x' } }) }));
  const { client } = await renderScreen(<RollScreen />);
  expect(await screen.findByText('Next frame 14 of 36 · 23 left')).toBeTruthy();
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Aperture (f/)'), '8'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Shutter'), '1/250'));
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  expect(await screen.findByText('Next frame 15 of 36 · 22 left')).toBeTruthy();
  expect(screen.getByText('#14 · M · f/8 · 1/250 s · ISO 400')).toBeTruthy();
  const sync = createSync({ outbox, request: (path, opts) => mockApi.current!.request(path, opts), getOwner: () => OWNER, isOnline: () => true, onSent: (item, answer) => applySent(client, item, answer) });
  await act(async () => await sync.run());
  await act(async () => await sync.run());
  expect(mockApi.current.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  expect(mockApi.current.calls.find((c) => c.method === 'POST')?.body).toMatchObject({ frameNo: 14, settings: { mode: 'M', aperture: 8, shutterSeconds: 0.004, iso: 400 } });
});

test('Log a frame from a step fills in its settings and links the step', async () => {
  mockParams.current = { id: ROLL_ID, stepId: STEP_1, mode: 'A', aperture: '8', iso: '400' };
  mockApi.current = fakeApi(rollRoutes());
  await renderScreen(<RollScreen />);
  expect(await screen.findByDisplayValue('8')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  await waitFor(async () => expect(await outbox.list(OWNER)).toHaveLength(1));
  expect((await outbox.list(OWNER))[0]!.body).toMatchObject({ stepId: STEP_1, settings: { mode: 'A', aperture: 8, iso: 400 } });
});

test('Sunny 16 gives f/16 at 1/125 for ISO 125 in full sun; blue hour says to meter', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll({ stockId: null, stockName: 'Ilford FP4 Plus', boxIso: 125, ratedIso: 125 })));
  await renderScreen(<RollScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Full sun')));
  expect(screen.getByLabelText('Aperture (f/)').props.value).toBe('16');
  expect(screen.getByLabelText('Shutter').props.value).toBe('1/125');
  await act(async () => await fireEvent.press(screen.getByText('Blue hour')));
  expect(screen.getByText('Meter it: Sunny 16 does not cover this light.')).toBeTruthy();
});

test('the end-of-roll warning shows at 2 left, and a full roll asks to finish it', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll({ framesLogged: 34, framesLeft: 2 })));
  const first = await renderScreen(<RollScreen />);
  expect(await screen.findByText('2 frames left on this roll.')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi(rollRoutes(roll({ framesLogged: 36, framesLeft: 0 })));
  await renderScreen(<RollScreen />);
  expect(await screen.findByText('Roll full: finish it.')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Finish roll')));
  await waitFor(() => expect(screen.getByText('This roll is finished.')).toBeTruthy());
  expect((await outbox.list(OWNER))[0]).toMatchObject({ kind: 'rollStatus', method: 'PATCH', body: { status: 'finished' } });
});

test('a frame past the end of the roll (+2 spare) is refused on the phone', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll({ framesLogged: 38, framesLeft: 0 })));
  await renderScreen(<RollScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Save frame')));
  expect(await screen.findByText('Frame 39 is past the end of this 36-exposure roll.')).toBeTruthy();
  expect(await outbox.list(OWNER)).toEqual([]);
});
