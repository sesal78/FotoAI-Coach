// Pairs film scans with logged frames the way the server does (POST /rolls/:id/scans): a chosen
// frame first, then the other scans take the free logged frames in frame order, in scan order.
// A frame held by an older scan is not free. A scan past the last free frame has no frame.
// Save sends every pair as a choice, so the server stores exactly what the user saw.

export interface ScanPair {
  photoId: string;
  frameNo: number | null;
}

export function pairScans(logged: number[], taken: number[], scanIds: string[], swaps: Record<string, number>): ScanPair[] {
  const isLogged = new Set(logged);
  const used = new Set(taken);
  const chosen = new Map<string, number>();
  // A choice the server would refuse (not a free logged frame, or a frame chosen twice) is dropped.
  for (const id of scanIds) {
    const frameNo = swaps[id];
    if (frameNo === undefined || !isLogged.has(frameNo) || used.has(frameNo)) continue;
    chosen.set(id, frameNo);
    used.add(frameNo);
  }
  const free = [...isLogged].sort((a, b) => a - b).filter((no) => !used.has(no));
  return scanIds.map((photoId) => ({ photoId, frameNo: chosen.get(photoId) ?? free.shift() ?? null }));
}

/**
 * The choices after "tap a scan, then tap a frame": the scan takes that frame, and a scan that
 * held it takes the scan's old frame. Every other pair stays as it is.
 */
export function swapTo(pairs: ScanPair[], scanId: string, frameNo: number): Record<string, number> {
  const from = pairs.find((p) => p.photoId === scanId)?.frameNo ?? null;
  const next: Record<string, number> = {};
  for (const p of pairs) {
    if (p.photoId === scanId) next[p.photoId] = frameNo;
    else if (p.frameNo === frameNo) {
      if (from !== null) next[p.photoId] = from;
    } else if (p.frameNo !== null) next[p.photoId] = p.frameNo;
  }
  return next;
}
