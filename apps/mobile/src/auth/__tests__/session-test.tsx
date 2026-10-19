import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { b64ToUtf8, utf8ToB64 } from '../expo-crypto-port';
import { SessionProvider, useSession, type SessionAuth } from '../session';

function fakeAuth(session: object | null) {
  let listener: ((event: string, s: object | null) => void) | null = null;
  const auth: SessionAuth = {
    getSession: jest.fn(async () => ({ data: { session }, error: null })) as never,
    onAuthStateChange: jest.fn((cb) => {
      listener = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }) as never,
    signOut: jest.fn(async () => ({ error: null })) as never,
  };
  return { auth, emit: (event: string, s: object | null) => listener?.(event, s) };
}

function Probe() {
  const { status, signOut } = useSession();
  return (
    <Text testID="status" onPress={() => void signOut()}>
      {status}
    </Text>
  );
}

test('a stored session restores signed_in at start', async () => {
  const { auth } = fakeAuth({ access_token: 't' });
  await render(<SessionProvider auth={auth}><Probe /></SessionProvider>);
  expect(await screen.findByText('signed_in')).toBeTruthy();
});

test('no stored session is signed_out, and a sign-in event switches it', async () => {
  const { auth, emit } = fakeAuth(null);
  await render(<SessionProvider auth={auth}><Probe /></SessionProvider>);
  expect(await screen.findByText('signed_out')).toBeTruthy();
  await act(async () => emit('SIGNED_IN', { access_token: 't' }));
  expect(screen.getByText('signed_in')).toBeTruthy();
});

test('sign-out clears the session and the cache', async () => {
  const { auth } = fakeAuth({ access_token: 't' });
  const onSignedOut = jest.fn();
  await render(<SessionProvider auth={auth} onSignedOut={onSignedOut}><Probe /></SessionProvider>);
  await screen.findByText('signed_in');
  await act(async () => screen.getByTestId('status').props.onPress());
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(onSignedOut).toHaveBeenCalledTimes(1);
  expect(screen.getByText('signed_out')).toBeTruthy();
});

test('a sign-out that fails still signs this phone out and clears the cache', async () => {
  const { auth } = fakeAuth({ access_token: 't' });
  (auth.signOut as jest.Mock).mockRejectedValue(new Error('offline'));
  const onSignedOut = jest.fn();
  await render(<SessionProvider auth={auth} onSignedOut={onSignedOut}><Probe /></SessionProvider>);
  await screen.findByText('signed_in');
  await act(async () => screen.getByTestId('status').props.onPress());
  expect(onSignedOut).toHaveBeenCalledTimes(1);
  expect(screen.getByText('signed_out')).toBeTruthy();
});

test('the AES text helpers round-trip non-ASCII text', () => {
  const text = JSON.stringify({ email: 'séun@example.com', note: 'café 📷' });
  expect(b64ToUtf8(utf8ToB64(text))).toBe(text);
});
