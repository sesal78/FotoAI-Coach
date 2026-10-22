import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiClientError, createApi, type Api } from '../../lib/api';
import { useMe, usePatchChallenge } from '../hooks';
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
