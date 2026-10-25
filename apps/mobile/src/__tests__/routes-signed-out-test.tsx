import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { PREFS_NONE, PROGRESS_FRESH } from '../../test/fixtures';
import { mockState } from '../../test/router-mocks';

// One router render per file: Expo Router keeps its navigation store between renders.
// The first render transforms the whole app, which takes longer than Jest's 5 s default on CI.
jest.setTimeout(60_000);
jest.mock('../lib/env', () => jest.requireActual('../../test/router-mocks').fakeEnv);
jest.mock('../auth/supabase', () => ({ getSupabase: () => jest.requireActual('../../test/router-mocks').fakeSupabase() }));
jest.mock('../data/client', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  const { mockState: state } = jest.requireActual('../../test/router-mocks');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { queryClient, clearAccountData: () => queryClient.clear(), startFieldSync: () => () => undefined, getApi: () => ({ request: (...a: unknown[]) => state.request(...a) }) };
});

test('signed out: a tab link shows sign-in; a wrong password gets a plain message and is never logged; signing in opens the tabs', async () => {
  mockState.signIn.mockResolvedValue({ data: { session: null }, error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
  const answers: Record<string, unknown> = {
    '/api/v2/me': { userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' },
    '/api/v2/me/progress': PROGRESS_FRESH,
    '/api/v2/me/preferences': PREFS_NONE,
    '/api/v2/me/spots': { spots: [] },
    '/api/v2/me/gear': { items: [{ id: '00000000-0000-4000-8000-000000000001', kind: 'body', catalogId: 'fujifilm-x-t5', name: 'Fujifilm X-T5', capability: null }] },
  };
  mockState.request.mockImplementation(async (path: string) => answers[path.split('?')[0]!] ?? { challenge: null });

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
