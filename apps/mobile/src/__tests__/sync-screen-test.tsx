import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { PREFS_NONE } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Settings from '../app/me/settings';
import SyncScreen from '../app/me/sync';
import { outbox, setFieldOwner, setKick } from '../data/field';
import { WaitingBadge } from '../ui/shoot/WaitingBadge';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('../auth/session', () => ({ useSession: () => ({ signOut: mockSignOut }) }));
const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockStore.get(k) ?? null, setItem: async (k: string, v: string) => void mockStore.set(k, v) },
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: async () => null,
}));

const frame = (n: number) => ({ kind: 'frame' as const, method: 'POST' as const, path: '/api/v2/rolls/r1/frames', body: { id: `f${n}`, frameNo: n }, key: `frame:f${n}` });
const kick = jest.fn();

beforeEach(async () => {
  setFieldOwner(OWNER);
  setKick(kick);
  kick.mockClear();
  mockSignOut.mockClear();
  for (const item of await outbox.list(OWNER)) await outbox.remove(item.id);
});

test('the badge counts waiting changes and opens the list', async () => {
  mockApi.current = fakeApi({});
  const first = await renderScreen(<WaitingBadge />);
  expect(screen.queryByText(/waiting/)).toBeNull();
  await first.unmount();
  await outbox.enqueue(OWNER, frame(1));
  await outbox.enqueue(OWNER, frame(2));
  await renderScreen(<WaitingBadge />);
  await act(async () => await fireEvent.press(await screen.findByText('2 changes waiting to send')));
  expect(router.push).toHaveBeenLastCalledWith('/me/sync');
});

test('the list shows what waits and what needs attention; Send now and Try again start a send', async () => {
  mockApi.current = fakeApi({});
  await outbox.enqueue(OWNER, frame(14));
  const refused = await outbox.enqueue(OWNER, frame(40));
  await outbox.markAttention(refused.id, 'Frame 40 is past the end of a 36-exposure roll');
  await renderScreen(<SyncScreen />);
  expect(await screen.findByText('1 change waiting to send')).toBeTruthy();
  expect(screen.getByText('Frame 40')).toBeTruthy();
  expect(screen.getByText('Frame 40 is past the end of a 36-exposure roll')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Send now')));
  expect(kick).toHaveBeenCalledTimes(1);
  await act(async () => await fireEvent.press(screen.getByText('Try again')));
  await waitFor(async () => expect((await outbox.list(OWNER)).every((i) => i.state === 'waiting')).toBe(true));
  expect(kick).toHaveBeenCalledTimes(2);
});

test('Remove asks first, and only removes on yes', async () => {
  mockApi.current = fakeApi({});
  const refused = await outbox.enqueue(OWNER, frame(40));
  await outbox.markAttention(refused.id, 'Frame 40 is past the end of a 36-exposure roll');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await renderScreen(<SyncScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Remove')));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(await outbox.list(OWNER)).toHaveLength(1);
  await act(async () => alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!.onPress!());
  await waitFor(async () => expect(await outbox.list(OWNER)).toEqual([]));
  alert.mockRestore();
});

test('sign-out with changes waiting asks first, and keeps them when the user signs out anyway', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': PREFS_NONE });
  await outbox.enqueue(OWNER, frame(14));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await renderScreen(<Settings />);
  await screen.findByText('1 change waiting to send');
  await act(async () => await fireEvent.press(screen.getByText('Sign out')));
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(alert.mock.calls[0]![0]).toBe('1 change is not sent yet');
  await act(async () => alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!.onPress!());
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(await outbox.list(OWNER)).toHaveLength(1);
  alert.mockRestore();
});
