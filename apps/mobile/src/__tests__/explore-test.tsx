import type { PlaceSummary } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PREFS_HOME, spot } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Explore from '../app/(tabs)/explore';
import { ApiClientError } from '../lib/api';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
const mockMaps = { configured: true };
jest.mock('../lib/maps', () => ({ mapsConfigured: () => mockMaps.configured }));
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: async () => null,
}));

const place = (over: Partial<PlaceSummary>): PlaceSummary => ({
  placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ',
  name: 'Federation Square',
  location: { lat: -37.818, lng: 144.969 },
  primaryType: 'plaza',
  types: ['plaza'],
  distanceM: 900,
  photo: null,
  ...over,
});
const FED = place({});
const PARK = place({ placeId: 'ChIJparkparkparkpark', name: 'Fitzroy Gardens', location: { lat: -37.8126, lng: 144.9799 }, primaryType: 'park' });
const MY = spot({ name: 'Pier at Williamstown', location: { lat: -37.86, lng: 144.9 } });

function routes(over: Record<string, unknown> = {}) {
  return {
    'GET /api/v2/me/preferences': PREFS_HOME,
    'GET /api/v2/explore/nearby': { places: [FED, PARK] },
    'GET /api/v2/explore/search': { places: [FED] },
    'GET /api/v2/me/spots': { spots: [MY, spot({ id: '33333333-2222-4333-8444-555555555555', source: 'google', placeId: 'ChIJgonegonegone12', name: 'Gone', location: null, unavailable: true })] },
    ...over,
  };
}

beforeEach(() => {
  mockMaps.configured = true;
  (router.push as jest.Mock).mockClear();
});

test('every marker and row comes from the API or My spots (nothing else is drawn)', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Explore />);
  expect(await screen.findByText('Fitzroy Gardens')).toBeTruthy();
  const titles = screen.getAllByTestId('marker').map((m) => m.props.title);
  expect(titles.sort()).toEqual(['Federation Square', 'Fitzroy Gardens', 'Pier at Williamstown']);
  expect(screen.getByText('Pier at Williamstown')).toBeTruthy();
  expect(screen.getAllByText('My spot').length).toBe(1);
  // A Google spot that cannot load right now stays in the list (no marker), so it can be opened.
  expect(screen.getByText('Gone')).toBeTruthy();
  expect(screen.getByText("Can't load from Google right now")).toBeTruthy();
  expect(screen.getByLabelText('Search places').props.maxLength).toBe(120);
  await act(async () => await fireEvent.press(screen.getByLabelText('Fitzroy Gardens, 1.8 km')));
  expect(router.push).toHaveBeenCalledWith('/place/ChIJparkparkparkpark');
  await act(async () => await fireEvent.press(screen.getByLabelText(/^Pier at Williamstown, My spot/)));
  expect(router.push).toHaveBeenCalledWith(`/spot/${MY.id}`);
});

test('no maps key shows the list and Map unavailable', async () => {
  mockMaps.configured = false;
  mockApi.current = fakeApi(routes());
  await renderScreen(<Explore />);
  expect(await screen.findByText('Federation Square')).toBeTruthy();
  expect(screen.queryByTestId('map')).toBeNull();
  expect(screen.getByText(/Map unavailable/)).toBeTruthy();
  expect(screen.getByText('Place data from Google Maps')).toBeTruthy();
});

test('a config error shows Places unavailable, and My spots still shows', async () => {
  mockApi.current = fakeApi(routes({ 'GET /api/v2/explore/nearby': new ApiClientError('config', 500, 'Places is not configured') }));
  await renderScreen(<Explore />);
  expect(await screen.findByText(/Places unavailable right now/)).toBeTruthy();
  expect(screen.getByText('Pier at Williamstown')).toBeTruthy();
  expect(screen.queryByText('Retry')).toBeNull();
});

test('a chip asks for that type; tapping it again clears it', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Explore />);
  await screen.findByText('Fitzroy Gardens');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Beaches' })));
  await waitFor(() => expect(mockApi.current!.calls.some((c) => c.path.includes('/explore/nearby') && c.path.endsWith('&type=beach'))).toBe(true));
  const before = mockApi.current.calls.length;
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Beaches' })));
  expect(screen.getByRole('button', { name: 'Beaches' }).props.accessibilityState).toMatchObject({ selected: false });
  // Back to the unfiltered answer (cached or asked again), never a type the user cleared.
  expect(mockApi.current.calls.slice(before).every((c) => !c.path.includes('type=beach'))).toBe(true);
  expect(await screen.findByText('Fitzroy Gardens')).toBeTruthy();
});

