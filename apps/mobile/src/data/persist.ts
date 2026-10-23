// Reads are kept on the phone (expo-sqlite kv-store) so a screen opened with no signal shows its
// last good answer. Only successful reads are saved, never writes; they last 7 days and are
// dropped when the app version changes. Sign-out clears them. No token is ever in a read.
// Google Places answers (names, addresses, photos) carry `meta.save: false` and are never saved:
// the Google Maps Platform terms allow them fresh only.

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistedClient, PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

export const SAVED_KEY = 'fotoai.saved-reads.v1';
export const SAVED_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const OWNER_KEY = 'fotoai.saved-reads.owner.v1';

interface StringStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

type SavedSpot = { source?: string; name?: unknown; location?: unknown };

/**
 * My spots are saved, but a Google spot's name and coordinates are Google content: on the phone it
 * keeps only its place id and the user's own notes and favourite (Google Maps Platform terms).
 */
export function withoutGoogleContent(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries.map((q) => {
    const isSpots = q.queryKey.length === 2 && q.queryKey[0] === 'me' && q.queryKey[1] === 'spots';
    const data = q.state.data as { spots?: SavedSpot[] } | undefined;
    if (!isSpots || !data?.spots) return q;
    const spots = data.spots.map((s) => (s.source === 'google' ? { ...s, name: null, location: null } : s));
    return { ...q, state: { ...q.state, data: { ...data, spots } } };
  });
  return { ...client, clientState: { ...client.clientState, queries } };
}

export function createSavedReads(storage: StringStorage, buster: string) {
  const persister = createAsyncStoragePersister({ storage, key: SAVED_KEY, throttleTime: 1000, serialize: (client) => JSON.stringify(withoutGoogleContent(client)) });
  const options: Omit<PersistQueryClientOptions, 'queryClient'> = {
    persister,
    maxAge: SAVED_MAX_AGE,
    buster,
    dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.meta?.save !== false, shouldDehydrateMutation: () => false },
  };
  return { persister, options, clear: () => Promise.resolve(persister.removeClient()).catch(() => undefined) };
}

export const savedReads = createSavedReads(Storage, Constants.expoConfig?.version ?? '0');

interface SyncStore {
  getItemSync: (key: string) => string | null;
  setItemSync: (key: string, value: string) => void;
}

/** Keeps the saved reads only when they belong to `userId`; otherwise clears them and takes them over. */
export function claimSavedReads(userId: string, store: SyncStore, clear: () => void): void {
  let owner: string | null = null;
  try {
    owner = store.getItemSync(OWNER_KEY);
  } catch {
    owner = null;
  }
  if (owner === userId) return;
  clear();
  try {
    store.setItemSync(OWNER_KEY, userId);
  } catch {
    // Not recorded: the next sign-in clears again, which is safe.
  }
}
