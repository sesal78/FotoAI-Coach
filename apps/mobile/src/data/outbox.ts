// The outbox: writes made in the field (a step done, a frame logged, a roll loaded) wait here until
// the server confirms them, through no signal and app restarts. It lives in the phone's key-value
// store (a SQLite table under expo-sqlite/kv-store), one list for all accounts; each item keeps its
// owner and is only ever listed or sent for that account. Nothing waiting is dropped without the
// user's yes: an item the server refuses moves to "Needs attention".

import * as Crypto from 'expo-crypto';

export const OUTBOX_KEY = 'fotoai.outbox.v1';

export type OutboxKind = 'step' | 'plan' | 'roll' | 'rollStatus' | 'frame';

export interface OutboxInput {
  kind: OutboxKind;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** The record this change is about (for example `step:<id>`): a newer change replaces an unsent one. */
  key: string;
}

export interface OutboxItem extends OutboxInput {
  id: string;
  owner: string;
  attempts: number;
  nextTryAt: number;
  state: 'waiting' | 'attention';
  error: string | null;
  createdAt: number;
}

interface StringStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export type Outbox = ReturnType<typeof createOutbox>;

export function createOutbox(storage: StringStorage, now: () => number = Date.now) {
  let items: OutboxItem[] | null = null;
  // The item being sent right now: a new change to its record is added, never merged into it.
  let sending: string | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  async function load(): Promise<OutboxItem[]> {
    if (items) return items;
    try {
      const raw = await storage.getItem(OUTBOX_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      items = Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
    } catch {
      items = [];
    }
    return items;
  }

  /** Runs changes one at a time and saves the list after each, so a restart sees every change. */
  function change<T>(fn: (list: OutboxItem[]) => T): Promise<T> {
    const run = chain.then(async () => {
      const list = await load();
      const result = fn(list);
      await storage.setItem(OUTBOX_KEY, JSON.stringify(list));
      listeners.forEach((l) => l());
      return result;
    });
    chain = run.catch(() => undefined);
    return run;
  }

  const read = <T>(fn: (list: OutboxItem[]) => T): Promise<T> => chain.then(async () => fn(await load()));

  return {
    enqueue(owner: string, input: OutboxInput): Promise<OutboxItem> {
      return change((list) => {
        const older = list.find((i) => i.owner === owner && i.key === input.key && i.state === 'waiting' && i.id !== sending);
        if (older) {
          Object.assign(older, input, { attempts: 0, nextTryAt: 0, error: null });
          return { ...older };
        }
        const item: OutboxItem = { ...input, id: Crypto.randomUUID(), owner, attempts: 0, nextTryAt: 0, state: 'waiting', error: null, createdAt: now() };
        list.push(item);
        return { ...item };
      });
    },

    /** Everything waiting or needing attention for this account, oldest first. */
    list(owner: string): Promise<OutboxItem[]> {
      return read((list) => list.filter((i) => i.owner === owner).map((i) => ({ ...i })));
    },

    /** The next item to send: the oldest waiting one, once its time has come. A later item never jumps it. */
    next(owner: string): Promise<OutboxItem | null> {
      return read((list) => {
        const head = list.find((i) => i.owner === owner && i.state === 'waiting');
        if (!head || head.nextTryAt > now()) return null;
        sending = head.id;
        return { ...head };
      });
    },

    markSent(id: string): Promise<void> {
      return change((list) => {
        if (sending === id) sending = null;
        const at = list.findIndex((i) => i.id === id);
        if (at >= 0) list.splice(at, 1);
      });
    },

    markRetry(id: string, delayMs: number): Promise<void> {
      return change((list) => {
        if (sending === id) sending = null;
        const item = list.find((i) => i.id === id);
        if (item) Object.assign(item, { attempts: item.attempts + 1, nextTryAt: now() + delayMs });
      });
    },

    markAttention(id: string, message: string): Promise<void> {
      return change((list) => {
        if (sending === id) sending = null;
        const item = list.find((i) => i.id === id);
        if (item) Object.assign(item, { state: 'attention', error: message, attempts: item.attempts + 1 });
      });
    },

    /** Sending stopped before an answer (for example signed out): the item waits as it was. */
    release(id: string): void {
      if (sending === id) sending = null;
    },

    retry(id: string): Promise<void> {
      return change((list) => {
        const item = list.find((i) => i.id === id);
        if (item) Object.assign(item, { state: 'waiting', error: null, attempts: 0, nextTryAt: 0 });
      });
    },

    remove(id: string): Promise<void> {
      return change((list) => {
        const at = list.findIndex((i) => i.id === id);
        if (at >= 0) list.splice(at, 1);
      });
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
