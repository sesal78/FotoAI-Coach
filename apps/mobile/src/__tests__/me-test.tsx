import type { ProgressResponse, SkillDto } from '@fotoai/contracts';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PROGRESS_FRESH } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import Me from '../app/(tabs)/me';
import Skills from '../app/me/skills';
import { ApiClientError } from '../lib/api';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current, clearAccountData: () => undefined }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../auth/session', () => ({ useSession: () => ({ signOut: async () => undefined }) }));

const skill = (over: Partial<SkillDto>): SkillDto => ({
  id: 'exposure_triangle',
  name: 'Exposure Triangle',
  category: 'technical',
  description: 'ISO, aperture and shutter speed',
  prerequisites: [],
  tier: 1,
  icon: 'Triangle',
  xpToLearn: 100,
  xpToPractice: 500,
  xpToMaster: 2000,
  currentXP: 0,
  status: 'available',
  ...over,
});

const PROGRESS: ProgressResponse = {
  xp: { total: 650, level: 3, levelStart: 400, nextLevelAt: 900, progress: 50 },
  streak: { current: 3, longest: 5, lastCompletionDate: '2026-10-19T08:00:00+00:00' },
  challenges: { completed: 4, issued: 7 },
  skills: [
    skill({ currentXP: 250, status: 'learned' }),
    skill({ id: 'rule_of_thirds', name: 'Rule of Thirds', category: 'composition', currentXP: 40 }),
    skill({ id: 'raw_editing', name: 'RAW Editing', category: 'post_processing', status: 'locked', prerequisites: ['exposure_triangle'] }),
  ],
};

const routes = (progress: unknown = PROGRESS) => ({
  'GET /api/v2/me': { userId: '11111111-2222-4333-8444-555555555555', email: 'seun@example.com' },
  'GET /api/v2/me/progress': progress,
});

test('a fresh user shows level 1, an empty bar and no streak', async () => {
  mockApi.current = fakeApi(routes(PROGRESS_FRESH));
  await renderScreen(<Me />);
  expect(await screen.findByText('Level 1')).toBeTruthy();
  expect(screen.getByText('0 of 100 XP to level 2')).toBeTruthy();
  expect(screen.getByText('No streak yet')).toBeTruthy();
  expect(screen.getByText('0 of 0 challenges done')).toBeTruthy();
});

test("the bar's label reads the XP numbers; streak and challenges show", async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Me />);
  const bar = await screen.findByRole('progressbar');
  expect(bar.props.accessibilityLabel).toBe('Level 3: 250 of 500 XP to level 4');
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 500, now: 250 });
  expect(screen.getByText('3-day streak · best 5')).toBeTruthy();
  expect(screen.getByText('4 of 7 challenges done')).toBeTruthy();
});

test('Me links to skills, gear, loadout and settings', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Me />);
  for (const [label, path] of [['Skills', '/me/skills'], ['My gear', '/me/gear'], ['Loadout', '/me/loadout'], ['Settings', '/me/settings']] as const) {
    await act(async () => await fireEvent.press(await screen.findByText(label)));
    expect(router.push).toHaveBeenLastCalledWith(path);
  }
});

test('skills are grouped by category with their status and the XP to the next one', async () => {
  mockApi.current = fakeApi(routes());
  await renderScreen(<Skills />);
  expect(await screen.findByText('Technical')).toBeTruthy();
  expect(screen.getByText('Composition')).toBeTruthy();
  expect(screen.getByText('Post-processing')).toBeTruthy();
  expect(screen.getByText('Learned · 250 XP to practised')).toBeTruthy();
  expect(screen.getByText('Available · 60 XP to learned')).toBeTruthy();
  expect(screen.getByText('Locked')).toBeTruthy();
});

test('loading, error and offline states', async () => {
  let release: (v: unknown) => void = () => undefined;
  mockApi.current = fakeApi({ ...routes(), 'GET /api/v2/me/progress': () => new Promise((r) => (release = r)) });
  const first = await renderScreen(<Me />);
  expect(screen.getByText('Loading your progress…')).toBeTruthy();
  await act(async () => release(PROGRESS));
  expect(await screen.findByText('Level 3')).toBeTruthy();
  await first.unmount();

  mockApi.current = fakeApi({ ...routes(), 'GET /api/v2/me/progress': new ApiClientError('upstream', 502, 'Could not load your progress') });
  const second = await renderScreen(<Skills />);
  expect(await screen.findByText('Could not load your progress')).toBeTruthy();
  await second.unmount();

  mockApi.current = fakeApi({ ...routes(), 'GET /api/v2/me/progress': new ApiClientError('offline', 0, 'No connection') });
  await renderScreen(<Me />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});
