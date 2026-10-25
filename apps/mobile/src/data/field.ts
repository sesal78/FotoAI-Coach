// The field mode's wiring: the outbox on this phone, which account is signed in, and a way to start
// a sync pass. client.ts connects the sync engine; screens and hooks only enqueue.

import Storage from 'expo-sqlite/kv-store';

import { createOutbox, type OutboxInput, type OutboxItem } from './outbox';

export const outbox = createOutbox(Storage);

let owner: string | null = null;
let kick: () => void = () => undefined;

export const fieldOwner = (): string | null => owner;

export function setFieldOwner(id: string | null): void {
  owner = id;
}

export function setKick(fn: () => void): void {
  kick = fn;
}

export function kickSync(): void {
  kick();
}

/** Queues a change for the signed-in account and starts a sync pass. */
export async function enqueue(input: OutboxInput): Promise<OutboxItem> {
  if (!owner) throw new Error('Sign in to save this change.');
  const item = await outbox.enqueue(owner, input);
  kick();
  return item;
}
