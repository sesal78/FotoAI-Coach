import { ApiClientError } from '../../lib/api';
import { createOutbox } from '../outbox';
import { createSync } from '../sync';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: async (k: string) => map.get(k) ?? null, setItem: async (k: string, v: string) => void map.set(k, v) };
}

const frame = (id: string) => ({ kind: 'frame' as const, method: 'POST' as const, path: '/api/v2/rolls/r1/frames', body: { id }, key: `frame:${id}` });

function setup(over: { owner?: string | null; online?: boolean } = {}) {
  let now = 1_000;
  const state = { owner: over.owner === undefined ? A : over.owner, online: over.online ?? true };
  const outbox = createOutbox(memoryStorage(), () => now);
  const request = jest.fn(async (...args: [path: string, opts: { method: string; body?: unknown }]): Promise<unknown> => (args[0] ? { frame: { id: 'ok' } } : null));
  const onSent = jest.fn();
  const sync = createSync({ outbox, request, getOwner: () => state.owner, isOnline: () => state.online, onSent });
  return { outbox, request, onSent, sync, state, tick: (ms: number) => (now += ms) };
}

test('a frame logged offline is sent once when back online', async () => {
  const { outbox, request, onSent, sync, state } = setup({ online: false });
  await outbox.enqueue(A, frame('f1'));
  await sync.run();
  expect(request).not.toHaveBeenCalled();
  state.online = true;
  await Promise.all([sync.run(), sync.run()]);
  await sync.run();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/api/v2/rolls/r1/frames', { method: 'POST', body: { id: 'f1' } });
  expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ key: 'frame:f1' }), { frame: { id: 'ok' } });
  expect(await outbox.list(A)).toEqual([]);
});

test('a 500 is tried again later; a 400 moves to Needs attention and the next item still goes', async () => {
  const { outbox, request, sync, tick } = setup();
  await outbox.enqueue(A, frame('f1'));
  await outbox.enqueue(A, frame('f2'));
  request.mockRejectedValueOnce(new ApiClientError('internal', 500, 'Server error'));
  await sync.run();
  expect(request).toHaveBeenCalledTimes(1);
  expect((await outbox.list(A)).map((i) => [i.key, i.state])).toEqual([['frame:f1', 'waiting'], ['frame:f2', 'waiting']]);
  await sync.run();
  expect(request).toHaveBeenCalledTimes(1); // not yet: it waits its turn
  tick(5_000);
  request.mockRejectedValueOnce(new ApiClientError('validation', 400, 'Frame 40 is past the end of a 36-exposure roll'));
  await sync.run();
  expect(request).toHaveBeenCalledTimes(3);
  expect(await outbox.list(A)).toEqual([
    expect.objectContaining({ key: 'frame:f1', state: 'attention', error: 'Frame 40 is past the end of a 36-exposure roll' }),
  ]);
});

test('a 401 waits for the next sign-in of that account', async () => {
  const { outbox, request, sync } = setup();
  await outbox.enqueue(A, frame('f1'));
  request.mockRejectedValueOnce(new ApiClientError('unauthenticated', 401, 'Sign in again'));
  await sync.run();
  await sync.run();
  expect(request).toHaveBeenCalledTimes(1);
  expect(await outbox.list(A)).toEqual([expect.objectContaining({ key: 'frame:f1', state: 'waiting', attempts: 0 })]);
  sync.signedIn();
  await sync.run();
  expect(request).toHaveBeenCalledTimes(2);
  expect(await outbox.list(A)).toEqual([]);
});

test('items wait for their own account', async () => {
  const { outbox, request, sync, state } = setup({ owner: B });
  await outbox.enqueue(A, frame('f1'));
  await sync.run();
  expect(request).not.toHaveBeenCalled();
  state.owner = null;
  await sync.run();
  expect(request).not.toHaveBeenCalled();
  state.owner = A;
  await sync.run();
  expect(request).toHaveBeenCalledTimes(1);
});

test('two runs never overlap', async () => {
  const { outbox, request, sync } = setup();
  await outbox.enqueue(A, frame('f1'));
  await outbox.enqueue(A, frame('f2'));
  let inFlight = 0;
  let most = 0;
  request.mockImplementation(async () => {
    inFlight += 1;
    most = Math.max(most, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return { frame: {} };
  });
  await Promise.all([sync.run(), sync.run(), sync.run()]);
  expect(most).toBe(1);
  expect(request).toHaveBeenCalledTimes(2);
});

test('the wait between tries grows: 5 s, 30 s, 2 min, then 10 min', () => {
  const { sync } = setup();
  expect([0, 1, 2, 3, 9].map(sync.delayFor)).toEqual([5_000, 30_000, 120_000, 600_000, 600_000]);
});
