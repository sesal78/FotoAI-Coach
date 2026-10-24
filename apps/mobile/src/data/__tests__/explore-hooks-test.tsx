import { dehydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fakeApi } from '../../../test/harness';
import { ApiClientError } from '../../lib/api';
import { isNotSetUp, useAddSpot, useDeleteSpot, useExplainPlace, useExplainSpot, useNearby, usePlacePhoto, useSearch, useSpots, useUpdateSpot } from '../hooks';
import { QUERY_DEFAULTS } from '../query-defaults';
import { keys } from '../keys';
import { createSavedReads } from '../persist';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../client', () => ({ getApi: () => mockApi.current }));

const AT = { lat: -37.81, lng: 144.96 };
const PLACE = { placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ', name: 'Federation Square', location: AT, primaryType: 'plaza', types: ['plaza'], distanceM: 120, photo: null };
const SPOT = { id: '22222222-2222-4333-8444-555555555555', source: 'user', placeId: null, name: 'Pier', location: AT, notes: null, favourite: false, createdAt: '2026-10-22T08:00:00+00:00', unavailable: false };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const memory = () => ({ getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined });

test('Places answers are never saved on the phone; My spots are', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/explore/nearby': { places: [PLACE] }, 'GET /api/v2/me/spots': { spots: [SPOT] } });
  const { client, wrapper } = setup();
  const nearby = await renderHook(() => useNearby(AT), { wrapper });
  const spots = await renderHook(() => useSpots(), { wrapper });
  await waitFor(() => expect(nearby.result.current.isSuccess && spots.result.current.isSuccess).toBe(true));
  const saved = dehydrate(client, createSavedReads(memory(), '1').options.dehydrateOptions);
  const savedKeys = saved.queries.map((q) => q.queryKey[0] === 'me' ? q.queryKey.join('/') : String(q.queryKey[0]));
  expect(savedKeys).toContain('me/spots');
  expect(savedKeys).not.toContain('explore');
});

test('search waits for 2 characters and a pause before asking the server', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    mockApi.current = fakeApi({ 'GET /api/v2/explore/search': { places: [PLACE] } });
    const { wrapper } = setup();
    const view = await renderHook(({ q }: { q: string }) => useSearch(q, AT), { wrapper, initialProps: { q: 'f' } });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(mockApi.current.calls).toHaveLength(0);
    await view.rerender({ q: 'fed' });
    await act(async () => jest.advanceTimersByTime(200));
    expect(mockApi.current.calls).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(300));
    await waitFor(() => expect(mockApi.current!.calls).toHaveLength(1));
    expect(mockApi.current.calls[0]!.path).toBe('/api/v2/explore/search?q=fed&lat=-37.8100&lng=144.9600');
  } finally {
    jest.useRealTimers();
  }
});

