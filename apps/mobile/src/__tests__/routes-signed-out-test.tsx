import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { mockState } from '../../test/router-mocks';

// One router render per file: Expo Router keeps its navigation store between renders.
jest.mock('../lib/env', () => jest.requireActual('../../test/router-mocks').fakeEnv);
jest.mock('../auth/supabase', () => ({ getSupabase: () => jest.requireActual('../../test/router-mocks').fakeSupabase() }));
jest.mock('../data/client', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  const { mockState: state } = jest.requireActual('../../test/router-mocks');
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), getApi: () => ({ request: (...a: unknown[]) => state.request(...a) }) };
});

test('signed out: a tab link shows sign-in; a wrong password gets a plain message and is never logged; signing in opens the tabs', async () => {
  mockState.signIn.mockResolvedValue({ data: { session: null }, error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
  mockState.request.mockResolvedValue({ challenge: null });

  await renderRouter('src/app', { initialUrl: '/today' });
  expect(await screen.findByText('Sign in to plan your next shoot.')).toBeTruthy();
  expect(screen).toHavePathname('/sign-in');

  const printed: unknown[] = [];
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => void printed.push(...args)),
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), 'seun@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'hunter2-secret');
  await act(async () => await fireEvent.press(screen.getByText('Sign in')));
  expect(await screen.findByText('Wrong email or password.')).toBeTruthy();
  expect(mockState.signIn).toHaveBeenCalledWith({ email: 'seun@example.com', password: 'hunter2-secret' });
  expect(printed.map(String).join('\n')).not.toContain('hunter2-secret');
  spies.forEach((s) => s.mockRestore());

  await act(async () => mockState.listener?.('SIGNED_IN', { access_token: 't' }));
  expect(await screen.findByText('No active challenge')).toBeTruthy();
});
