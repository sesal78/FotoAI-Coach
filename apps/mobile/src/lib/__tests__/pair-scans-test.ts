import { pairScans, swapTo } from '../pair-scans';

const frames = (pairs: Array<{ photoId: string; frameNo: number | null }>) => pairs.map((p) => p.frameNo);

test('scans pair with free logged frames in order', () => {
  expect(pairScans([3, 1, 2, 5], [], ['a', 'b', 'c'], {})).toEqual([
    { photoId: 'a', frameNo: 1 },
    { photoId: 'b', frameNo: 2 },
    { photoId: 'c', frameNo: 3 },
  ]);
});

test('a frame already held by an older scan is skipped', () => {
  expect(frames(pairScans([1, 2, 3, 4], [2], ['a', 'b', 'c'], {}))).toEqual([1, 3, 4]);
});

test('a scan past the last free frame has no frame', () => {
  expect(frames(pairScans([1, 2], [], ['a', 'b', 'c'], {}))).toEqual([1, 2, null]);
});

test('a chosen frame wins, and the others fill the rest in order', () => {
  expect(frames(pairScans([1, 2, 3], [], ['a', 'b', 'c'], { c: 1 }))).toEqual([2, 3, 1]);
  // A choice that is not a free logged frame is ignored, as the server would refuse it.
  expect(frames(pairScans([1, 2, 3], [2], ['a', 'b'], { a: 2, b: 9 }))).toEqual([1, 3]);
  // Two choices of the same frame: the first keeps it.
  expect(frames(pairScans([1, 2, 3], [], ['a', 'b'], { a: 3, b: 3 }))).toEqual([3, 1]);
});

test('tap to swap moves two scans', () => {
  const pairs = pairScans([1, 2, 3], [], ['a', 'b', 'c'], {});
  const swaps = swapTo(pairs, 'a', 3);
  expect(frames(pairScans([1, 2, 3], [], ['a', 'b', 'c'], swaps))).toEqual([3, 2, 1]);
});

test('moving a scan to a free frame frees its old one for the scan with none', () => {
  // 4 frames, 2 scans: a=1, b=2; frames 3 and 4 are free.
  const pairs = pairScans([1, 2, 3, 4], [], ['a', 'b'], {});
  expect(frames(pairScans([1, 2, 3, 4], [], ['a', 'b'], swapTo(pairs, 'b', 4)))).toEqual([1, 4]);
  // 1 frame, 2 scans: b has none; moving b onto frame 1 leaves a with none.
  const short = pairScans([1], [], ['a', 'b'], {});
  expect(frames(pairScans([1], [], ['a', 'b'], swapTo(short, 'b', 1)))).toEqual([null, 1]);
});
