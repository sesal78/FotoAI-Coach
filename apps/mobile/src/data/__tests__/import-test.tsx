import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { photo } from '../../../test/fixtures';
import { mockFiles } from '../../../test/photo-mocks';
import { fakePhotoServer } from '../../../test/photo-server';
import type { Api } from '../../lib/api';
import { readPhotoFile } from '../../lib/photo-files';
import { discardItem, outbox, setFieldOwner } from '../field';
import { keys } from '../keys';
import { useImport } from '../photos';
import { applySent } from '../sent';
import { createPhotoSender, type PhotoBody } from '../upload';
import type { PhotoListResponse } from '@fotoai/contracts';

jest.mock('expo-image-manipulator', () => jest.requireActual('../../../test/photo-mocks').manipulatorModule);
jest.mock('expo-file-system', () => jest.requireActual('../../../test/photo-mocks').fileSystemModule);

const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));

const mockPicker = { assets: [] as unknown[] | null, calls: [] as unknown[] };
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: async (opts: unknown) => {
    mockPicker.calls.push(opts);
    return mockPicker.assets ? { canceled: false, assets: mockPicker.assets } : { canceled: true, assets: null };
  },
}));

const mockMedia = { granted: true, canAskAgain: true, asked: 0, locations: {} as Record<string, { latitude: number; longitude: number }> };
jest.mock('expo-media-library', () => ({
  getPermissionsAsync: async () => ({ granted: mockMedia.granted && mockMedia.asked > 0, canAskAgain: mockMedia.canAskAgain }),
  requestPermissionsAsync: async () => {
    mockMedia.asked += 1;
    return { granted: mockMedia.granted, canAskAgain: mockMedia.canAskAgain };
  },
  Asset: class {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
    async getLocation() {
      return mockMedia.locations[this.id] ?? null;
    }
  },
}));

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const RICOH = { Make: 'RICOH', Model: 'GR IIIx', FNumber: 2.8, ExposureTime: 0.004, ISOSpeedRatings: 200 };
const picked = (over: Record<string, unknown> = {}) => ({ uri: 'file:///picker/IMG_1.jpg', assetId: 'gal-1', width: 1200, height: 800, mimeType: 'image/jpeg', exif: RICOH, ...over });

async function importNow(opts?: Parameters<ReturnType<typeof useImport>['importPhotos']>[0]) {
  const view = await renderHook(() => useImport());
  let result: Awaited<ReturnType<ReturnType<typeof useImport>['importPhotos']>> | undefined;
  await act(async () => {
    result = await view.result.current.importPhotos(opts);
  });
  return result!;
}

/** Sends the waiting photo items the way the sync engine does and returns what the server got. */
async function sendAll() {
  const server = fakePhotoServer();
  const send = createPhotoSender({ request: server.request as unknown as Api['request'], bucket: () => server.bucket, readFile: readPhotoFile });
  for (const item of await outbox.list(OWNER)) await send(item.body as PhotoBody);
  return server;
}

beforeEach(async () => {
  mockFiles.reset();
  mockStore.clear();
  mockPicker.assets = [];
  mockPicker.calls = [];
  Object.assign(mockMedia, { granted: true, canAskAgain: true, asked: 0, locations: {} });
  setFieldOwner(OWNER);
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
});

test('EXIF and GPS reach the create call', async () => {
  mockPicker.assets = [picked()];
  mockMedia.locations['gal-1'] = { latitude: -37.81, longitude: 144.96 };
  const result = await importNow();
  expect(result).toEqual({ added: 1, already: 0, failed: 0, ids: [expect.any(String)], message: '1 photo waiting to upload' });
  expect(mockPicker.calls).toEqual([expect.objectContaining({ allowsMultipleSelection: true, exif: true, mediaTypes: ['images'] })]);
  const server = await sendAll();
  expect(server.creates).toEqual([
    {
      id: expect.any(String),
      source: 'gallery',
      mime: 'image/jpeg',
      bytes: 2_345_678,
      exif: { cameraMake: 'RICOH', cameraModel: 'GR IIIx', aperture: 2.8, shutterSeconds: 0.004, iso: 200, lat: -37.81, lng: 144.96 },
    },
  ]);
  expect([...server.rows.values()][0]!.status).toBe('ready');
});

test('a resized photo keeps its EXIF in the create call', async () => {
  mockFiles.rendered = { width: 6000, height: 4000 };
  mockPicker.assets = [picked({ width: 6000, height: 4000, uri: 'file:///picker/IMG_2.heic', mimeType: 'image/heic' })];
  await importNow();
  expect(mockFiles.resized).toEqual([{ width: 3000 }]);
  const server = await sendAll();
  expect(server.creates).toEqual([expect.objectContaining({ mime: 'image/jpeg', exif: expect.objectContaining({ cameraMake: 'RICOH', iso: 200 }) })]);
});

