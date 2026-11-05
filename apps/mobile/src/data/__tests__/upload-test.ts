import { fakePhotoServer } from '../../../test/photo-server';
import type { Api } from '../../lib/api';
import { createOutbox, type OutboxInput } from '../outbox';
import { createSync } from '../sync';
import { createPhotoSender, photoItem, type PhotoBody } from '../upload';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const P1 = '55555555-0000-4000-8000-000000000001';

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: async (k: string) => map.get(k) ?? null, setItem: async (k: string, v: string) => void map.set(k, v) };
}

const body = (over: Partial<PhotoBody> = {}): PhotoBody => ({
  id: P1,
  source: 'gallery',
  mime: 'image/jpeg',
  bytes: 1000,
  exif: { cameraMake: 'RICOH', iso: 200 },
  file: `file:///doc/uploads/${P1}.jpg`,
  importKey: 'asset-1',
  ...over,
});

function setup(over: { fileBytes?: number; owner?: string } = {}) {
  let now = 1_000;
  const state = { owner: over.owner ?? A };
  const server = fakePhotoServer();
  const readFile = jest.fn(async () => new ArrayBuffer(over.fileBytes ?? 1000));
  const sendPhoto = createPhotoSender({ request: server.request as unknown as Api['request'], bucket: () => server.bucket, readFile });
  const outbox = createOutbox(memoryStorage(), () => now);
  const onSent = jest.fn();
  const sync = createSync({
    outbox,
    request: (path, opts) => (opts.kind === 'photo' ? sendPhoto(opts.body as PhotoBody) : Promise.reject(new Error(`unexpected ${path}`))),
    getOwner: () => state.owner,
    isOnline: () => true,
    onSent,
  });
  return { server, readFile, outbox, onSent, sync, state, tick: (ms: number) => (now += ms) };
}

const enqueue = (outbox: ReturnType<typeof createOutbox>, owner: string, input: OutboxInput) => outbox.enqueue(owner, input);

test('a photo goes create, upload, confirm; the create call carries no local file details', async () => {
  const { server, outbox, onSent, sync } = setup();
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  expect(server.creates).toEqual([{ id: P1, source: 'gallery', mime: 'image/jpeg', bytes: 1000, exif: { cameraMake: 'RICOH', iso: 200 } }]);
  expect(server.bucket.uploadToSignedUrl).toHaveBeenCalledWith(`user/${P1}.jpg`, 't1', expect.any(ArrayBuffer), { contentType: 'image/jpeg' });
  expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'photo', key: `photo:${P1}` }), { photo: expect.objectContaining({ id: P1, status: 'ready' }) });
  expect(await outbox.list(A)).toEqual([]);
});

test('an upload killed half way resumes: the next run gets a fresh link, uploads and confirms', async () => {
  const { server, outbox, onSent, sync, tick } = setup();
  await enqueue(outbox, A, photoItem(body()));
  server.bucket.uploadToSignedUrl.mockRejectedValueOnce(new TypeError('Network request failed'));
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'waiting', attempts: 1 })]);
  expect(onSent).not.toHaveBeenCalled();
  tick(5_000);
  await sync.run();
  expect(server.bucket.uploadToSignedUrl.mock.calls.map((c) => c[1])).toEqual(['t1', 't2']);
  expect(onSent).toHaveBeenCalledTimes(1);
  expect(server.rows.size).toBe(1);
  expect(server.rows.get(P1)!.status).toBe('ready');
  expect(await outbox.list(A)).toEqual([]);
});

test('a network fault that Storage reports as an error (no status) also waits and tries again', async () => {
  const { server, outbox, sync } = setup();
  await enqueue(outbox, A, photoItem(body()));
  server.bucket.uploadToSignedUrl.mockResolvedValueOnce({ data: null, error: { name: 'StorageUnknownError', message: 'Network request failed' } as never });
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'waiting', attempts: 1 })]);
});

test('a link that ran out starts the chain again, and never signs the user out', async () => {
  const { server, outbox, onSent, sync, tick } = setup();
  await enqueue(outbox, A, photoItem(body()));
  // The phone was offline past the link's life: Storage refuses the old token.
  server.bucket.uploadToSignedUrl.mockResolvedValueOnce({ data: null, error: { name: 'StorageApiError', message: 'jwt expired', status: 401, statusCode: '401' } as never });
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'waiting', attempts: 1 })]);
  tick(5_000);
  await sync.run();
  expect(onSent).toHaveBeenCalledTimes(1);
  expect(server.creates).toHaveLength(2);
  expect(await outbox.list(A)).toEqual([]);
});

test('a size mismatch moves to Needs attention, with the server message', async () => {
  const { outbox, onSent, sync } = setup({ fileBytes: 999 });
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  expect(onSent).not.toHaveBeenCalled();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'attention', error: 'The upload does not match the declared size or type' })]);
});

test('a photo whose file is gone from the phone moves to Needs attention', async () => {
  const { readFile, outbox, sync } = setup();
  readFile.mockRejectedValueOnce(new Error('File not found'));
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'attention', error: expect.stringMatching(/no longer on this phone/) })]);
});

test('a photo that is already ready is not uploaded again', async () => {
  const { server, outbox, onSent, sync } = setup();
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  // The answer was lost (for example the app was closed): the same item goes again.
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  expect(server.bucket.uploadToSignedUrl).toHaveBeenCalledTimes(1);
  expect(onSent).toHaveBeenCalledTimes(2);
  expect(server.rows.size).toBe(1);
});

test('photo items wait for their own account', async () => {
  const { server, outbox, sync, state } = setup({ owner: B });
  await enqueue(outbox, A, photoItem(body()));
  await sync.run();
  expect(server.request).not.toHaveBeenCalled();
  state.owner = A;
  await sync.run();
  expect(server.rows.get(P1)!.status).toBe('ready');
});

test('a Storage refusal that cannot get better (statusCode 413 in an HTTP 400) needs attention', async () => {
  const { server, outbox, sync } = setup();
  await enqueue(outbox, A, photoItem(body()));
  server.bucket.uploadToSignedUrl.mockResolvedValueOnce({ error: { status: 400, statusCode: '413', message: 'The object exceeded the maximum allowed size' } } as never);
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'attention' })]);
});

test('a link that ran out (statusCode 403 in an HTTP 400) is tried again', async () => {
  const { server, outbox, sync } = setup();
  await enqueue(outbox, A, photoItem(body()));
  server.bucket.uploadToSignedUrl.mockResolvedValueOnce({ error: { status: 400, statusCode: '403', message: 'jwt expired' } } as never);
  await sync.run();
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ state: 'waiting', attempts: 1 })]);
});
