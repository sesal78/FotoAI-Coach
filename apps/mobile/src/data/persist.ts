// Reads are kept on the phone (expo-sqlite kv-store) so a screen opened with no signal shows its
// last good answer. Only successful reads are saved, never writes; they last 7 days and are
// dropped when the app version changes. Sign-out clears them. No token is ever in a read.

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

export const SAVED_KEY = 'fotoai.saved-reads.v1';
export const SAVED_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface StringStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export function createSavedReads(storage: StringStorage, buster: string) {
  const persister = createAsyncStoragePersister({ storage, key: SAVED_KEY, throttleTime: 1000 });
  const options: Omit<PersistQueryClientOptions, 'queryClient'> = {
    persister,
    maxAge: SAVED_MAX_AGE,
    buster,
    dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success', shouldDehydrateMutation: () => false },
  };
  return { persister, options, clear: () => Promise.resolve(persister.removeClient()).catch(() => undefined) };
}

export const savedReads = createSavedReads(Storage, Constants.expoConfig?.version ?? '0');
