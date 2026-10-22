import type { GearItem } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { PREFS_NONE } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Onboarding from '../app/onboarding';
import { OnboardingGate } from '../ui/OnboardingGate';

const ME = { userId: '11111111-2222-4333-8444-555555555555', email: 'new@example.com' };
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => mockStore.get(k) ?? null,
    setItemSync: (k: string, v: string) => void mockStore.set(k, v),
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { router: { replace: jest.fn(), push: jest.fn() }, Redirect: ({ href }: { href: string }) => <RNText>{`redirect:${href}`}</RNText> };
});
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestForegroundPermissionsAsync: async () => ({ granted: true, canAskAgain: false }),
  getLastKnownPositionAsync: async () => ({ coords: { latitude: -37.77, longitude: 144.96 } }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: -37.77, longitude: 144.96 } }),
}));

const XT5_ITEM: GearItem = { id: '00000000-0000-4000-8000-000000000001', kind: 'body', catalogId: 'fujifilm-x-t5', name: 'Fujifilm X-T5', capability: null };
const CATALOG = {
  bodies: [{ id: 'fujifilm-x-t5', make: 'Fujifilm', model: 'X-T5', type: 'digital', mount: 'fujifilm-x', modes: ['M'], shutter: { slowestSeconds: 900, fastestSeconds: 0.000125, bulb: true }, flashSyncSeconds: null, iso: { min: 125, max: 12800 }, metering: null, fixedLensId: null, sources: [] }],
  lenses: [],
};

beforeEach(() => mockStore.clear());

const gate = () => renderScreen(<><OnboardingGate /><Text>Today screen</Text></>);

test('a user with no gear sees onboarding once', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me': ME, 'GET /api/v2/me/gear': { items: [] } });
  const first = await gate();
  expect(await screen.findByText('redirect:/onboarding')).toBeTruthy();
  await first.unmount();

  mockStore.set(`fotoai.onboarding.v1.${ME.userId}`, 'done');
  await gate();
  await screen.findByText('Today screen');
  await waitFor(() => expect(mockApi.current!.calls.length).toBeGreaterThan(0));
  expect(screen.queryByText(/redirect:/)).toBeNull();
});

test('a user with gear goes straight to Today', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me': ME, 'GET /api/v2/me/gear': { items: [XT5_ITEM] } });
  await gate();
  await waitFor(() => expect(mockApi.current!.calls.some((c) => c.path === '/api/v2/me/gear')).toBe(true));
  expect(screen.queryByText(/redirect:/)).toBeNull();
});

test('one tap adds gear; skip goes to Today and does not come back', async () => {
  let mine: GearItem[] = [];
  mockApi.current = fakeApi({
    'GET /api/v2/me': ME,
    'GET /api/v2/gear/catalog': CATALOG,
    'GET /api/v2/me/gear': () => ({ items: mine }),
    'POST /api/v2/me/gear': () => {
      mine = [XT5_ITEM];
      return { item: XT5_ITEM };
    },
    'GET /api/v2/me/preferences': PREFS_NONE,
  });
  await renderScreen(<Onboarding />);
  await act(async () => await fireEvent.press(await screen.findByLabelText('Add Fujifilm X-T5')));
  expect(await screen.findByLabelText('Fujifilm X-T5 is in your gear')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Next')));
  await act(async () => await fireEvent.press(await screen.findByText('Skip for now')));
  expect(router.replace).toHaveBeenCalledWith('/today');
  expect(mockStore.get(`fotoai.onboarding.v1.${ME.userId}`)).toBe('done');
});

test('the home step saves the phone location as the home area', async () => {
  mockApi.current = fakeApi({
    'GET /api/v2/me': ME,
    'GET /api/v2/gear/catalog': CATALOG,
    'GET /api/v2/me/gear': { items: [] },
    'GET /api/v2/me/preferences': PREFS_NONE,
    'PATCH /api/v2/me/preferences': (b: unknown) => ({ ...PREFS_NONE, ...(b as object) }),
  });
  await renderScreen(<Onboarding />);
  await act(async () => await fireEvent.press(await screen.findByText('Next')));
  await act(async () => await fireEvent.press(await screen.findByText('Use my location')));
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ home: { lat: -37.77, lng: 144.96, label: null } }));
  expect(router.replace).toHaveBeenCalledWith('/today');
});
