import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { validateSettings, type Body, type Lens, type Settings } from '@fotoai/core';
import type { LoadoutDto, RollDto } from '@fotoai/contracts';

import { BODY_ID, electroLoadout, filmLoadout, LENS_ID, roll, ROLL_ID, STEP_1 } from '../../test/fixtures';
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

const rollRoutes = (r = roll(), over: Record<string, unknown> = {}, loadout: LoadoutDto = filmLoadout()) => ({
  'GET /api/v2/me/loadout': { loadout },
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
  expect((await outbox.list(OWNER))[0]!.body).toMatchObject({ stepId: STEP_1, lensGearId: LENS_ID, settings: { mode: 'M', aperture: 8, iso: 400 } });
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

/** What the server checks a frame against (packages/api/src/rolls.ts checkFrameSettings). */
function serverAccepts(loadout: LoadoutDto, r: RollDto, settings: Settings) {
  const film = { stock: r.stockName, boxIso: r.boxIso, ratedIso: r.ratedIso };
  return validateSettings({ body: loadout.body.capability as Body, lens: loadout.lens as Lens, film }, settings);
}

test('a frame from the FM2 sends its lens and passes the server check, even when the step says another ISO', async () => {
  mockParams.current = { id: ROLL_ID, stepId: STEP_1, mode: 'A', aperture: '8', shutterSeconds: String(1 / 125), iso: '800' };
  mockApi.current = fakeApi(rollRoutes());
  await renderScreen(<RollScreen />);
  expect(await screen.findByText('ISO 400 (this roll)')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  await waitFor(async () => expect(await outbox.list(OWNER)).toHaveLength(1));
  const body = (await outbox.list(OWNER))[0]!.body as { lensGearId?: string; settings: Settings };
  expect(body.lensGearId).toBe(LENS_ID);
  expect(body.settings.iso).toBe(400);
  expect(serverAccepts(filmLoadout(), roll(), body.settings)).toMatchObject({ ok: true });
});

test('on the Electro 35 GL (built-in lens, A only) Sunny 16 sets the aperture only, and the frame passes the server check', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll(), {}, electroLoadout()));
  await renderScreen(<RollScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Full sun')));
  expect(screen.getByLabelText('Aperture (f/)').props.value).toBe('16');
  expect(screen.queryByLabelText('Shutter')).toBeNull();
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  await waitFor(async () => expect(await outbox.list(OWNER)).toHaveLength(1));
  const body = (await outbox.list(OWNER))[0]!.body as { lensGearId?: string; settings: Settings };
  expect(body.lensGearId).toBeUndefined();
  expect(body.settings).toEqual({ mode: 'A', aperture: 16, iso: 400 });
  expect(serverAccepts(electroLoadout(), roll(), body.settings)).toMatchObject({ ok: true });
});

test('settings the camera cannot do are shown at the form and nothing is queued', async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes());
  await renderScreen(<RollScreen />);
  await act(async () => await fireEvent.changeText(await screen.findByLabelText('Shutter'), '1/8000'));
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  expect(await screen.findByText(/FM2 shutter runs/)).toBeTruthy();
  expect(await outbox.list(OWNER)).toEqual([]);
});

test("a roll whose camera is not the loadout's asks to set the loadout before logging", async () => {
  mockParams.current = { id: ROLL_ID };
  mockApi.current = fakeApi(rollRoutes(roll({ bodyGearId: '33333333-aaaa-4bbb-8ccc-0000000000ff' })));
  await renderScreen(<RollScreen />);
  expect(await screen.findByText("Set your loadout to this roll's camera to log frames.")).toBeTruthy();
  expect(screen.queryByText('Save frame')).toBeNull();
});

test('the next frame follows the highest one logged, and a number already logged is refused', async () => {
  mockParams.current = { id: ROLL_ID };
  const frames = [3, 5].map((n) => ({ id: `11111111-0000-4000-8000-00000000000${n}`, frameNo: n, settings: { mode: 'M' as const, iso: 400 }, lensGearId: LENS_ID, stepId: null, lat: null, lng: null, note: null, shotAt: 'x', createdAt: 'x' }));
  const r = roll({ framesLogged: 2, framesLeft: 34 });
  mockApi.current = fakeApi({ ...rollRoutes(r), [`GET /api/v2/rolls/${ROLL_ID}`]: { roll: { ...r, frames } } });
  await renderScreen(<RollScreen />);
  expect(await screen.findByText('Next frame 6 of 36 · 34 left')).toBeTruthy();
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Frame number'), '5'));
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  expect(await screen.findByText('Frame 5 is already logged.')).toBeTruthy();
  expect(await outbox.list(OWNER)).toEqual([]);
});
