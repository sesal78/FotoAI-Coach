import type { AnalysisDto } from '@fotoai/contracts';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { photo, PHOTO_ID } from '../../test/fixtures';
import { fakeApi, renderScreen, testClient } from '../../test/harness';
import PhotoScreen from '../app/photo/[id]';
import { keys } from '../data/keys';
import { ApiClientError } from '../lib/api';

const mockParams: { current: Record<string, string> } = { current: {} };
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams.current, router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => undefined } }));

const URL_1 = 'https://sb.example/storage/v1/object/sign/fotoai-submissions/u/p.jpg?token=one';
const offline = () => new ApiClientError('offline', 0, 'No connection to FotoAI. Check your signal and try again.');
const base = (n: number, createdAt: string) => ({ id: `55555555-aaaa-4bbb-8ccc-00000000000${n}`, photoId: PHOTO_ID, createdAt });

const CRITIQUE: AnalysisDto = {
  ...base(1, '2026-11-05T03:00:00.000Z'),
  mode: 'critique',
  critique: {
    technicalScore: 81,
    compositionScore: 72,
    creativeScore: 64,
    overallScore: 74,
    technicalFeedback: 'Sharp where it matters.',
    compositionFeedback: 'The horizon cuts the frame in half.',
    creativeFeedback: 'A calm mood.',
    strengths: ['Clean exposure'],
    improvements: ['Lower the horizon'],
    suggestedSettings: 'f/8, 1/250 s, ISO 100',
  },
};

const EDITING: AnalysisDto = {
  ...base(2, '2026-11-05T04:00:00.000Z'),
  mode: 'editing',
  editing: {
    summary: 'Warm it up and lift the shadows.',
    steps: [
      { tool: 'White balance', change: '+300 K', why: 'The light was warm.' },
      { tool: 'Shadows', change: '+25', why: 'The faces are dark.' },
    ],
    filmSimulation: 'Portra 400',
  },
};

const RECREATE: AnalysisDto = {
  ...base(3, '2026-11-05T05:00:00.000Z'),
  mode: 'recreate',
  recreate: {
    estimatedSettings: { iso: '100', aperture: 'f/8', shutterSpeed: '1/250', focalLength: '35mm', meteringMode: 'Matrix' },
    lightingAnalysis: { timeOfDay: 'Golden hour', lightType: 'Sun', lightDirection: 'Side light from the left', modifiers: 'None' },
    cameraPosition: 'Low, at knee height',
    lensType: 'Wide prime',
    postProcessing: 'Warm grade',
    shotRecipe: ['Arrive 40 minutes before sunset', 'Put the sun on your left'],
    difficultyToRecreate: 'beginner',
    gearNeeded: ['A 35mm lens', 'A tripod'],
  },
};

const CHECKED = { safe: true, matchesBrief: null, genre: 'landscape', checkedAt: '2026-11-05T01:00:00.000Z' };

function routes(over: Record<string, unknown> = {}) {
  return fakeApi({
    [`GET /api/v2/photos/${PHOTO_ID}`]: { photo: photo({ check: CHECKED }) },
    [`GET /api/v2/photos/${PHOTO_ID}/url`]: { url: URL_1, expiresAt: '2026-11-05T01:05:00.000Z' },
    [`GET /api/v2/photos/${PHOTO_ID}/analyses`]: { analyses: [] },
    ...over,
  });
}

