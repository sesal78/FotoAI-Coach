import { z } from 'zod';

import { ApiClientError, createApi } from '../api';

const Me = z.object({ userId: z.string(), email: z.string() });
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(responses: Array<Response | Error>, token = 'tok-1') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  let current = token;
  const refresh = jest.fn(async (): Promise<'refreshed' | 'refused'> => {
    current = 'tok-2';
    return 'refreshed';
  });
  const onSignedOut = jest.fn();
  const api = createApi({ baseUrl: 'https://api.example', getToken: async () => current, refresh, onSignedOut, fetch: fetchFn as unknown as typeof fetch, timeoutMs: 50 });
  return { api, calls, refresh, onSignedOut };
}

test('the bearer token is sent and no user id is ever added', async () => {
  const { api, calls } = setup([ok({ userId: 'u', email: 'e' })]);
  await api.request('/api/v2/me', { schema: Me, method: 'POST', body: { note: 'x' } });
  expect(calls[0]!.url).toBe('https://api.example/api/v2/me');
  const headers = calls[0]!.init.headers as Record<string, string>;
  expect(headers.authorization).toBe('Bearer tok-1');
  expect(calls[0]!.init.body).toBe(JSON.stringify({ note: 'x' }));
  expect(calls[0]!.url + String(calls[0]!.init.body)).not.toMatch(/user_?id/i);
});

test('an error envelope becomes an ApiClientError with the server message', async () => {
  const { api } = setup([ok({ error: 'Set your loadout first', code: 'validation' }, 400)]);
  const err = await api.request('/api/v2/plans', { schema: Me }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiClientError);
  expect(err).toMatchObject({ code: 'validation', status: 400, message: 'Set your loadout first', retryable: false });
});

test('a response that fails its schema is bad_response', async () => {
  const { api } = setup([ok({ userId: 1 })]);
  await expect(api.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'bad_response' });
});

test('a network error or a timeout is offline and retryable', async () => {
  const { api } = setup([new TypeError('Network request failed')]);
  await expect(api.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'offline', retryable: true });

  const slow = createApi({
    baseUrl: 'https://api.example', getToken: async () => 't', refresh: async () => 'refused' as const, onSignedOut: () => undefined, timeoutMs: 20,
    fetch: ((_: string, init: RequestInit) => new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch,
  });
  await expect(slow.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'offline' });
});

test('upstream and rate limits are retryable; a config error or a 4xx is not', async () => {
  const { api } = setup([ok({ error: 'Google failed', code: 'upstream' }, 502), ok({ error: 'Slow down', code: 'rate_limited' }, 429), ok({ error: 'Places are not configured', code: 'config' }, 500)]);
  await expect(api.request('/x', { schema: Me })).rejects.toMatchObject({ code: 'upstream', retryable: true });
  await expect(api.request('/x', { schema: Me })).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
  await expect(api.request('/x', { schema: Me })).rejects.toMatchObject({ code: 'config', retryable: false });
});

test('a 401 refreshes once and retries once; a second 401 signs out', async () => {
  const unauth = () => ok({ error: 'Not authenticated', code: 'unauthenticated' }, 401);
  const first = setup([unauth(), ok({ userId: 'u', email: 'e' })]);
  await expect(first.api.request('/api/v2/me', { schema: Me })).resolves.toEqual({ userId: 'u', email: 'e' });
  expect(first.refresh).toHaveBeenCalledTimes(1);
  expect((first.calls[1]!.init.headers as Record<string, string>).authorization).toBe('Bearer tok-2');

  const second = setup([unauth(), unauth()]);
  await expect(second.api.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'unauthenticated' });
  expect(second.refresh).toHaveBeenCalledTimes(1);
  expect(second.onSignedOut).toHaveBeenCalledTimes(1);
});

test('a refresh that fails on the network is offline and keeps the user signed in', async () => {
  const onSignedOut = jest.fn();
  const api = createApi({
    baseUrl: 'https://api.example', getToken: async () => 't', onSignedOut, timeoutMs: 50,
    refresh: async () => { throw new ApiClientError('offline', 0, 'No connection'); },
    fetch: (async () => ok({ error: 'Not authenticated', code: 'unauthenticated' }, 401)) as unknown as typeof fetch,
  });
  await expect(api.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'offline' });
  expect(onSignedOut).not.toHaveBeenCalled();
});

test('a refused refresh signs out without a second request', async () => {
  const onSignedOut = jest.fn();
  const fetchFn = jest.fn(async () => ok({ error: 'Not authenticated', code: 'unauthenticated' }, 401));
  const api = createApi({ baseUrl: 'https://api.example', getToken: async () => 't', onSignedOut, refresh: async () => 'refused', fetch: fetchFn as unknown as typeof fetch });
  await expect(api.request('/api/v2/me', { schema: Me })).rejects.toMatchObject({ code: 'unauthenticated' });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(onSignedOut).toHaveBeenCalledTimes(1);
});

test('an empty 204 body is passed to the schema as undefined', async () => {
  const { api } = setup([new Response(null, { status: 204 })]);
  await expect(api.request('/api/v2/thing', { method: 'DELETE', schema: z.undefined() })).resolves.toBeUndefined();
});
