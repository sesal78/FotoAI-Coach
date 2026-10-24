import { createOutbox } from '../outbox';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

/** The phone's key-value store, kept in memory: a second outbox on the same map is a restart. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => void map.set(key, value),
  };
}

const step = (stepId: string, status: string) => ({
  kind: 'step' as const,
  method: 'PATCH' as const,
  path: `/api/v2/plans/p1/steps/${stepId}`,
  body: { status, updatedAt: '2026-10-24T08:00:00.000Z' },
  key: `step:${stepId}`,
});

test('an item survives a restart (a new outbox on the same storage still has it)', async () => {
  const storage = memoryStorage();
  const first = createOutbox(storage);
  await first.enqueue(A, step('s1', 'done'));
  const afterRestart = createOutbox(storage);
  expect((await afterRestart.list(A)).map((i) => i.body)).toEqual([{ status: 'done', updatedAt: '2026-10-24T08:00:00.000Z' }]);
});

test('two changes to the same step keep only the newest', async () => {
  const outbox = createOutbox(memoryStorage());
  await outbox.enqueue(A, step('s1', 'done'));
  await outbox.enqueue(A, step('s1', 'skipped'));
  const items = await outbox.list(A);
  expect(items).toHaveLength(1);
  expect(items[0]!.body).toMatchObject({ status: 'skipped' });
});

test('items come back in the order they were made', async () => {
  const outbox = createOutbox(memoryStorage());
  await outbox.enqueue(A, { kind: 'roll', method: 'POST', path: '/api/v2/rolls', body: { id: 'r1' }, key: 'roll:r1' });
  await outbox.enqueue(A, { kind: 'frame', method: 'POST', path: '/api/v2/rolls/r1/frames', body: { id: 'f1' }, key: 'frame:f1' });
  await outbox.enqueue(A, { kind: 'frame', method: 'POST', path: '/api/v2/rolls/r1/frames', body: { id: 'f2' }, key: 'frame:f2' });
  expect((await outbox.list(A)).map((i) => i.key)).toEqual(['roll:r1', 'frame:f1', 'frame:f2']);
  expect((await outbox.next(A))!.key).toBe('roll:r1');
});

test("items of another account are never listed or sent", async () => {
  const outbox = createOutbox(memoryStorage());
  await outbox.enqueue(A, step('s1', 'done'));
  expect(await outbox.list(B)).toEqual([]);
  expect(await outbox.next(B)).toBeNull();
});

test('a change made while the same step is being sent is kept for the next send', async () => {
  const outbox = createOutbox(memoryStorage());
  await outbox.enqueue(A, step('s1', 'done'));
  const sending = (await outbox.next(A))!;
  await outbox.enqueue(A, step('s1', 'skipped'));
  await outbox.markSent(sending.id);
  expect((await outbox.list(A)).map((i) => i.body)).toEqual([{ status: 'skipped', updatedAt: '2026-10-24T08:00:00.000Z' }]);
});

test('Needs attention items stay until the user retries or removes them, and are not sent meanwhile', async () => {
  const outbox = createOutbox(memoryStorage());
  await outbox.enqueue(A, step('s1', 'done'));
  await outbox.enqueue(A, step('s2', 'done'));
  const first = (await outbox.next(A))!;
  await outbox.markAttention(first.id, 'Invalid step change');
  expect((await outbox.next(A))!.key).toBe('step:s2');
  expect((await outbox.list(A)).find((i) => i.key === 'step:s1')).toMatchObject({ state: 'attention', error: 'Invalid step change' });
  await outbox.retry(first.id);
  expect((await outbox.list(A)).find((i) => i.key === 'step:s1')).toMatchObject({ state: 'waiting', error: null });
  await outbox.remove(first.id);
  expect((await outbox.list(A)).map((i) => i.key)).toEqual(['step:s2']);
});

test('a retry waits until its time comes, and keeps the order behind it', async () => {
  let now = 1_000;
  const outbox = createOutbox(memoryStorage(), () => now);
  await outbox.enqueue(A, step('s1', 'done'));
  await outbox.enqueue(A, step('s2', 'done'));
  const first = (await outbox.next(A))!;
  await outbox.markRetry(first.id, 5_000);
  expect(await outbox.next(A)).toBeNull();
  now = 6_000;
  expect((await outbox.next(A))!.key).toBe('step:s1');
  expect((await outbox.list(A))[0]!.attempts).toBe(1);
});
