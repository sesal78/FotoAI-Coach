// The field mode's wiring: the outbox on this phone, which account is signed in, and a way to start
// a sync pass. client.ts connects the sync engine; screens and hooks only enqueue.

import Storage from 'expo-sqlite/kv-store';

import { deletePhotoFile } from '../lib/photo-files';
import { forgetImport } from './imported';
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

/**
 * Removes a waiting change after the user said yes. A photo's file on the phone goes too, and the
 * gallery photo may then be imported again. Waiting scan pairs stop naming the removed photo, so
 * the other scans' pairs are still sent (a scans item left with no photo goes too).
 */
export async function discardItem(item: OutboxItem): Promise<void> {
  await outbox.remove(item.id);
  if (item.kind !== 'photo') return;
  const body = item.body as { id: string; file: string; importKey?: string | null };
  deletePhotoFile(body.file);
  if (body.importKey) await forgetImport(item.owner, body.importKey);
  for (const other of await outbox.list(item.owner)) {
    const scans = other.body as { photoIds?: string[]; overrides?: Record<string, number> } | undefined;
    if (other.kind !== 'scans' || other.state !== 'waiting' || !scans?.photoIds?.includes(body.id)) continue;
    const photoIds = scans.photoIds.filter((id) => id !== body.id);
    if (!photoIds.length) {
      await outbox.remove(other.id);
      continue;
    }
    const overrides = Object.fromEntries(Object.entries(scans.overrides ?? {}).filter(([id]) => id !== body.id));
    await outbox.setBody(other.id, { photoIds, overrides });
  }
}
