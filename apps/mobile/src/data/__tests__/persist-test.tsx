import { onlineManager, QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { act, render, screen } from '@testing-library/react-native';

import { LastUpdated } from '../../ui/LastUpdated';
import { keys } from '../keys';
import { claimSavedReads, createSavedReads, SAVED_KEY, SAVED_MAX_AGE } from '../persist';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
}

const ME = { userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' };

test('a saved read comes back after a restart (a new client on the same storage)', async () => {
  const storage = memoryStorage();
  const saved = createSavedReads(storage, '0.1.0');
  const before = new QueryClient();
  before.setQueryData(keys.me, ME);
  await persistQueryClientSave({ queryClient: before, persister: saved.persister, buster: '0.1.0', dehydrateOptions: saved.options.dehydrateOptions });
  expect(storage.data.has(SAVED_KEY)).toBe(true);

  const after = new QueryClient();
  await persistQueryClientRestore({ queryClient: after, persister: saved.persister, buster: '0.1.0', maxAge: SAVED_MAX_AGE });
  expect(after.getQueryData(keys.me)).toEqual(ME);
});

test('a new app version does not restore old saved reads', async () => {
  const storage = memoryStorage();
  const saved = createSavedReads(storage, '0.1.0');
  const before = new QueryClient();
  before.setQueryData(keys.me, ME);
  await persistQueryClientSave({ queryClient: before, persister: saved.persister, buster: '0.1.0' });
  const after = new QueryClient();
  await persistQueryClientRestore({ queryClient: after, persister: saved.persister, buster: '0.2.0', maxAge: SAVED_MAX_AGE });
  expect(after.getQueryData(keys.me)).toBeUndefined();
});

test('sign-out clears the saved reads', async () => {
  const storage = memoryStorage();
  const saved = createSavedReads(storage, '0.1.0');
  const client = new QueryClient();
  client.setQueryData(keys.me, ME);
  await persistQueryClientSave({ queryClient: client, persister: saved.persister, buster: '0.1.0' });
  await saved.clear();
  expect(storage.data.has(SAVED_KEY)).toBe(false);
});

test('offline with saved data shows Last updated <time>; online shows nothing', async () => {
  const at = new Date(2026, 9, 20, 14, 5).getTime();
  await act(async () => onlineManager.setOnline(false));
  await render(<LastUpdated at={at} />);
  expect(screen.getByText('Last updated 14:05')).toBeTruthy();
  await act(async () => onlineManager.setOnline(true));
  expect(screen.queryByText(/Last updated/)).toBeNull();
});

test('saved reads from another account are cleared when a different account signs in', () => {
  const data = new Map<string, string>();
  const store = { getItemSync: (k: string) => data.get(k) ?? null, setItemSync: (k: string, v: string) => void data.set(k, v) };
  const clear = jest.fn();
  claimSavedReads('user-a', store, clear);
  expect(clear).toHaveBeenCalledTimes(1); // no owner recorded yet: start clean
  claimSavedReads('user-a', store, clear);
  expect(clear).toHaveBeenCalledTimes(1); // same account: keep its saved reads
  claimSavedReads('user-b', store, clear);
  expect(clear).toHaveBeenCalledTimes(2);
});
