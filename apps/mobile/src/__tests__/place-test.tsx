import type { PlaceDetail } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

import { LIGHT, PREFS_HOME, spot, WEATHER } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import PlaceScreen from '../app/place/[placeId]';
import SpotScreen from '../app/spot/[id]';
import { ApiClientError } from '../lib/api';

const PID = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const SID = '22222222-2222-4333-8444-555555555555';
const mockParams: { current: Record<string, string> } = { current: { placeId: PID } };
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

const PHOTO = { name: `places/${PID}/photos/AbC123`, attributions: [{ displayName: 'Jo Smith', uri: 'https://maps.google.com/maps/contrib/123' }] };
const DETAIL: PlaceDetail = {
  placeId: PID,
  name: 'Federation Square',
  location: { lat: -37.818, lng: 144.969 },
  primaryType: 'plaza',
  types: ['plaza'],
  distanceM: null,
  photo: PHOTO,
  formattedAddress: 'Swanston St, Melbourne VIC',
  googleMapsUri: 'https://maps.google.com/?cid=1',
  photos: [PHOTO],
};
const EXPLANATION = { bestLight: 'Late golden hour from the west.', angles: ['Low from the steps', 'Wide from the river'], caution: null, prompt: { id: 'place-explain', version: 1 } };

function placeRoutes(over: Record<string, unknown> = {}) {
  return {
    'GET /api/v2/me/preferences': PREFS_HOME,
    [`GET /api/v2/places/${PID}`]: { place: DETAIL, light: LIGHT, weather: WEATHER, spot: null },
    [`GET /api/v2/places/${PID}/photo`]: { photoUri: 'https://lh3.googleusercontent.com/p/photo=s800' },
    [`GET /api/v2/places/${PID}/explain`]: { explanation: EXPLANATION },
    'GET /api/v2/me/spots': { spots: [] },
    ...over,
  };
}

beforeEach(() => {
  mockParams.current = { placeId: PID };
});

test('the place shows its facts, the photo with its attributions, and the light', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  mockApi.current = fakeApi(placeRoutes());
  await renderScreen(<PlaceScreen />);
  expect(await screen.findByText('Federation Square')).toBeTruthy();
  expect(screen.getByText('Swanston St, Melbourne VIC')).toBeTruthy();
  expect(await screen.findByLabelText('Photo of Federation Square')).toBeTruthy();
  expect(screen.getByText('Photo: Jo Smith')).toBeTruthy();
  expect(screen.getByText(/1\.2 km away/)).toBeTruthy();
  expect(screen.getByText('19:05–19:58')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Photo: Jo Smith')));
  expect(open).toHaveBeenCalledWith('https://maps.google.com/maps/contrib/123');
  await act(async () => await fireEvent.press(screen.getByText('Open in Google Maps')));
  expect(open).toHaveBeenCalledWith('https://maps.google.com/?cid=1');
  open.mockRestore();
});

test('explain runs only after the tap and shows the answer', async () => {
  mockApi.current = fakeApi(placeRoutes());
  await renderScreen(<PlaceScreen />);
  await screen.findByText('Federation Square');
  expect(mockApi.current.calls.some((c) => c.path.endsWith('/explain'))).toBe(false);
  await act(async () => await fireEvent.press(screen.getByText('Best light and angles')));
  expect(await screen.findByText('Late golden hour from the west.')).toBeTruthy();
  expect(screen.getByText(/Low from the steps/)).toBeTruthy();
});