test('a photo with no EXIF is still imported', async () => {
  mockPicker.assets = [picked({ exif: null, assetId: null })];
  expect(await importNow()).toMatchObject({ added: 1 });
  const server = await sendAll();
  expect(server.creates).toEqual([{ id: expect.any(String), source: 'gallery', mime: 'image/jpeg', bytes: 2_345_678 }]);
});

test('a scan for a roll is queued as a scan on that roll', async () => {
  const roll = '22222222-aaaa-4bbb-8ccc-000000000001';
  mockPicker.assets = [picked()];
  await importNow({ source: 'scan', rollId: roll });
  const server = await sendAll();
  expect(server.creates).toEqual([expect.objectContaining({ source: 'scan', rollId: roll })]);
});

test('the same gallery photo picked twice is sent once', async () => {
  mockPicker.assets = [picked()];
  await importNow();
  expect(await importNow()).toEqual({ added: 0, already: 1, failed: 0, ids: [], message: 'Already imported' });
  expect(await outbox.list(OWNER)).toHaveLength(1);
  // Another account on the same phone has its own list.
  setFieldOwner('bbbbbbbb-0000-4000-8000-000000000002');
  expect(await importNow()).toMatchObject({ added: 1 });
});

test('without photo permission the photo is still imported, with no media-library location', async () => {
  mockMedia.granted = false;
  mockMedia.locations['gal-1'] = { latitude: -37.81, longitude: 144.96 };
  mockPicker.assets = [picked({ exif: { Make: 'RICOH' } })];
  expect(await importNow()).toMatchObject({ added: 1 });
  const server = await sendAll();
  expect(server.creates).toEqual([expect.objectContaining({ exif: { cameraMake: 'RICOH' } })]);
});

test('permission is asked only while Android may still ask', async () => {
  mockMedia.granted = false;
  mockMedia.canAskAgain = false;
  mockPicker.assets = [picked()];
  await importNow();
  expect(mockMedia.asked).toBe(0);
});

test('a closed picker adds nothing', async () => {
  mockPicker.assets = null;
  expect(await importNow()).toEqual({ added: 0, already: 0, failed: 0, ids: [], message: null });
  expect(await outbox.list(OWNER)).toEqual([]);
});

test('removing a photo in Needs attention deletes its file, and it can be imported again', async () => {
  mockPicker.assets = [picked()];
  await importNow();
  const [item] = await outbox.list(OWNER);
  const file = (item!.body as PhotoBody).file;
  expect(mockFiles.sizes.has(file)).toBe(true);
  await discardItem(item!);
  expect(mockFiles.sizes.has(file)).toBe(false);
  expect(await outbox.list(OWNER)).toEqual([]);
  expect(await importNow()).toMatchObject({ added: 1, already: 0 });
});

test('a sent photo shows in the photo reads, and its local file is deleted', async () => {
  mockPicker.assets = [picked()];
  await importNow();
  const [item] = await outbox.list(OWNER);
  const body = item!.body as PhotoBody;
  const client = new QueryClient();
  const older = photo({ id: '44444444-aaaa-4bbb-8ccc-000000000009' });
  client.setQueryData<InfiniteData<PhotoListResponse>>(keys.photos, { pages: [{ photos: [older], nextCursor: null }], pageParams: [null] });
  const sent = photo({ id: body.id });
  applySent(client, item!, { photo: sent });
  applySent(client, item!, { photo: sent });
  expect(client.getQueryData<InfiniteData<PhotoListResponse>>(keys.photos)!.pages[0]!.photos.map((p) => p.id)).toEqual([body.id, older.id]);
  expect(client.getQueryData(keys.photo(body.id))).toEqual({ photo: sent });
  expect(mockFiles.sizes.has(body.file)).toBe(false);
});

test('a photo that cannot be read is counted, and the others still go', async () => {
  mockPicker.assets = [picked({ assetId: 'gal-1' }), picked({ assetId: 'gal-2', uri: 'file:///picker/IMG_2.jpg' })];
  const manipulator = jest.requireMock('expo-image-manipulator') as typeof import('../../../test/photo-mocks').manipulatorModule;
  const real = manipulator.ImageManipulator.manipulate;
  const spy = jest.spyOn(manipulator.ImageManipulator, 'manipulate').mockImplementationOnce(() => {
    throw new Error('Could not decode the image');
  });
  try {
    expect(await importNow()).toEqual({ added: 1, already: 0, failed: 1, ids: [expect.any(String)], message: '1 photo waiting to upload. 1 photo could not be read' });
  } finally {
    spy.mockRestore();
    manipulator.ImageManipulator.manipulate = real;
  }
  expect(await outbox.list(OWNER)).toHaveLength(1);
  // The one that failed was not marked as imported: picking it again tries again.
  mockPicker.assets = [picked({ assetId: 'gal-1' })];
  expect(await importNow()).toMatchObject({ added: 1 });
});