/** An answer the test lets go when it wants, to see "Working…" first. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  mockParams.current = { id: PHOTO_ID };
  onlineManager.setOnline(true);
});

afterAll(() => onlineManager.setOnline(true));

test('Critique sends mode critique and shows the scores', async () => {
  const answer = deferred<{ analysis: AnalysisDto }>();
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: () => answer.promise });
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('No results yet')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Critique' })));
  expect(await screen.findByText('Working…')).toBeTruthy();
  expect(mockApi.current.calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: `/api/v2/photos/${PHOTO_ID}/analyse`, body: { mode: 'critique' } });
  await act(async () => answer.resolve({ analysis: CRITIQUE }));
  expect(await screen.findByText('Overall 74')).toBeTruthy();
  expect(screen.getByText('Technical 81')).toBeTruthy();
  expect(screen.getByText('Composition 72')).toBeTruthy();
  expect(screen.getByText('Creative 64')).toBeTruthy();
  expect(screen.getByText('The horizon cuts the frame in half.')).toBeTruthy();
  expect(screen.getByText('• Clean exposure')).toBeTruthy();
  expect(screen.getByText('• Lower the horizon')).toBeTruthy();
  expect(screen.getByText('f/8, 1/250 s, ISO 100')).toBeTruthy();
  expect(screen.queryByText('Working…')).toBeNull();
  expect(screen.queryByText('No results yet')).toBeNull();
});

test('editing tips list their steps', async () => {
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: { analysis: EDITING } });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Editing tips' })));
  expect(mockApi.current.calls.find((c) => c.method === 'POST')?.body).toEqual({ mode: 'editing' });
  expect(await screen.findByText('1. White balance: +300 K')).toBeTruthy();
  expect(screen.getByText('The light was warm.')).toBeTruthy();
  expect(screen.getByText('2. Shadows: +25')).toBeTruthy();
  expect(screen.getByText('Film look: Portra 400')).toBeTruthy();
});

test('recreate shows the shot recipe', async () => {
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: { analysis: RECREATE } });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'How to recreate' })));
  expect(mockApi.current.calls.find((c) => c.method === 'POST')?.body).toEqual({ mode: 'recreate' });
  expect(await screen.findByText('1. Arrive 40 minutes before sunset')).toBeTruthy();
  expect(screen.getByText('2. Put the sun on your left')).toBeTruthy();
  expect(screen.getByText('ISO 100 · f/8 · 1/250 · 35mm · Matrix')).toBeTruthy();
  expect(screen.getByText('Golden hour · Sun · Side light from the left')).toBeTruthy();
  expect(screen.getByText('Low, at knee height')).toBeTruthy();
  expect(screen.getByText('• A tripod')).toBeTruthy();
});

test('saved results show newest first with no signal', async () => {
  onlineManager.setOnline(false);
  mockApi.current = routes({
    [`GET /api/v2/photos/${PHOTO_ID}`]: offline(),
    [`GET /api/v2/photos/${PHOTO_ID}/url`]: offline(),
    [`GET /api/v2/photos/${PHOTO_ID}/analyses`]: offline(),
  });
  const client = testClient();
  client.setQueryData(keys.photo(PHOTO_ID), { photo: photo({ check: CHECKED }) });
  client.setQueryData(keys.analyses(PHOTO_ID), { analyses: [RECREATE, EDITING, CRITIQUE] });
  await renderScreen(<PhotoScreen />, client);
  const titles = await screen.findAllByText(/^(Critique|Editing tips|How to recreate) · /);
  expect(titles.map((t) => String(t.props.children).split(' · ')[0])).toEqual(['How to recreate', 'Editing tips', 'Critique']);
  // The buttons need a signal; nothing is sent.
  expect(screen.getAllByText('Needs a signal')).toHaveLength(3);
  await act(async () => await fireEvent.press(screen.getAllByText('Needs a signal')[0]!));
  expect(mockApi.current.calls.some((c) => c.method === 'POST')).toBe(false);
});

test('an unsafe photo shows the server message', async () => {
  mockApi.current = routes({
    [`GET /api/v2/photos/${PHOTO_ID}`]: { photo: photo({ check: null }) },
    [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: new ApiClientError('validation', 400, 'This photo cannot be analysed'),
  });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Critique' })));
  // The badge said "Not checked yet"; now the server's answer shows.
  expect(await screen.findByText('This photo cannot be analysed')).toBeTruthy();
});

test('a photo the check found unsafe offers no buttons', async () => {
  mockApi.current = routes({ [`GET /api/v2/photos/${PHOTO_ID}`]: { photo: photo({ check: { ...CHECKED, safe: false } }) } });
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('This photo did not pass the AI check.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Critique' })).toBeNull();
});

test('a 429 shows the server message', async () => {
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: new ApiClientError('rate_limited', 429, 'Too many requests. Try again in 20 minutes.') });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Editing tips' })));
  expect(await screen.findByText('Too many requests. Try again in 20 minutes.')).toBeTruthy();
  // One tap, one call: a refused AI call is never sent again by itself.
  expect(mockApi.current.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
});

test('AI that is not configured shows the server message', async () => {
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: new ApiClientError('config', 503, 'AI is not configured') });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'How to recreate' })));
  expect(await screen.findByText('AI is not configured')).toBeTruthy();
});

test('a critique refreshes the photo and the progress (its check and XP may change)', async () => {
  mockApi.current = routes({ [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: { analysis: CRITIQUE } });
  const { client } = await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  const spy = jest.spyOn(client, 'invalidateQueries');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Critique' })));
  await screen.findByText('Overall 74');
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: keys.photo(PHOTO_ID) }));
  expect(spy).toHaveBeenCalledWith({ queryKey: keys.progress });
});

test('no answer in time reads the saved results again (the server may have finished)', async () => {
  let reads = 0;
  mockApi.current = routes({
    [`GET /api/v2/photos/${PHOTO_ID}/analyses`]: () => (++reads === 1 ? { analyses: [] } : { analyses: [CRITIQUE] }),
    [`POST /api/v2/photos/${PHOTO_ID}/analyse`]: offline(),
  });
  await renderScreen(<PhotoScreen />);
  await screen.findByText('No results yet');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Critique' })));
  expect(await screen.findByText('Overall 74')).toBeTruthy();
  expect(reads).toBe(2);
});
