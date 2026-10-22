import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PREFS_HOME, PREFS_NONE } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Settings from '../app/me/settings';
import { ApiClientError } from '../lib/api';
import { useTheme } from '../ui/ThemeProvider';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('../auth/session', () => ({ useSession: () => ({ signOut: mockSignOut }) }));
const mockLocation = { granted: true, canAskAgain: true };
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ granted: mockLocation.granted, canAskAgain: mockLocation.canAskAgain }),
  requestForegroundPermissionsAsync: async () => ({ granted: mockLocation.granted, canAskAgain: false }),
  getLastKnownPositionAsync: async () => ({ coords: { latitude: -37.8001, longitude: 144.9701 } }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: -37.8001, longitude: 144.9701 } }),
}));

function ThemeName() {
  return <Text testID="theme">{useTheme().setting}</Text>;
}

const press = async (name: string) => act(async () => await fireEvent.press(await screen.findByRole('radio', { name })));

beforeEach(() => Object.assign(mockLocation, { granted: true, canAskAgain: true }));

test('a theme change shows at once and is saved to the account', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE, 'PATCH /api/v2/me/preferences': (b: unknown) => ({ ...PREFS_NONE, ...(b as object) }) });
  await renderScreen(<><Settings /><ThemeName /></>);
  await press('Camera body');
  expect(screen.getByTestId('theme').props.children).toBe('camera');
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ theme: 'camera' }));
});

test('a failed theme save keeps the choice and offers Retry', async () => {
  let fail = true;
  mockApi.current = fakeApi({
    'GET /api/v2/me/preferences': PREFS_NONE,
    'PATCH /api/v2/me/preferences': (b: unknown) => (fail ? new ApiClientError('offline', 0, 'No connection') : { ...PREFS_NONE, ...(b as object) }),
  });
  await renderScreen(<><Settings /><ThemeName /></>);
  await press('Golden dark');
  expect(await screen.findByText('Not saved to your account')).toBeTruthy();
  expect(screen.getByTestId('theme').props.children).toBe('golden_dark');
  fail = false;
  await act(async () => await fireEvent.press(screen.getByText('Retry')));
  await waitFor(() => expect(screen.queryByText('Not saved to your account')).toBeNull());
  expect(mockApi.current.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ theme: 'golden_dark' }, { theme: 'golden_dark' }]);
});

test('units are saved to the account', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE, 'PATCH /api/v2/me/preferences': (b: unknown) => ({ ...PREFS_NONE, ...(b as object) }) });
  await renderScreen(<Settings />);
  await press('Imperial (°F, mph)');
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ units: 'imperial' }));
});

test('Use my location saves lat, lng and the label', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE, 'PATCH /api/v2/me/preferences': (b: unknown) => ({ ...PREFS_NONE, ...(b as object) }) });
  await renderScreen(<Settings />);
  await act(async () => await fireEvent.press(await screen.findByText('Use my location')));
  await act(async () => await fireEvent.changeText(await screen.findByLabelText('Home area name'), 'Brunswick'));
  await act(async () => await fireEvent.press(screen.getByText('Save home area')));
  await waitFor(() =>
    expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ home: { lat: -37.8, lng: 144.97, label: 'Brunswick' } }),
  );
});

test('a refused location permission shows how to allow it', async () => {
  Object.assign(mockLocation, { granted: false, canAskAgain: false });
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE });
  await renderScreen(<Settings />);
  await act(async () => await fireEvent.press(await screen.findByText('Use my location')));
  expect(await screen.findByText(/Allow location for FotoAI in Android Settings/)).toBeTruthy();
});

test('Clear removes the home area', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_HOME, 'PATCH /api/v2/me/preferences': { ...PREFS_HOME, home: null } });
  await renderScreen(<Settings />);
  expect(await screen.findByText(/Fitzroy/)).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Clear')));
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ home: null }));
});

test('sign out signs out (the session then clears the cache and saved reads)', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE });
  await renderScreen(<Settings />);
  await act(async () => await fireEvent.press(await screen.findByText('Sign out')));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
