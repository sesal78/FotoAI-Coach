import type { FrameDto, PhotoDto } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { filmLoadout, photo, roll, ROLL_ID } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import { mockFiles } from '../../test/photo-mocks';
import { fakePhotoServer } from '../../test/photo-server';
import RollScreen from '../app/roll/[id]';
import ScansScreen from '../app/roll/scans/[id]';
import { outbox, setFieldOwner } from '../data/field';
import { createOutbox } from '../data/outbox';
import { createSync } from '../data/sync';
import { createPhotoSender, photoItem, type PhotoBody } from '../data/upload';
import type { Api } from '../lib/api';

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
jest.mock('expo-image-manipulator', () => jest.requireActual('../../test/photo-mocks').manipulatorModule);
jest.mock('expo-file-system', () => jest.requireActual('../../test/photo-mocks').fileSystemModule);
const mockPicker = { assets: null as unknown[] | null };
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: async () => (mockPicker.assets ? { canceled: false, assets: mockPicker.assets } : { canceled: true, assets: null }) }));
jest.mock('expo-media-library', () => ({
  getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  Asset: class {},
}));

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const S1 = '66666666-0000-4000-8000-000000000001';
const S2 = '66666666-0000-4000-8000-000000000002';
const S3 = '66666666-0000-4000-8000-000000000003';
const OLD = '66666666-0000-4000-8000-000000000009';
const frameId = (no: number) => `77777777-0000-4000-8000-${String(no).padStart(12, '0')}`;
const frame = (no: number): FrameDto => ({
  id: frameId(no),
  frameNo: no,
  settings: { mode: 'A', aperture: 8, iso: 400 },
  lensGearId: null,
  stepId: null,
  lat: null,
  lng: null,
  note: null,
  shotAt: '2026-10-24T05:00:00.000Z',
  createdAt: '2026-10-24T05:00:00.000Z',
});
const finished = roll({ status: 'finished', framesLogged: 3, framesLeft: 33 });

function routes(frames: number[], scans: PhotoDto[] = []) {
  return fakeApi({
    'GET /api/v2/me/loadout': { loadout: filmLoadout() },
    'GET /api/v2/rolls': { rolls: [finished] },
    [`GET /api/v2/rolls/${ROLL_ID}`]: { roll: { ...finished, frames: frames.map(frame) } },
    'GET /api/v2/photos': (_b: unknown, path: string) => (path.includes(`rollId=${ROLL_ID}`) ? { photos: scans, nextCursor: null } : new Error('no rollId')),
    [`GET /api/v2/photos/${OLD}/url`]: { url: 'https://sb.example/sign/old.jpg?token=t', expiresAt: '2026-11-05T03:05:00.000Z' },
  });
}

/** Two scans already waiting to upload for this roll, in the order picked. */
async function waitingScans(ids = [S1, S2]) {
  for (const id of ids) await outbox.enqueue(OWNER, photoItem({ id, source: 'scan', rollId: ROLL_ID, mime: 'image/jpeg', bytes: 1000, file: `file:///doc/uploads/${id}.jpg` }));
}

const frameCells = () => screen.getAllByLabelText(/^Frame \d+ for scan \d+$/).map((e) => e.props.accessibilityLabel as string);

beforeEach(async () => {
  mockFiles.reset();
  mockStore.clear();
  mockPicker.assets = null;
  mockParams.current = { id: ROLL_ID };
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
});