test('explain does not run until asked', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/places/${PLACE.placeId}/explain`]: { explanation: { bestLight: 'Late afternoon', angles: ['Low'], caution: null, prompt: { id: 'place-explain', version: 1 } } } });
  const { wrapper } = setup();
  const view = await renderHook(() => useExplainPlace(PLACE.placeId), { wrapper });
  await act(async () => undefined);
  expect(mockApi.current.calls).toHaveLength(0);
  await act(async () => view.result.current.ask());
  await waitFor(() => expect(view.result.current.data?.explanation.bestLight).toBe('Late afternoon'));
  expect(mockApi.current.calls).toHaveLength(1);
});

test('adding, renaming, favouriting and deleting a spot update My spots in place, with no list refetch', async () => {
  mockApi.current = fakeApi({
    'POST /api/v2/me/spots': { spot: SPOT },
    [`PATCH /api/v2/me/spots/${SPOT.id}`]: (b: unknown) => ({ spot: { ...SPOT, ...(b as object) } }),
    [`DELETE /api/v2/me/spots/${SPOT.id}`]: { success: true },
  });
  const { client, wrapper } = setup();
  client.setQueryData(keys.spots, { spots: [] });
  const spy = jest.spyOn(client, 'invalidateQueries');
  const add = await renderHook(() => useAddSpot(), { wrapper });
  const update = await renderHook(() => useUpdateSpot(), { wrapper });
  const remove = await renderHook(() => useDeleteSpot(), { wrapper });
  const names = () => (client.getQueryData(keys.spots) as { spots: Array<{ name: string; favourite: boolean }> }).spots;
  await act(async () => void (await add.result.current.mutateAsync({ pin: { name: 'Pier', lat: AT.lat, lng: AT.lng } })));
  expect(names().map((s) => s.name)).toEqual(['Pier']);
  await act(async () => void (await update.result.current.mutateAsync({ id: SPOT.id, patch: { name: 'Old pier' } })));
  expect(names()[0]!.name).toBe('Old pier');
  await act(async () => void (await update.result.current.mutateAsync({ id: SPOT.id, patch: { favourite: true } })));
  expect(names()[0]!.favourite).toBe(true);
  await act(async () => void (await remove.result.current.mutateAsync(SPOT.id)));
  expect(names()).toEqual([]);
  // Refetching the whole list costs one Google call per saved Google spot: never done for a write.
  expect(spy.mock.calls.filter((c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(keys.spots))).toHaveLength(0);
  expect(mockApi.current.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'POST /api/v2/me/spots',
    `PATCH /api/v2/me/spots/${SPOT.id}`,
    `PATCH /api/v2/me/spots/${SPOT.id}`,
    `DELETE /api/v2/me/spots/${SPOT.id}`,
  ]);
});

test("the server's config error is told apart (Places unavailable)", () => {
  expect(isNotSetUp(new ApiClientError('config', 500, 'Places is not configured'))).toBe(true);
  expect(isNotSetUp(new ApiClientError('upstream', 502, 'Google is down'))).toBe(false);
  expect(isNotSetUp(new Error('x'))).toBe(false);
});

test('a spot edit after an explain does not run the explain again', async () => {
  mockApi.current = fakeApi({
    'GET /api/v2/me/spots': { spots: [SPOT] },
    [`GET /api/v2/me/spots/${SPOT.id}/explain`]: { explanation: { bestLight: 'Dusk', angles: [], caution: null, prompt: { id: 'place-explain', version: 1 } } },
    [`PATCH /api/v2/me/spots/${SPOT.id}`]: (b: unknown) => ({ spot: { ...SPOT, ...(b as object) } }),
  });
  const { wrapper } = setup();
  const view = await renderHook(() => ({ spots: useSpots(), explain: useExplainSpot(SPOT.id), update: useUpdateSpot() }), { wrapper });
  await act(async () => view.result.current.explain.ask());
  await waitFor(() => expect(view.result.current.explain.data?.explanation.bestLight).toBe('Dusk'));
  await act(async () => void (await view.result.current.update.mutateAsync({ id: SPOT.id, patch: { favourite: true } })));
  await act(async () => undefined);
  expect(mockApi.current.calls.filter((c) => c.path.endsWith('/explain'))).toHaveLength(1);
});

test('a failed photo or explain is not retried by itself (each try uses the hourly limit)', async () => {
  mockApi.current = fakeApi({
    [`GET /api/v2/places/${PLACE.placeId}/photo`]: new ApiClientError('upstream', 502, 'Google did not answer'),
    [`GET /api/v2/places/${PLACE.placeId}/explain`]: new ApiClientError('upstream', 502, 'The coach did not answer'),
  });
  const client = new QueryClient({ defaultOptions: { queries: { ...QUERY_DEFAULTS.queries, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const photo = await renderHook(() => usePlacePhoto(PLACE.placeId, `places/${PLACE.placeId}/photos/x`), { wrapper });
  const explain = await renderHook(() => useExplainPlace(PLACE.placeId), { wrapper });
  await act(async () => explain.result.current.ask());
  await waitFor(() => expect(photo.result.current.isError && explain.result.current.isError).toBe(true));
  expect(mockApi.current.calls).toHaveLength(2);
});

test("saving, favouriting and removing a Google spot update that place's own screen at once, with no paid refetch", async () => {
  const GSPOT = { ...SPOT, source: 'google', placeId: PLACE.placeId, name: PLACE.name };
  mockApi.current = fakeApi({
    'POST /api/v2/me/spots': { spot: GSPOT },
    [`PATCH /api/v2/me/spots/${SPOT.id}`]: (b: unknown) => ({ spot: { ...GSPOT, ...(b as object) } }),
    [`DELETE /api/v2/me/spots/${SPOT.id}`]: { success: true },
  });
  const { client, wrapper } = setup();
  client.setQueryData(keys.spots, { spots: [] });
  client.setQueryData(keys.place(PLACE.placeId), { place: PLACE, light: null, weather: null, spot: null });
  const add = await renderHook(() => useAddSpot(), { wrapper });
  const update = await renderHook(() => useUpdateSpot(), { wrapper });
  const remove = await renderHook(() => useDeleteSpot(), { wrapper });
  const onScreen = () => (client.getQueryData(keys.place(PLACE.placeId)) as { spot: { favourite: boolean } | null }).spot;
  await act(async () => void (await add.result.current.mutateAsync({ placeId: PLACE.placeId })));
  expect(onScreen()).toMatchObject({ id: SPOT.id, favourite: false });
  await act(async () => void (await update.result.current.mutateAsync({ id: SPOT.id, patch: { favourite: true } })));
  expect(onScreen()).toMatchObject({ favourite: true });
  await act(async () => void (await remove.result.current.mutateAsync(SPOT.id)));
  expect(onScreen()).toBeNull();
  // Each place screen GET reserves one Places call: a write never asks for it again.
  expect(mockApi.current.calls.some((c) => c.method === 'GET')).toBe(false);
});

test('a place reload already on its way when the spot is saved cannot put the old unsaved answer back', async () => {
  const GSPOT = { ...SPOT, source: 'google', placeId: PLACE.placeId, name: PLACE.name };
  let answerReload: (value: unknown) => void = () => undefined;
  mockApi.current = fakeApi({
    [`GET /api/v2/places/${PLACE.placeId}`]: () => new Promise((resolve) => (answerReload = resolve)),
    'POST /api/v2/me/spots': { spot: GSPOT },
  });
  const { client, wrapper } = setup();
  client.setQueryData(keys.place(PLACE.placeId), { place: PLACE, light: null, weather: null, spot: null });
  const reload = client.fetchQuery({
    queryKey: keys.place(PLACE.placeId),
    queryFn: () => mockApi.current!.request(`/api/v2/places/${PLACE.placeId}`),
    staleTime: 0,
  }).catch(() => undefined);
  const add = await renderHook(() => useAddSpot(), { wrapper });
  await act(async () => void (await add.result.current.mutateAsync({ placeId: PLACE.placeId })));
  // The server read the spot before the save landed: its late answer still says "not saved".
  await act(async () => {
    answerReload({ place: PLACE, light: null, weather: null, spot: null });
    await reload;
  });
  expect((client.getQueryData(keys.place(PLACE.placeId)) as { spot: unknown }).spot).toMatchObject({ id: SPOT.id });
});
