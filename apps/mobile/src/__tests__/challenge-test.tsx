import { act, fireEvent, screen } from '@testing-library/react-native';

import { challenge } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import ChallengeScreen from '../app/challenge/[id]';
import { keys } from '../data/keys';
import { ApiClientError } from '../lib/api';

const ID = '11111111-2222-4333-8444-555555555555';
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: '11111111-2222-4333-8444-555555555555' }), router: { back: jest.fn() } }));

const buttons = () => ['Accept', 'Skip', 'Complete'].filter((t) => screen.queryByText(t));

test('a pending challenge offers Accept, Skip and Complete (the server allows all three)', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/challenges/${ID}`]: { challenge: challenge({ shotList: ['Wide doorway', 'Close texture'], masteryArea: 'Side light' }) } });
  await renderScreen(<ChallengeScreen />);
  expect(await screen.findByText('Shoot five doorways in side light')).toBeTruthy();
  expect(screen.getByText(/Wide doorway/)).toBeTruthy();
  expect(screen.getByText('Side light')).toBeTruthy();
  expect(buttons()).toEqual(['Accept', 'Skip', 'Complete']);
});

test('an accepted challenge offers Skip and Complete; a completed one offers nothing', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/challenges/${ID}`]: { challenge: challenge({ status: 'accepted' }) } });
  const first = await renderScreen(<ChallengeScreen />);
  await screen.findByText('Shoot five doorways in side light');
  expect(buttons()).toEqual(['Skip', 'Complete']);
  await first.unmount();

  mockApi.current = fakeApi({ [`GET /api/v2/challenges/${ID}`]: { challenge: challenge({ status: 'completed', completedDate: '2026-10-20T09:00:00+00:00' }) } });
  await renderScreen(<ChallengeScreen />);
  expect(await screen.findByText('Completed')).toBeTruthy();
  expect(buttons()).toEqual([]);
});

test('Complete sends the PATCH and refreshes progress', async () => {
  mockApi.current = fakeApi({
    [`GET /api/v2/challenges/${ID}`]: { challenge: challenge({ status: 'accepted' }) },
    [`PATCH /api/v2/challenges/${ID}`]: { challenge: challenge({ status: 'completed' }), changed: true },
  });
  const { client } = await renderScreen(<ChallengeScreen />);
  const spy = jest.spyOn(client, 'invalidateQueries');
  await act(async () => await fireEvent.press(await screen.findByText('Complete')));
  expect(mockApi.current.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'completed' });
  expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual(expect.arrayContaining([keys.progress]));
  expect(await screen.findByText('Completed')).toBeTruthy();
});

test('a repeated move (changed: false) shows as done, not as an error', async () => {
  mockApi.current = fakeApi({
    [`GET /api/v2/challenges/${ID}`]: { challenge: challenge() },
    [`PATCH /api/v2/challenges/${ID}`]: { challenge: challenge({ status: 'accepted' }), changed: false },
  });
  await renderScreen(<ChallengeScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Accept')));
  expect(await screen.findByText('Accepted')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test("a 400 shows the server's message", async () => {
  mockApi.current = fakeApi({
    [`GET /api/v2/challenges/${ID}`]: { challenge: challenge() },
    [`PATCH /api/v2/challenges/${ID}`]: new ApiClientError('validation', 400, 'A skipped challenge cannot move to completed'),
  });
  await renderScreen(<ChallengeScreen />);
  await act(async () => await fireEvent.press(await screen.findByText('Complete')));
  expect(await screen.findByText('A skipped challenge cannot move to completed')).toBeTruthy();
});

test('loading, not found and offline states', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi({ [`GET /api/v2/challenges/${ID}`]: () => new Promise((r) => (release = r)) });
  const first = await renderScreen(<ChallengeScreen />);
  expect(await screen.findByText('Loading the challenge…')).toBeTruthy();
  await act(async () => release(new ApiClientError('not_found', 404, 'Challenge not found')));
  expect(await screen.findByText('Challenge not found')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi({ [`GET /api/v2/challenges/${ID}`]: new ApiClientError('offline', 0, 'No connection') });
  await renderScreen(<ChallengeScreen />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});
