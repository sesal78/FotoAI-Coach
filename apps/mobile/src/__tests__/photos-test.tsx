import type { PhotoListResponse } from '@fotoai/contracts';
import type { InfiniteData } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { photo, roll } from '../../test/fixtures';
import { fakeApi, renderScreen, testClient } from '../../test/harness';
import { mockFiles } from '../../test/photo-mocks';
import Photos from '../app/(tabs)/photos';
import { outbox, setFieldOwner } from '../data/field';
import { keys } from '../data/keys';
import { photoItem } from '../data/upload';
import { ApiClientError } from '../lib/api';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
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
const NEW = photo({ id: '44444444-aaaa-4bbb-8ccc-000000000002', createdAt: '2026-11-05T02:00:00.000Z' });
const OLD = photo({ id: '44444444-aaaa-4bbb-8ccc-000000000001', createdAt: '2026-11-04T02:00:00.000Z' });
const extra = [photo({ id: '44444444-aaaa-4bbb-8ccc-000000000003' })];
const offline = () => new ApiClientError('offline', 0, 'No connection to FotoAI. Check your signal and try again.');
const urlFor = (id: string) => ({ url: `https://sb.example/sign/${id}.jpg?token=t`, expiresAt: '2026-11-05T03:05:00.000Z' });

function routes(pages: Record<string, PhotoListResponse | Error>) {
  return fakeApi({
    'GET /api/v2/photos': (_b: unknown, path: string) => pages[new URLSearchParams(path.split('?')[1] ?? '').get('cursor') ?? ''] ?? new Error(`no page for ${path}`),
    ...Object.fromEntries([NEW, OLD, ...extra].map((p) => [`GET /api/v2/photos/${p.id}/url`, urlFor(p.id)])),
  });
}
const tileIds = () => screen.getAllByTestId(/^photo-tile-/).map((t) => t.props.testID as string);

beforeEach(async () => {
  mockFiles.reset();
  mockStore.clear();
  mockPicker.assets = null;
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
});

test('the grid shows ready photos newest first, and loads the next page at the end', async () => {
  mockApi.current = routes({ '': { photos: [NEW, OLD], nextCursor: 'c2' }, c2: { photos: [extra[0]!], nextCursor: null } });
  await renderScreen(<Photos />);
  await waitFor(() => expect(tileIds()).toEqual([`photo-tile-${NEW.id}`, `photo-tile-${OLD.id}`]));
  await act(async () => await fireEvent(screen.getByTestId('photo-grid'), 'onEndReached'));
  await waitFor(() => expect(tileIds()).toHaveLength(3));
  await act(async () => await fireEvent.press(screen.getByTestId(`photo-tile-${NEW.id}`)));
  expect(router.push).toHaveBeenCalledWith(`/photo/${NEW.id}`);
});

test('a waiting upload shows before it is sent, with its file on the phone', async () => {
  mockApi.current = routes({ '': { photos: [], nextCursor: null } });
  const id = '55555555-0000-4000-8000-000000000001';
  await outbox.enqueue(OWNER, photoItem({ id, source: 'gallery', mime: 'image/jpeg', bytes: 1000, file: `file:///doc/uploads/${id}.jpg` }));
  await renderScreen(<Photos />);
  expect(await screen.findByText('Waiting to upload')).toBeTruthy();
  expect(screen.getByLabelText('A photo waiting to upload').props.source).toEqual([expect.objectContaining({ uri: `file:///doc/uploads/${id}.jpg` })]);
  // With nothing on the server yet, the empty grid does not say "No photos yet" over a waiting one.
  expect(screen.queryByText('No photos yet')).toBeNull();
});

test('a photo the server refused shows Needs attention and opens the changes screen', async () => {
  mockApi.current = routes({ '': { photos: [], nextCursor: null } });
  const id = '55555555-0000-4000-8000-000000000002';
  const item = await outbox.enqueue(OWNER, photoItem({ id, source: 'gallery', mime: 'image/jpeg', bytes: 1000, file: `file:///doc/uploads/${id}.jpg` }));
  await outbox.markAttention(item.id, 'The upload does not match the declared size or type');
  await renderScreen(<Photos />);
  await act(async () => await fireEvent.press(await screen.findByText('Needs attention')));
  expect(router.push).toHaveBeenCalledWith('/me/sync');
});

test('Import photos queues the picked photos and says so', async () => {
  mockApi.current = routes({ '': { photos: [], nextCursor: null } });
  mockPicker.assets = [{ uri: 'file:///picker/IMG_1.jpg', assetId: 'gal-1', width: 1200, height: 800, exif: null }];
  await renderScreen(<Photos />);
  await act(async () => await fireEvent.press(await screen.findByText('Import photos')));
  expect(await screen.findByText('1 photo waiting to upload')).toBeTruthy();
  expect(await screen.findByText('Waiting to upload')).toBeTruthy();
});

test('loading, then empty', async () => {
  let answer: (value: PhotoListResponse) => void = () => undefined;
  mockApi.current = fakeApi({ 'GET /api/v2/photos': () => new Promise<PhotoListResponse>((resolve) => (answer = resolve)) });
  await renderScreen(<Photos />);
  expect(screen.getByText('Loading your photos…')).toBeTruthy();
  await act(async () => answer({ photos: [], nextCursor: null }));
  expect(await screen.findByText('No photos yet')).toBeTruthy();
});

test('an error shows the message with Retry', async () => {
  mockApi.current = routes({ '': new ApiClientError('internal', 500, 'Server error') });
  await renderScreen(<Photos />);
  expect(await screen.findByText('Server error')).toBeTruthy();
  mockApi.current = routes({ '': { photos: [OLD], nextCursor: null } });
  await act(async () => await fireEvent.press(screen.getByText('Retry')));
  await waitFor(() => expect(tileIds()).toEqual([`photo-tile-${OLD.id}`]));
});

test('offline: the saved grid still shows, and the pictures say they need a signal', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/photos': offline(), [`GET /api/v2/photos/${OLD.id}/url`]: offline() });
  const client = testClient();
  client.setQueryData<InfiniteData<PhotoListResponse>>(keys.photos, { pages: [{ photos: [OLD], nextCursor: null }], pageParams: [null] });
  await renderScreen(<Photos />, client);
  await act(async () => void (await client.invalidateQueries({ queryKey: keys.photos })));
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
  expect(tileIds()).toEqual([`photo-tile-${OLD.id}`]);
  expect(await screen.findByText('Needs a signal')).toBeTruthy();
});

test('the film rolls row opens a roll, to add its scans', async () => {
  const film = roll({ status: 'finished' });
  mockApi.current = fakeApi({ 'GET /api/v2/photos': { photos: [], nextCursor: null }, 'GET /api/v2/rolls': { rolls: [film] } });
  await renderScreen(<Photos />);
  await act(async () => await fireEvent.press(await screen.findByText('Kodak Portra 400 · finished')));
  expect(router.push).toHaveBeenCalledWith(`/roll/${film.id}`);
});