test('search shows results for the typed text', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Explore />);
  await screen.findByText('Fitzroy Gardens');
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Search places'), 'fed'));
  expect(await screen.findByText('Federation Square', {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.queryByText('Fitzroy Gardens')).toBeNull();
  expect(mockApi.current.calls.some((c) => c.path.startsWith('/api/v2/explore/search?q=fed'))).toBe(true);
});

test('loading, empty, error and offline states', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi(routes({ 'GET /api/v2/explore/nearby': () => new Promise((r) => (release = r)) }));
  const first = await renderScreen(<Explore />);
  expect(await screen.findByText('Finding places…')).toBeTruthy();
  await act(async () => release({ places: [] }));
  expect(await screen.findByText('No places found here')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi(routes({ 'GET /api/v2/explore/nearby': new ApiClientError('upstream', 502, 'Google did not answer') }));
  const second = await renderScreen(<Explore />);
  expect(await screen.findByText('Google did not answer')).toBeTruthy();
  await second.unmount();

  mockApi.current = fakeApi(routes({ 'GET /api/v2/explore/nearby': new ApiClientError('offline', 0, 'No connection') }));
  await renderScreen(<Explore />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});

describe('drop a pin', () => {
  test('a long press opens the sheet with those coordinates; a pin needs a name', async () => {
    mockApi.current = fakeApi(routes());
    await renderScreen(<Explore />);
    await screen.findByText('Fitzroy Gardens');
    await act(async () => await fireEvent(screen.getByTestId('map'), 'longPress', { nativeEvent: { coordinate: { latitude: -37.801234567, longitude: 144.951234567 } } }));
    expect(screen.getByText('New pin at -37.80123, 144.95123')).toBeTruthy();
    expect(screen.getByLabelText('Pin name').props.autoFocus).toBe(true);
    await act(async () => await fireEvent.press(screen.getByText('Save pin')));
    expect(screen.getByText('A pin needs a name')).toBeTruthy();
    expect(mockApi.current.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  test('saving shows the new spot in the list at once', async () => {
    let mine = [MY];
    mockApi.current = fakeApi(routes({
      'GET /api/v2/me/spots': () => ({ spots: mine }),
      'POST /api/v2/me/spots': (b: unknown) => {
        const body = b as { pin: { name: string; lat: number; lng: number }; notes?: string };
        const made = spot({ id: '44444444-2222-4333-8444-555555555555', name: body.pin.name, location: { lat: body.pin.lat, lng: body.pin.lng }, favourite: false });
        mine = [...mine, made];
        return { spot: made };
      },
    }));
    await renderScreen(<Explore />);
    await screen.findByText('Fitzroy Gardens');
    await act(async () => await fireEvent(screen.getByTestId('map'), 'longPress', { nativeEvent: { coordinate: { latitude: -37.8012, longitude: 144.9512 } } }));
    await act(async () => await fireEvent.changeText(screen.getByLabelText('Pin name'), 'Laneway mural'));
    await act(async () => await fireEvent.changeText(screen.getByLabelText('Pin notes'), 'Best before 9am'));
    await act(async () => await fireEvent.press(screen.getByText('Save pin')));
    expect(mockApi.current.calls.find((c) => c.method === 'POST')?.body).toEqual({ pin: { name: 'Laneway mural', lat: -37.8012, lng: 144.9512 }, notes: 'Best before 9am' });
    expect(await screen.findByText('Laneway mural')).toBeTruthy();
    expect(screen.queryByText('Save pin')).toBeNull();
  });

  test('without a map, Add a pin here uses the centre', async () => {
    mockMaps.configured = false;
    mockApi.current = fakeApi(routes());
    await renderScreen(<Explore />);
    await act(async () => await fireEvent.press(await screen.findByText('Add a pin here')));
    expect(screen.getByText('New pin at -37.81000, 144.96000')).toBeTruthy();
  });
});
