import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { challenge, LIGHT, PREFS_HOME, PREFS_NONE, spot, WEATHER } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Today from '../app/(tabs)/today';
import { ApiClientError } from '../lib/api';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

const mockAsk = jest.fn();
const mockLocation = { granted: true, canAskAgain: true, grantOnAsk: true, coords: { latitude: -33.87, longitude: 151.21 } as { latitude: number; longitude: number } | null };
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ granted: mockLocation.granted, canAskAgain: mockLocation.canAskAgain }),
  requestForegroundPermissionsAsync: async () => {
    mockAsk();
    mockLocation.granted = mockLocation.grantOnAsk;
    return { granted: mockLocation.granted, canAskAgain: false };
  },
  getLastKnownPositionAsync: async () => (mockLocation.coords ? { coords: mockLocation.coords } : null),
  getCurrentPositionAsync: async () => ({ coords: mockLocation.coords }),
}));

function routes(over: Record<string, unknown> = {}) {
  return {
    'GET /api/v2/me/preferences': PREFS_HOME,
    'GET /api/v2/conditions': { light: LIGHT, weather: WEATHER },
    'GET /api/v2/challenges/active': { challenge: null },
    'GET /api/v2/me/spots': { spots: [] },
    ...over,
  };
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-20T12:00:00+11:00'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  Object.assign(mockLocation, { granted: true, canAskAgain: true, grantOnAsk: true, coords: { latitude: -33.87, longitude: 151.21 } });
  mockAsk.mockClear();
});
afterEach(() => jest.useRealTimers());

test('Today uses the home area first', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Today />);
  expect(await screen.findByText(/Fitzroy/)).toBeTruthy();
  const conditions = mockApi.current.calls.find((c) => c.path.startsWith('/api/v2/conditions'))!;
  expect(conditions.path).toBe('/api/v2/conditions?lat=-37.8100&lng=144.9600');
  expect(await screen.findByText(/Golden hour in/)).toBeTruthy();
  expect(screen.getByText('19:05–19:58')).toBeTruthy();
  expect(screen.getByText('05:50–06:10')).toBeTruthy(); // blue morning
});

test("with no home area Today uses the phone's location", async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/preferences': PREFS_NONE }));
  await renderScreen(<Today />);
  expect(await screen.findByText(/Where you are/)).toBeTruthy();
  expect(mockApi.current.calls.some((c) => c.path === '/api/v2/conditions?lat=-33.8700&lng=151.2100')).toBe(true);
});

test('with no home area and no location permission Today asks for a home area', async () => {
  Object.assign(mockLocation, { granted: false, canAskAgain: false });
  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/preferences': PREFS_NONE }));
  await renderScreen(<Today />);
  expect(await screen.findByText('Set your home area')).toBeTruthy();
  expect(mockApi.current.calls.some((c) => c.path.startsWith('/api/v2/conditions'))).toBe(false);
  await act(async () => await fireEvent.press(screen.getByText('Set your home area')));
  expect(router.push).toHaveBeenCalledWith('/me/settings');
});

test('weather null shows Weather unavailable', async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/conditions': { light: LIGHT, weather: null } }));
  await renderScreen(<Today />);
  expect(await screen.findByText('Weather unavailable')).toBeTruthy();
});

test('weather shows in the chosen units with its attribution', async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/preferences': { ...PREFS_HOME, units: 'imperial' } }));
  await renderScreen(<Today />);
  expect(await screen.findByText(/63°F/)).toBeTruthy();
  expect(screen.getByText('Weather data by Open-Meteo.com')).toBeTruthy();
});

test('New challenge shows the returned challenge, on 201 and on 200', async () => {
  for (const created of [true, false]) {
    mockApi.current = fakeApi(routes({ 'POST /api/v2/challenges': { challenge: challenge(), created } }));
    const { unmount } = await renderScreen(<Today />);
    await act(async () => await fireEvent.press(await screen.findByText('New challenge')));
    expect(await screen.findByText('Shoot five doorways in side light')).toBeTruthy();
    await act(async () => await fireEvent.press(screen.getByText('Continue')));
    expect(router.push).toHaveBeenCalledWith('/challenge/11111111-2222-4333-8444-555555555555');
    await unmount();
  }
});

test("a 429 on New challenge shows the server's message", async () => {
  mockApi.current = fakeApi(routes({ 'POST /api/v2/challenges': new ApiClientError('rate_limited', 429, 'Rate limit: at most 20 challenge generate requests per hour.') }));
  await renderScreen(<Today />);
  await act(async () => await fireEvent.press(await screen.findByText('New challenge')));
  expect(await screen.findByText(/at most 20 challenge generate requests/)).toBeTruthy();
});

test('the suggested spot is the first favourite, and is hidden when there is none', async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/spots': { spots: [spot({ name: 'Not a favourite', favourite: false }), spot()] } }));
  const first = await renderScreen(<Today />);
  expect(await screen.findByText('Pier at Williamstown')).toBeTruthy();
  expect(screen.queryByText('Not a favourite')).toBeNull();
  await first.unmount();

  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/spots': { spots: [spot({ favourite: false })] } }));
  await renderScreen(<Today />);
  await screen.findByText(/Golden hour in/);
  expect(screen.queryByText('Suggested spot')).toBeNull();
});

test('Plan my shoot opens Shoot', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Today />);
  await act(async () => await fireEvent.press(await screen.findByText('Plan my shoot')));
  expect(router.navigate).toHaveBeenCalledWith('/shoot');
});

test('loading, error and offline states', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi(routes({ 'GET /api/v2/conditions': () => new Promise((r) => (release = r)) }));
  await renderScreen(<Today />);
  expect(await screen.findByText('Loading the light…')).toBeTruthy();
  await act(async () => release({ light: LIGHT, weather: WEATHER }));
  await waitFor(() => expect(screen.queryByText('Loading the light…')).toBeNull());
});

test('a conditions error shows the message with Retry; offline shows the offline note', async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/conditions': new ApiClientError('upstream', 502, 'Could not load the light') }));
  const first = await renderScreen(<Today />);
  expect(await screen.findByText('Could not load the light')).toBeTruthy();
  expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
  await first.unmount();

  mockApi.current = fakeApi(routes({ 'GET /api/v2/conditions': new ApiClientError('offline', 0, 'No connection') }));
  await renderScreen(<Today />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});

test('Today never pops the location prompt by itself; Use my location asks', async () => {
  Object.assign(mockLocation, { granted: false, canAskAgain: true, grantOnAsk: true });
  mockApi.current = fakeApi(routes({ 'GET /api/v2/me/preferences': PREFS_NONE }));
  await renderScreen(<Today />);
  expect(await screen.findByText('Use my location')).toBeTruthy();
  expect(mockAsk).not.toHaveBeenCalled();
  await act(async () => await fireEvent.press(screen.getByText('Use my location')));
  expect(mockAsk).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/Where you are/)).toBeTruthy();
});