test('Add scans imports the picked photos as scans of this roll, then opens the pairing', async () => {
  mockApi.current = routes([1, 2, 3]);
  mockPicker.assets = [
    { uri: 'file:///picker/scan-1.jpg', assetId: 'g1', width: 1200, height: 800, exif: null },
    { uri: 'file:///picker/scan-2.jpg', assetId: 'g2', width: 1200, height: 800, exif: null },
  ];
  await renderScreen(<RollScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Add scans')));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const items = await outbox.list(OWNER);
  expect(items.map((i) => [i.kind, (i.body as PhotoBody).source, (i.body as PhotoBody).rollId])).toEqual([
    ['photo', 'scan', ROLL_ID],
    ['photo', 'scan', ROLL_ID],
  ]);
  const ids = items.map((i) => (i.body as PhotoBody).id);
  expect(router.push).toHaveBeenCalledWith(`/roll/scans/${ROLL_ID}?ids=${ids.join(',')}`);
});

test('the roll lists its scans with their frame', async () => {
  mockApi.current = routes([1, 2, 3], [photo({ id: OLD, source: 'scan', rollId: ROLL_ID, frameId: frameId(2) })]);
  await renderScreen(<RollScreen />);
  expect(await screen.findByText('Scans')).toBeTruthy();
  expect(await screen.findByText('Frame 2')).toBeTruthy();
});

test('scans pair with free logged frames in order, and a frame held by an older scan is skipped', async () => {
  await waitingScans([S1, S2, S3]);
  mockParams.current = { id: ROLL_ID, ids: [S1, S2, S3].join(',') };
  mockApi.current = routes([1, 2, 3, 4], [photo({ id: OLD, source: 'scan', rollId: ROLL_ID, frameId: frameId(2) })]);
  await renderScreen(<ScansScreen />);
  await waitFor(() => expect(frameCells()).toEqual(['Frame 1 for scan 1', 'Frame 3 for scan 2', 'Frame 4 for scan 3']));
});

test('tap to swap moves two scans', async () => {
  await waitingScans();
  mockParams.current = { id: ROLL_ID, ids: [S1, S2].join(',') };
  mockApi.current = routes([1, 2, 3]);
  await renderScreen(<ScansScreen />);
  await waitFor(() => expect(frameCells()).toEqual(['Frame 1 for scan 1', 'Frame 2 for scan 2']));
  await act(async () => await fireEvent.press(screen.getByLabelText('Scan 1')));
  await act(async () => await fireEvent.press(screen.getByLabelText('Frame 2 for scan 2')));
  expect(frameCells()).toEqual(['Frame 2 for scan 1', 'Frame 1 for scan 2']);
  // A free frame can be chosen too.
  await act(async () => await fireEvent.press(screen.getByLabelText('Scan 2')));
  await act(async () => await fireEvent.press(screen.getByLabelText('Free frame 3')));
  expect(frameCells()).toEqual(['Frame 2 for scan 1', 'Frame 3 for scan 2']);
});

test('a scan past the last frame says No frame logged, and Add frame opens the logger with that number', async () => {
  await waitingScans();
  mockParams.current = { id: ROLL_ID, ids: [S1, S2].join(',') };
  mockApi.current = routes([1]);
  await renderScreen(<ScansScreen />);
  expect(await screen.findByText('No frame logged')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Add frame 2')));
  expect(router.push).toHaveBeenCalledWith(`/roll/${ROLL_ID}?frameNo=2&returnTo=scans`);
});

test('Save pairs sends every pair as an override, after the uploads', async () => {
  await waitingScans();
  mockParams.current = { id: ROLL_ID, ids: [S1, S2].join(',') };
  mockApi.current = routes([1, 2, 3]);
  await renderScreen(<ScansScreen />);
  await waitFor(() => expect(frameCells()).toHaveLength(2));
  await act(async () => await fireEvent.press(screen.getByLabelText('Scan 1')));
  await act(async () => await fireEvent.press(screen.getByLabelText('Free frame 3')));
  await act(async () => await fireEvent.press(screen.getByText('Save pairs')));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  const items = await outbox.list(OWNER);
  expect(items.map((i) => i.kind)).toEqual(['photo', 'photo', 'scans']);
  expect(items[2]).toMatchObject({ method: 'POST', path: `/api/v2/rolls/${ROLL_ID}/scans`, body: { photoIds: [S1, S2], overrides: { [S1]: 3, [S2]: 2 } } });
});

test('a second save replaces the unsent first one', async () => {
  await waitingScans();
  mockParams.current = { id: ROLL_ID, ids: [S1, S2].join(',') };
  mockApi.current = routes([1, 2, 3]);
  const view = await renderScreen(<ScansScreen />);
  await waitFor(() => expect(frameCells()).toHaveLength(2));
  await act(async () => await fireEvent.press(screen.getByText('Save pairs')));
  await act(async () => await fireEvent.press(screen.getByText('Save pairs')));
  view.unmount();
  expect((await outbox.list(OWNER)).map((i) => i.kind)).toEqual(['photo', 'photo', 'scans']);
});

/** The outbox, the photo chain and the scans route together, as on the phone. */
function field() {
  let now = 1_000;
  const state = { online: true };
  const server = fakePhotoServer();
  const send = createPhotoSender({ request: server.request as unknown as Api['request'], bucket: () => server.bucket, readFile: async () => new ArrayBuffer(1000) });
  const box = createOutbox({ getItem: async (k) => mockStore.get(`f:${k}`) ?? null, setItem: async (k, v) => void mockStore.set(`f:${k}`, v) }, () => now);
  const sent: string[] = [];
  const sync = createSync({
    outbox: box,
    request: async (path, opts) => {
      if (opts.kind === 'photo') {
        const answer = await send(opts.body as PhotoBody);
        sent.push(`photo ${(opts.body as PhotoBody).id}`);
        return answer;
      }
      const { photoIds } = opts.body as { photoIds: string[] };
      // The server takes only scans that are uploaded.
      if (photoIds.some((id) => server.rows.get(id)?.status !== 'ready')) throw new Error('Only uploaded scans can be matched to frames');
      sent.push(`scans ${photoIds.join(',')}`);
      return { matches: photoIds.map((photoId, i) => ({ photoId, frameNo: i + 1 })) };
    },
    getOwner: () => OWNER,
    isOnline: () => state.online,
    onSent: () => undefined,
  });
  const queue = async () => {
    for (const id of [S1, S2]) await box.enqueue(OWNER, photoItem({ id, source: 'scan', rollId: ROLL_ID, mime: 'image/jpeg', bytes: 1000, file: `file:///doc/uploads/${id}.jpg` }));
    await box.enqueue(OWNER, { kind: 'scans', method: 'POST', path: `/api/v2/rolls/${ROLL_ID}/scans`, body: { photoIds: [S1, S2], overrides: { [S1]: 1, [S2]: 2 } }, key: `scans:${ROLL_ID}:x` });
  };
  return { server, box, sync, sent, state, queue, tick: (ms: number) => (now += ms) };
}

test('the scans item waits for its uploads', async () => {
  const { server, box, sync, sent, queue, tick } = field();
  await queue();
  server.bucket.uploadToSignedUrl.mockRejectedValueOnce(new TypeError('Network request failed'));
  await sync.run();
  expect(sent).toEqual([]);
  tick(5_000);
  await sync.run();
  expect(sent).toEqual([`photo ${S1}`, `photo ${S2}`, `scans ${S1},${S2}`]);
  expect(await box.list(OWNER)).toEqual([]);
});

test('scans made offline are sent once when back online', async () => {
  const { box, sync, sent, state, queue } = field();
  state.online = false;
  await queue();
  await sync.run();
  expect(sent).toEqual([]);
  state.online = true;
  await Promise.all([sync.run(), sync.run()]);
  await sync.run();
  expect(sent).toEqual([`photo ${S1}`, `photo ${S2}`, `scans ${S1},${S2}`]);
  expect(await box.list(OWNER)).toEqual([]);
});

test('Add frame opens the logger at that number on a finished roll, then comes back', async () => {
  mockParams.current = { id: ROLL_ID, frameNo: '4', returnTo: 'scans' };
  mockApi.current = routes([1, 2, 3]);
  await renderScreen(<RollScreen />);
  expect((await screen.findByLabelText('Frame number')).props.value).toBe('4');
  await act(async () => await fireEvent.press(screen.getByText('Save frame')));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  const [item] = await outbox.list(OWNER);
  expect(item).toMatchObject({ kind: 'frame', body: expect.objectContaining({ frameNo: 4 }) });
});
