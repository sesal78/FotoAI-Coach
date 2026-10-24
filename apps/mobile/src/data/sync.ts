// Sends the outbox to the server, oldest first, one run at a time, only for the signed-in account
// and only while the phone is online. A 2xx removes the item; no signal, a timeout or a server
// fault (5xx, 429) waits longer each time; a 401 stops until that account signs in again; any
// other refusal moves the item to "Needs attention", with the server's message.

import { ApiClientError } from '../lib/api';

import type { Outbox, OutboxItem } from './outbox';

const DELAYS_MS = [5_000, 30_000, 120_000, 600_000];

export interface SyncDeps {
  outbox: Outbox;
  request: (path: string, opts: { method: OutboxItem['method']; body?: unknown }) => Promise<unknown>;
  getOwner: () => string | null;
  isOnline: () => boolean;
  /** Puts the server's answer into the matching read on screen. */
  onSent: (item: OutboxItem, answer: unknown) => void;
}

export function createSync(deps: SyncDeps) {
  let running: Promise<void> | null = null;
  let signedOut = false;

  const delayFor = (attempts: number) => DELAYS_MS[Math.min(attempts, DELAYS_MS.length - 1)]!;

  async function loop(): Promise<void> {
    for (;;) {
      const owner = deps.getOwner();
      if (!owner || signedOut || !deps.isOnline()) return;
      const item = await deps.outbox.next(owner);
      if (!item) return;
      let answer: unknown;
      try {
        answer = await deps.request(item.path, { method: item.method, ...(item.body === undefined ? {} : { body: item.body }) });
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          deps.outbox.release(item.id);
          signedOut = true;
          return;
        }
        if (!(err instanceof ApiClientError) || err.retryable) {
          await deps.outbox.markRetry(item.id, delayFor(item.attempts));
          return;
        }
        await deps.outbox.markAttention(item.id, err.message);
        continue;
      }
      await deps.outbox.markSent(item.id);
      deps.onSent(item, answer);
    }
  }

  return {
    /** One pass over the outbox. Calls during a pass share it, so two passes never overlap. */
    run(): Promise<void> {
      running ??= loop().finally(() => {
        running = null;
      });
      return running;
    },
    /** A sign-in: items stopped by a 401 may go again. */
    signedIn(): void {
      signedOut = false;
    },
    delayFor,
  };
}