test("a 429 on the explain shows the server's message", async () => {
  mockApi.current = fakeApi(placeRoutes({ [`GET /api/v2/places/${PID}/explain`]: new ApiClientError('rate_limited', 429, 'Rate limit: at most 60 place explain requests per hour.') }));
  await renderScreen(<PlaceScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Best light and angles')));
  expect(await screen.findByText(/at most 60 place explain requests/)).toBeTruthy();
});

test('save, favourite and remove change My spots', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  let saved: ReturnType<typeof spot> | null = null;
  mockApi.current = fakeApi(placeRoutes({
    [`GET /api/v2/places/${PID}`]: () => ({ place: DETAIL, light: LIGHT, weather: WEATHER, spot: saved }),
    'POST /api/v2/me/spots': (b: unknown) => {
      saved = spot({ id: SID, source: 'google', placeId: PID, name: 'Federation Square', favourite: false, notes: (b as { notes?: string }).notes ?? null });
      return { spot: saved };
    },
    [`PATCH /api/v2/me/spots/${SID}`]: (b: unknown) => {
      saved = { ...saved!, ...(b as object) };
      return { spot: saved };
    },
    [`DELETE /api/v2/me/spots/${SID}`]: () => {
      saved = null;
      return { success: true };
    },
  }));
  await renderScreen(<PlaceScreen />);
  await act(async () => await fireEvent.changeText(await screen.findByLabelText('Notes'), 'Go at dusk'));
  await act(async () => await fireEvent.press(screen.getByText('Save to My spots')));
  expect(mockApi.current.calls.find((c) => c.method === 'POST')?.body).toEqual({ placeId: PID, notes: 'Go at dusk' });
  await act(async () => await fireEvent.press(await screen.findByText('Add to favourites')));
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ favourite: true }));
  await act(async () => await fireEvent.press(await screen.findByText('Remove from My spots')));
  expect(alert).toHaveBeenCalledTimes(1);
  await act(async () => alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!.onPress!());
  await waitFor(() => expect(mockApi.current!.calls.some((c) => c.method === 'DELETE')).toBe(true));
  alert.mockRestore();
});

test("a pin's name and notes can be edited, and it explains from the spot endpoint", async () => {
  mockParams.current = { id: SID };
  const pin = spot({ id: SID, name: 'Pier', notes: 'faces west' });
  mockApi.current = fakeApi({
    'GET /api/v2/me/preferences': PREFS_HOME,
    'GET /api/v2/me/spots': { spots: [pin] },
    [`PATCH /api/v2/me/spots/${SID}`]: (b: unknown) => ({ spot: { ...pin, ...(b as object) } }),
    [`GET /api/v2/me/spots/${SID}/explain`]: { explanation: EXPLANATION },
  });
  await renderScreen(<SpotScreen />);
  await act(async () => await fireEvent.changeText(await screen.findByLabelText('Name'), 'Old pier'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Notes'), 'faces west, low tide best'));
  await act(async () => await fireEvent.press(screen.getByText('Save changes')));
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Old pier', notes: 'faces west, low tide best' }));
  await act(async () => await fireEvent.press(screen.getByText('Best light and angles')));
  expect(await screen.findByText('Late golden hour from the west.')).toBeTruthy();
  expect(mockApi.current.calls.some((c) => c.path === `/api/v2/me/spots/${SID}/explain`)).toBe(true);
});

test('a spot Google no longer has says so', async () => {
  mockParams.current = { id: SID };
  mockApi.current = fakeApi({
    'GET /api/v2/me/preferences': PREFS_HOME,
    'GET /api/v2/me/spots': { spots: [spot({ id: SID, source: 'google', placeId: PID, name: null, location: null, unavailable: true })] },
  });
  await renderScreen(<SpotScreen />);
  expect(await screen.findByText('No longer on Google Maps')).toBeTruthy();
});

test('loading, not found and offline states', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi(placeRoutes({ [`GET /api/v2/places/${PID}`]: () => new Promise((r) => (release = r)) }));
  const first = await renderScreen(<PlaceScreen />);
  expect(await screen.findByText('Loading the place…')).toBeTruthy();
  await act(async () => release({ place: DETAIL, light: LIGHT, weather: null, spot: null }));
  expect(await screen.findByText('Weather unavailable')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi(placeRoutes({ [`GET /api/v2/places/${PID}`]: new ApiClientError('not_found', 404, 'Google has no such place') }));
  const second = await renderScreen(<PlaceScreen />);
  expect(await screen.findByText('Google has no such place')).toBeTruthy();
  await second.unmount();

  mockApi.current = fakeApi(placeRoutes({ [`GET /api/v2/places/${PID}`]: new ApiClientError('offline', 0, 'No connection') }));
  await renderScreen(<PlaceScreen />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});
