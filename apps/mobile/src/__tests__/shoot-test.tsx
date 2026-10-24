import { PlanSummaryDto, type PlaceDetail } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { filmLoadout, LIGHT, plan, PLAN_ID, PREFS_HOME, roll, spot, WEATHER } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Shoot from '../app/(tabs)/shoot';
import PlaceScreen from '../app/place/[placeId]';
import SpotScreen from '../app/spot/[id]';
import { ApiClientError } from '../lib/api';

const PID = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const SID = '22222222-2222-4333-8444-555555555555';
const mockParams: { current: Record<string, string> } = { current: {} };
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams.current, router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() } }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));
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
const summary = (over: Partial<PlanSummaryDto> = {}) => PlanSummaryDto.parse({ ...plan(), ...over });
const routes = {
  'GET /api/v2/me/preferences': PREFS_HOME,
  'GET /api/v2/me/loadout': { loadout: filmLoadout() },
  'GET /api/v2/plans': { plans: [] },
  'GET /api/v2/rolls': { rolls: [] },
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

test('Plan a shoot here opens New plan with that place, the date and the loadout', async () => {
  mockParams.current = { placeId: PID };
  mockApi.current = fakeApi(routes);
  await renderScreen(<Shoot />);
  expect(await screen.findByText('Planning: Federation Square')).toBeTruthy();
  expect(await screen.findByText('Nikon FM2 · AI-S 50mm f/1.8 · Kodak Portra 400')).toBeTruthy();
  expect(screen.getByText('Today')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Change loadout')));
  expect(router.push).toHaveBeenLastCalledWith('/me/loadout');
});

test('Make the plan sends the place and the date, then opens the plan', async () => {
  mockParams.current = { spotId: SID };
  mockApi.current = fakeApi({ ...routes, 'POST /api/v2/plans': { plan: plan({ placeSource: 'user', placeId: null, spotId: SID }) } });
  await renderScreen(<Shoot />);
  await act(async () => await fireEvent.press(await screen.findByText('Tomorrow')));
  await act(async () => await fireEvent.press(screen.getByText('Make the plan')));
  const body = mockApi.current.calls.find((c) => c.method === 'POST')?.body as { spotId: string; date: string };
  expect(body.spotId).toBe(SID);
  expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await waitFor(() => expect(router.push).toHaveBeenLastCalledWith(`/plan/${PLAN_ID}`));
});

test('the loadout message links to the loadout', async () => {
  mockParams.current = { placeId: PID };
  mockApi.current = fakeApi({ ...routes, 'GET /api/v2/me/loadout': { loadout: filmLoadout({ film: null }) }, 'POST /api/v2/plans': new ApiClientError('validation', 400, 'Load a film first') });
  await renderScreen(<Shoot />);
  await act(async () => await fireEvent.press(await screen.findByText('Make the plan')));
  expect(await screen.findByText('Load a film first')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Open the loadout')));
  expect(router.push).toHaveBeenLastCalledWith('/me/loadout');
});

test('my plans list active first, then done; archived plans are hidden', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi({
    ...routes,
    'GET /api/v2/plans': {
      plans: [
        summary({ id: '11111111-aaaa-4bbb-8ccc-0000000000d1', title: 'Done at the pier', status: 'done' }),
        summary({ id: '11111111-aaaa-4bbb-8ccc-0000000000a1', title: 'Old archived plan', status: 'archived' }),
        summary({ title: 'Golden hour at Federation Square', status: 'active' }),
      ],
    },
  });
  await renderScreen(<Shoot />);
  await screen.findByText('Golden hour at Federation Square');
  const titles = screen.getAllByTestId('plan-row').map((r) => r.props.accessibilityLabel);
  expect(titles).toEqual(['Golden hour at Federation Square', 'Done at the pier']);
  await act(async () => await fireEvent.press(screen.getByText('Golden hour at Federation Square')));
  expect(router.push).toHaveBeenLastCalledWith(`/plan/${PLAN_ID}`);
});

test('the loaded roll shows at the top with its frame count', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi({ ...routes, 'GET /api/v2/rolls': { rolls: [roll(), roll({ id: '22222222-aaaa-4bbb-8ccc-0000000000f1', status: 'finished' })] } });
  await renderScreen(<Shoot />);
  expect(await screen.findByText('Kodak Portra 400 · frame 14 of 36')).toBeTruthy();
  expect(screen.queryByText('Load a film roll')).toBeNull();
});

test('with no roll loaded, Load a film roll opens Load a roll', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi(routes);
  await renderScreen(<Shoot />);
  await act(async () => await fireEvent.press(await screen.findByText('Load a film roll')));
  expect(router.push).toHaveBeenLastCalledWith('/roll/load');
});

test('with no place chosen it points to Explore; no plans yet shows the empty state', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi(routes);
  await renderScreen(<Shoot />);
  expect(await screen.findByText('No plans yet')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Pick a place in Explore')));
  expect(router.navigate).toHaveBeenLastCalledWith('/explore');
});

test('offline: making a plan says it needs a signal, and saved plans still show', async () => {
  mockParams.current = { placeId: PID };
  mockApi.current = fakeApi({ ...routes, 'POST /api/v2/plans': new ApiClientError('offline', 0, 'No connection to FotoAI. Check your signal and try again.') });
  await renderScreen(<Shoot />);
  await act(async () => await fireEvent.press(await screen.findByText('Make the plan')));
  expect(await screen.findByText('Making a plan needs a signal. Your saved plans still open.')).toBeTruthy();
});

test('a plans error shows the message with Retry', async () => {
  mockParams.current = {};
  mockApi.current = fakeApi({ ...routes, 'GET /api/v2/plans': new ApiClientError('upstream', 502, 'FotoAI could not load your plans') });
  await renderScreen(<Shoot />);
  expect(await screen.findByText('FotoAI could not load your plans')).toBeTruthy();
  expect(screen.getByText('Retry')).toBeTruthy();
});
