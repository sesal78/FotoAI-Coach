import { act, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { PREFS_HOME } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Explore from '../app/(tabs)/explore';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../lib/maps', () => ({ mapsConfigured: () => true }));
// Sydney, far from the Fitzroy home area in PREFS_HOME.
const mockLocation: { granted: boolean; asked: number; hold: Promise<void> | null } = { granted: true, asked: 0, hold: null };
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: async () => {
    await mockLocation.hold;
    return { granted: mockLocation.granted, canAskAgain: true };
  },
  requestForegroundPermissionsAsync: async () => {
    mockLocation.asked += 1;
    return { granted: mockLocation.granted, canAskAgain: true };
  },
  getLastKnownPositionAsync: async () => (mockLocation.granted ? { coords: { latitude: -33.8688, longitude: 151.2093 } } : null),
  getCurrentPositionAsync: async () => null,
}));

const routes = {
  'GET /api/v2/me/preferences': PREFS_HOME,
  'GET /api/v2/explore/nearby': { places: [] },
  'GET /api/v2/me/spots': { spots: [] },
};
const nearbyAt = () => mockApi.current!.calls.find((c) => c.path.startsWith('/api/v2/explore/nearby'))?.path;

let backToApp: (state: AppStateStatus) => void = () => undefined;
beforeEach(() => {
  mockLocation.asked = 0;
  mockLocation.hold = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    backToApp = handler as (state: AppStateStatus) => void;
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());
const nearbyCalls = () => mockApi.current!.calls.filter((c) => c.path.startsWith('/api/v2/explore/nearby')).map((c) => c.path);

test('with location allowed, Explore looks where the phone is, even with a home area set', async () => {
  mockLocation.granted = true;
  mockApi.current = fakeApi(routes);
  await renderScreen(<Explore />);
  await waitFor(() => expect(nearbyAt()).toContain('lat=-33.8690&lng=151.2090'));
  expect(mockApi.current.calls.filter((c) => c.path.startsWith('/api/v2/explore/nearby'))).toHaveLength(1);
  expect(mockLocation.asked).toBe(0);
});

test('with location not allowed, Explore uses the home area and does not ask by itself', async () => {
  mockLocation.granted = false;
  mockApi.current = fakeApi(routes);
  await renderScreen(<Explore />);
  await waitFor(() => expect(nearbyAt()).toContain('lat=-37.8100&lng=144.9600'));
  expect(screen.queryByText('Use my location')).toBeNull();
  expect(mockLocation.asked).toBe(0);
});

test('coming back to the app with location still refused keeps Explore as it was (no loading, no new search)', async () => {
  mockLocation.granted = false;
  mockApi.current = fakeApi(routes);
  await renderScreen(<Explore />);
  await waitFor(() => expect(nearbyCalls()).toHaveLength(1));
  let release: () => void = () => undefined;
  mockLocation.hold = new Promise((r) => (release = r));
  // While the phone is checked again, the map and the list stay on screen.
  await act(async () => backToApp('active'));
  expect(screen.queryByText('Finding where you are…')).toBeNull();
  expect(screen.getByTestId('map')).toBeTruthy();
  await act(async () => release());
  expect(screen.getByTestId('map')).toBeTruthy();
  expect(nearbyCalls()).toHaveLength(1);
});

test('allowing location in Android settings and coming back moves Explore to where the phone is', async () => {
  mockLocation.granted = false;
  mockApi.current = fakeApi(routes);
  await renderScreen(<Explore />);
  await waitFor(() => expect(nearbyCalls()).toHaveLength(1));
  mockLocation.granted = true;
  await act(async () => backToApp('active'));
  await waitFor(() => expect(nearbyCalls().at(-1)).toContain('lat=-33.8690&lng=151.2090'));
  expect(mockLocation.asked).toBe(0);
});
