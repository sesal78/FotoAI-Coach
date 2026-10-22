import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiClientError, createApi, type Api } from '../../lib/api';
import { useMe, usePatchChallenge, usePatchPreferences } from '../hooks';
import { QUERY_DEFAULTS } from '../query-defaults';
import { keys } from '../keys';

const mockApi: { current: Api | null } = { current: null };
jest.mock('../client', () => ({ getApi: () => mockApi.current }));

const CHALLENGE = {
  id: '11111111-2222-4333-8444-555555555555',
  challengeType: 'AFTER_WORK',
  challengeText: 'Shoot five doorways',
  category: 'architecture',
  difficulty: 'short',
  duration: '1-2 hours',
  tips: '',
  recommendedGear: [],
  status: 'completed',
  issuedDate: '2026-10-20T08:00:00+00:00',
  completedDate: '2026-10-20T09:00:00+00:00',
  shotList: [],
  source: 'dashboard',
};

function apiAnswering(body: unknown, status = 200) {
  const fetch = jest.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  mockApi.current = createApi({ baseUrl: 'https://api.example', getToken: async () => 't', refresh: async () => 'refused', onSignedOut: () => undefined, fetch: fetch as unknown as typeof globalThis.fetch });
  return fetch;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

test('a response that does not match the contract is an error state, never data', async () => {
  apiAnswering({ userId: 'not-a-uuid', email: 7 });
  const { wrapper } = setup();
  const { result } = await renderHook(() => useMe(), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect((result.current.error as ApiClientError).code).toBe('bad_response');
});

test('a matching response is data', async () => {
  apiAnswering({ userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' });
  const { wrapper } = setup();
  const { result } = await renderHook(() => useMe(), { wrapper });
  await waitFor(() => expect(result.current.data?.email).toBe('seun@example.com'));
});

test('a write invalidates the reads it changes: completing a challenge refreshes the active challenge and progress', async () => {
  const fetch = apiAnswering({ challenge: CHALLENGE, changed: true });
  const { client, wrapper } = setup();
  const spy = jest.spyOn(client, 'invalidateQueries');
  const { result } = await renderHook(() => usePatchChallenge(), { wrapper });
  await result.current.mutateAsync({ id: CHALLENGE.id, status: 'completed' });
  const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(call[0]).toBe(`https://api.example/api/v2/challenges/${CHALLENGE.id}`);
  expect(call[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
  const invalidated = spy.mock.calls.map((c) => c[0]?.queryKey);
  expect(invalidated).toEqual(expect.arrayContaining([keys.activeChallenge, keys.progress]));
});

test('offline, a read and a write fail with the offline error instead of waiting forever', async () => {
  mockApi.current = createApi({ baseUrl: 'https://api.example', getToken: async () => 't', refresh: async () => 'refused', onSignedOut: () => undefined, fetch: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { ...QUERY_DEFAULTS.queries, retryDelay: 0 }, mutations: QUERY_DEFAULTS.mutations } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  onlineManager.setOnline(false);
  try {
    const read = await renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(read.result.current.isError).toBe(true));
    expect((read.result.current.error as ApiClientError).code).toBe('offline');
    const write = await renderHook(() => usePatchPreferences(), { wrapper });
    await expect(write.result.current.mutateAsync({ theme: 'camera' })).rejects.toMatchObject({ code: 'offline' });
  } finally {
    onlineManager.setOnline(true);
  }
});

test('a preference answer only changes the fields that request sent (an older answer cannot undo a newer theme)', async () => {
  const pending: Array<(v: unknown) => void> = [];
  mockApi.current = { request: jest.fn(() => new Promise((resolve) => pending.push(resolve))) } as unknown as Api;
  const { client, wrapper } = setup();
  client.setQueryData(keys.preferences, { theme: 'golden', units: 'metric', home: null });
  const { result } = await renderHook(() => usePatchPreferences(), { wrapper });
  const theme = result.current.mutateAsync({ theme: 'camera' });
  const units = result.current.mutateAsync({ units: 'imperial' });
  await waitFor(() => expect(pending).toHaveLength(2));
  pending[0]!({ theme: 'camera', units: 'metric', home: null });
  await theme;
  pending[1]!({ theme: 'golden', units: 'imperial', home: null }); // the server ran the units save first
  await units;
  expect(client.getQueryData(keys.preferences)).toEqual({ theme: 'camera', units: 'imperial', home: null });
});

test('the light and weather are cached per place and per day', () => {
  const at = { lat: -37.81, lng: 144.96 };
  expect(keys.conditions(at, '2026-10-20')).not.toEqual(keys.conditions(at, '2026-10-21'));
});
