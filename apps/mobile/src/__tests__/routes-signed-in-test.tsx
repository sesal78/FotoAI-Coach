import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import { mockState } from '../../test/router-mocks';

// One router render per file: Expo Router keeps its navigation store between renders.
// The first render transforms the whole app, which takes longer than Jest's 5 s default on CI.
jest.setTimeout(60_000);
jest.mock('../lib/env', () => jest.requireActual('../../test/router-mocks').fakeEnv);
jest.mock('../auth/supabase', () => ({ getSupabase: () => jest.requireActual('../../test/router-mocks').fakeSupabase() }));
jest.mock('../data/client', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  const { mockState: state } = jest.requireActual('../../test/router-mocks');
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), getApi: () => ({ request: (...a: unknown[]) => state.request(...a) }) };
});

test('signed in: the 5 tabs, the Coach button on every tab, and sign-in is out of reach', async () => {
  mockState.session = { access_token: 't' };
  mockState.request.mockImplementation(async (path: string) =>
    path === '/api/v2/me' ? { userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' } : { challenge: null },
  );

  await renderRouter('src/app', { initialUrl: '/' });
  expect(await screen.findByText('No active challenge')).toBeTruthy();
  expect(screen).toHavePathname('/today');
  for (const tab of ['Today', 'Explore', 'Shoot', 'Photos', 'Me']) expect(screen.getAllByText(tab).length).toBeGreaterThan(0);

  const tabs = [
    ['Explore', /Real places on a map/],
    ['Shoot', /Shoot plans and the film log/],
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
