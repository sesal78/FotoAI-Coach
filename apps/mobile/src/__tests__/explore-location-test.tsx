import { screen, waitFor } from '@testing-library/react-native';

import { PREFS_HOME } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Explore from '../app/(tabs)/explore';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../lib/maps', () => ({ mapsConfigured: () => true }));
// Sydney, far from the Fitzroy home area in PREFS_HOME.
const mockLocation = { granted: true, asked: 0 };
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: async () => ({ granted: mockLocation.granted, canAskAgain: true }),
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

beforeEach(() => {
  mockLocation.asked = 0;
});

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
