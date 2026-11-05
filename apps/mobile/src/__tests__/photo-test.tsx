import type { PhotoListResponse } from '@fotoai/contracts';
import type { InfiniteData } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { photo, PHOTO_ID, plan, PLAN_ID, STEP_1 } from '../../test/fixtures';
import { fakeApi, renderScreen, testClient } from '../../test/harness';
import PhotoScreen from '../app/photo/[id]';
import { keys } from '../data/keys';
import { savedReads } from '../data/persist';
import { checkText } from '../ui/photos/CheckBadge';
import { ApiClientError } from '../lib/api';

const mockParams: { current: Record<string, string> } = { current: {} };
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams.current, router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => undefined } }));

const URL_1 = 'https://sb.example/storage/v1/object/sign/fotoai-submissions/u/p.jpg?token=one';
const URL_2 = 'https://sb.example/storage/v1/object/sign/fotoai-submissions/u/p.jpg?token=two';
const offline = () => new ApiClientError('offline', 0, 'No connection to FotoAI. Check your signal and try again.');

const RICOH = photo({
  cameraMake: 'RICOH',
  cameraModel: 'GR IIIx',
  lensModel: 'GR LENS 26.1mm F2.8',
  focalMm: 26.1,
  aperture: 2.8,
  shutterSeconds: 0.004,
  iso: 200,
  takenAt: '2026-11-04T07:30:00+00:00',
  takenOffset: '+11:00',
  lat: -37.81,
  lng: 144.96,
});

function routes(p = RICOH, urls: Array<string | Error> = [URL_1]) {
  let n = 0;
  return fakeApi({
    [`GET /api/v2/photos/${p.id}`]: { photo: p },
    [`GET /api/v2/photos/${p.id}/url`]: () => {
      const next = urls[Math.min(n++, urls.length - 1)]!;
      return next instanceof Error ? next : { url: next, expiresAt: '2026-11-05T01:05:00.000Z' };
    },
  });
}

beforeEach(() => {
  mockParams.current = { id: PHOTO_ID };
  (router.push as jest.Mock).mockClear();
});

test('the EXIF card shows 1/250 s and f/2.8, and the time in the photo own offset', async () => {
  mockApi.current = routes();
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('RICOH GR IIIx')).toBeTruthy();
  expect(screen.getByText('GR LENS 26.1mm F2.8')).toBeTruthy();
  expect(screen.getByText('26.1 mm · f/2.8 · 1/250 s · ISO 200')).toBeTruthy();
  expect(screen.getByText('4 Nov 2026, 18:30 (UTC+11:00)')).toBeTruthy();
  expect(screen.getByText('-37.8100, 144.9600')).toBeTruthy();
  expect(await screen.findByLabelText('Your photo')).toBeTruthy();
});

test('a photo with no camera data says so', async () => {
  mockApi.current = routes(photo());
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('No camera data')).toBeTruthy();
  expect(screen.queryByText(/f\//)).toBeNull();
});

test('a camera model that already names the make is shown once', async () => {
  mockApi.current = routes(photo({ cameraMake: 'Canon', cameraModel: 'Canon EOS R5' }));
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('Canon EOS R5')).toBeTruthy();
});

test('a linked step links to its plan, and the place is near the plan place', async () => {
  mockApi.current = routes(photo({ stepId: STEP_1, lat: -37.81, lng: 144.96 }));
  const client = testClient();
  client.setQueryData(keys.plan(PLAN_ID), { plan: plan() });
  await renderScreen(<PhotoScreen />, client);
  const step = plan().steps.find((s) => s.id === STEP_1)!;
  expect(await screen.findByText(`Near ${plan().placeName}`)).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText(`Step: ${step.title}`)));
  expect(router.push).toHaveBeenCalledWith(`/plan/${PLAN_ID}`);
});

test('the check badge says what the AI check found', async () => {
  const checked = (matchesBrief: 'yes' | 'no' | 'unclear' | null, safe = true) => ({ safe, matchesBrief, genre: 'street', checkedAt: '2026-11-05T01:00:00.000Z' });
  expect(checkText(null)).toBe('Not checked yet');
  expect(checkText(checked('yes'))).toBe('Matches the brief');
  expect(checkText(checked('no'))).toBe('Does not match the brief');
  expect(checkText(checked('unclear'))).toBe('Not sure it matches the brief');
  expect(checkText(checked(null))).toBe('Checked: street');
  expect(checkText(checked('yes', false))).toBe('This photo cannot be analysed');
  mockApi.current = routes(photo({ check: checked('no') }));
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByText('Does not match the brief')).toBeTruthy();
});

test('a signed link is never saved on the phone', async () => {
  mockApi.current = routes();
  const { client } = await renderScreen(<PhotoScreen />);
  await screen.findByLabelText('Your photo');
  const link = client.getQueryCache().find({ queryKey: keys.photoUrl(PHOTO_ID) })!;
  expect(link.state.data).toMatchObject({ url: URL_1 });
  expect(savedReads.options.dehydrateOptions!.shouldDehydrateQuery!(link)).toBe(false);
  // The photo itself (no link in it) is kept.
  expect(savedReads.options.dehydrateOptions!.shouldDehydrateQuery!(client.getQueryCache().find({ queryKey: keys.photo(PHOTO_ID) })!)).toBe(true);
});

test('a link that ran out is fetched again when the picture fails to load', async () => {
  mockApi.current = routes(RICOH, [URL_1, URL_2]);
  await renderScreen(<PhotoScreen />);
  const image = await screen.findByLabelText('Your photo');
  expect(image.props.source).toEqual([expect.objectContaining({ uri: URL_1 })]);
  await act(async () => await fireEvent(image, 'error', { nativeEvent: { error: 'HTTP 400' } }));
  await waitFor(() => expect(screen.getByLabelText('Your photo').props.source).toEqual([expect.objectContaining({ uri: URL_2 })]));
});

test('a photo from the saved list opens with no signal; the picture says it needs a signal', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/photos/${PHOTO_ID}`]: offline(), [`GET /api/v2/photos/${PHOTO_ID}/url`]: offline() });
  const client = testClient();
  client.setQueryData<InfiniteData<PhotoListResponse>>(keys.photos, { pages: [{ photos: [RICOH], nextCursor: null }], pageParams: [null] });
  await renderScreen(<PhotoScreen />, client);
  expect(await screen.findByText('RICOH GR IIIx')).toBeTruthy();
  expect(await screen.findByText('Needs a signal')).toBeTruthy();
});

test('loading, then a photo that is not mine is an error with Retry', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/photos/${PHOTO_ID}`]: new ApiClientError('not_found', 404, 'Photo not found') });
  await renderScreen(<PhotoScreen />);
  expect(screen.getByText('Loading the photo…')).toBeTruthy();
  expect(await screen.findByText('Photo not found')).toBeTruthy();
  expect(screen.getByText('Retry')).toBeTruthy();
});

test('offline with nothing saved shows the offline state', async () => {
  mockApi.current = fakeApi({ [`GET /api/v2/photos/${PHOTO_ID}`]: offline() });
  await renderScreen(<PhotoScreen />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});
