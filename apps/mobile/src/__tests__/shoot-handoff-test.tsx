import type { PlaceDetail } from '@fotoai/contracts';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LIGHT, PREFS_HOME, spot, WEATHER } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Shoot from '../app/(tabs)/shoot';
import PlaceScreen from '../app/place/[placeId]';
import SpotScreen from '../app/spot/[id]';

const PID = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const SID = '22222222-2222-4333-8444-555555555555';
const mockParams: { current: Record<string, string> } = { current: {} };
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams.current, router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: async () => null,
}));

const DETAIL: PlaceDetail = {
  placeId: PID, name: 'Federation Square', location: { lat: -37.818, lng: 144.969 }, primaryType: 'plaza', types: ['plaza'],
  distanceM: null, photo: null, formattedAddress: null, googleMapsUri: null, photos: [],
};
const routes = {
  'GET /api/v2/me/preferences': PREFS_HOME,
  [`GET /api/v2/places/${PID}`]: { place: DETAIL, light: LIGHT, weather: WEATHER, spot: null },
  'GET /api/v2/me/spots': { spots: [spot({ id: SID, name: 'Pier at Williamstown' })] },
};

test('the place screen opens Shoot with its placeId', async () => {
  mockParams.current = { placeId: PID };
  mockApi.current = fakeApi(routes);
  await renderScreen(<PlaceScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Plan a shoot here')));
  expect(router.navigate).toHaveBeenLastCalledWith(`/shoot?placeId=${PID}`);
});

test('the spot screen opens Shoot with its spotId', async () => {
  mockParams.current = { id: SID };
  mockApi.current = fakeApi(routes);
  await renderScreen(<SpotScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Plan a shoot here')));
  expect(router.navigate).toHaveBeenLastCalledWith(`/shoot?spotId=${SID}`);
});

test("Shoot shows the chosen place's or spot's name", async () => {
  mockParams.current = { placeId: PID };
  mockApi.current = fakeApi(routes);
  const first = await renderScreen(<Shoot />);
  expect(await screen.findByText('Planning: Federation Square')).toBeTruthy();
  expect(screen.getByText(/Shoot plans arrive in the next update/)).toBeTruthy();
  await first.unmount();

  mockParams.current = { spotId: SID };
  await renderScreen(<Shoot />);
  expect(await screen.findByText('Planning: Pier at Williamstown')).toBeTruthy();
});

test('Shoot with no place still shows the coming-soon note', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi(routes);
  await renderScreen(<Shoot />);
  expect(screen.getByText(/Shoot plans and the film log/)).toBeTruthy();
});
