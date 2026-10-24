import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
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

test('signed in: the 5 tabs, the Coach button on every tab, and sign-in is out of reach', async () => {
  mockState.session = { access_token: 't' };
  const answers: Record<string, unknown> = {
    '/api/v2/me': { userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' },
    '/api/v2/me/progress': PROGRESS_FRESH,
    '/api/v2/me/preferences': PREFS_NONE,
    '/api/v2/me/spots': { spots: [] },
    // Gear already added, so the signed-in user lands on Today, not Onboarding.
    '/api/v2/me/gear': { items: [{ id: '00000000-0000-4000-8000-000000000001', kind: 'body', catalogId: 'fujifilm-x-t5', name: 'Fujifilm X-T5', capability: null }] },
    '/api/v2/challenges/active': { challenge: null },
    '/api/v2/plans': { plans: [] },
    '/api/v2/rolls': { rolls: [] },
  };
  mockState.request.mockImplementation(async (path: string) => answers[path.split('?')[0]!] ?? { challenge: null });

  await renderRouter('src/app', { initialUrl: '/' });
  expect(await screen.findByText('No active challenge')).toBeTruthy();
  expect(screen).toHavePathname('/today');
  for (const tab of ['Today', 'Explore', 'Shoot', 'Photos', 'Me']) expect(screen.getAllByText(tab).length).toBeGreaterThan(0);

  const tabs = [
    ['Explore', /Real places on a map/],
    ['Shoot', /To plan a shoot, choose a place first/],
    ['Photos', /Photo import and feedback/],
    ['Me', /Signed in as seun@example.com/],
  ] as const;
  for (const [name, text] of tabs) {
    // Press the real tab button, as on the phone.
    await act(async () => await fireEvent.press(screen.getByLabelText(new RegExp(`^${name}, tab`))));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen).toHavePathname(`/${name.toLowerCase()}`);
    expect(screen.getByLabelText('Open the coach')).toBeTruthy();
  }

  // The signed-in guard keeps the user out of the sign-in screens.
  await act(async () => router.navigate('/sign-in'));
  expect(screen).not.toHavePathname('/sign-in');
  expect(screen.queryByText('Sign in to plan your next shoot.')).toBeNull();
});
