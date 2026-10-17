// Full preferences view: GET/PUT /api/fotoai/preferences?view=full covers every
// editable column of fotoai_user_preferences. The default (no view) keeps the
// original four-field contract, which preferences-gear.test.ts still pins.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createPreferencesHandlers } from '../../lib/fotoai/handlers/preferences.ts';
import { getFotoaiFullPreferences, saveFotoaiFullPreferences } from '../../lib/fotoai/client.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

let deps: TestDeps;
let preferences: ReturnType<typeof createPreferencesHandlers>;

beforeEach(() => {
  deps = createTestDeps();
  preferences = createPreferencesHandlers(() => deps);
});

const aliceCookie = cookieFor(TOKEN_ALICE);
const fullUrl = '/api/fotoai/preferences?view=full';
const T = 'fotoai_user_preferences';

const FULL_KEYS = [
  'adaptToCalendar', 'adaptToWeather', 'avoidsStyles', 'currentLocation', 'eveningPhotography', 'homeLocation',
  'lunchBreakPhotography', 'lunchEndTime', 'lunchStartTime', 'officeLocation', 'photographyInterests',
  'primaryPhotoDay', 'secondaryPhotoDays', 'skillLevel', 'wfhFlexibility', 'workDays', 'workEndTime', 'workStartTime',
];

function fullInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    skillLevel: 'advanced',
    photographyInterests: ['street'],
    homeLocation: 'Melbourne',
    currentLocation: null,
    avoidsStyles: ['selfies', 'flash'],
    workDays: ['Tuesday', 'Mon', 'Mon', 'Wed'],
    workStartTime: '08:30',
    workEndTime: '16:45',
    lunchStartTime: '12:15',
    lunchEndTime: '13:00',
    primaryPhotoDay: 'Sun',
    secondaryPhotoDays: ['Saturday', 'Fri'],
    lunchBreakPhotography: false,
    eveningPhotography: true,
    wfhFlexibility: false,
    adaptToWeather: true,
    adaptToCalendar: false,
    officeLocation: '  Collins St  ',
    ...overrides,
  };
}

async function put(body: unknown, url = fullUrl): Promise<Response> {
  return preferences.put(jsonRequest(url, body, { method: 'PUT', cookie: aliceCookie }));
}

test('preferences full: GET and PUT need a session (401)', async () => {
  for (const pending of [
    preferences.get(request(fullUrl)),
    preferences.put(jsonRequest(fullUrl, fullInput(), { method: 'PUT' })),
  ]) {
    const response = await pending;
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'unauthenticated');
  }
});

test('preferences full: a sent owner id in query or body is 400 and writes nothing', async () => {
  for (const key of ['userId', 'user_id', 'ownerId']) {
    const responses = await Promise.all([
      preferences.get(request(`${fullUrl}&${key}=${BOB}`, { cookie: aliceCookie })),
      preferences.put(jsonRequest(`${fullUrl}&${key}=${BOB}`, fullInput(), { method: 'PUT', cookie: aliceCookie })),
      put(fullInput({ [key]: BOB })),
    ]);
    for (const response of responses) assert.equal(response.status, 400, key);
  }
  assert.equal((deps.client.tables.get(T) ?? []).length, 0);
});

test('preferences full: an unknown or repeated view value is 400', async () => {
  for (const url of ['/api/fotoai/preferences?view=all', '/api/fotoai/preferences?view=', '/api/fotoai/preferences?view=full&view=full']) {
    assert.equal((await preferences.get(request(url, { cookie: aliceCookie }))).status, 400, url);
    assert.equal((await put({ skillLevel: 'advanced' }, url)).status, 400, url);
  }
});

test('preferences full: no row yet returns the legacy register defaults for every field', async () => {
  const response = await preferences.get(request(fullUrl, { cookie: aliceCookie }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).preferences, {
    skillLevel: 'intermediate',
    photographyInterests: [],
    homeLocation: null,
    currentLocation: null,
    avoidsStyles: [],
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    workStartTime: '09:00',
    workEndTime: '17:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    primaryPhotoDay: 'Saturday',
    secondaryPhotoDays: ['Sunday'],
    lunchBreakPhotography: true,
    eveningPhotography: true,
    wfhFlexibility: true,
    adaptToWeather: true,
    adaptToCalendar: true,
    officeLocation: null,
  });
});

test('preferences full: PUT saves every column on the caller row, normalizes days, and GET reads it back', async () => {
  const response = await put(fullInput());
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const expected = {
    skillLevel: 'advanced',
    photographyInterests: ['street'],
    homeLocation: 'Melbourne',
    currentLocation: null,
    avoidsStyles: ['selfies', 'flash'],
    workDays: ['Mon', 'Tue', 'Wed'],
    workStartTime: '08:30',
    workEndTime: '16:45',
    lunchStartTime: '12:15',
    lunchEndTime: '13:00',
    primaryPhotoDay: 'Sunday',
    secondaryPhotoDays: ['Friday', 'Saturday'],
    lunchBreakPhotography: false,
    eveningPhotography: true,
    wfhFlexibility: false,
    adaptToWeather: true,
    adaptToCalendar: false,
    officeLocation: 'Collins St',
  };
  assert.deepEqual((await response.json()).preferences, expected);

  const rows = deps.client.tables.get(T)!;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, ALICE);
  assert.deepEqual(rows[0].work_days, ['Mon', 'Tue', 'Wed']);
  assert.deepEqual(rows[0].secondary_photo_days, ['Friday', 'Saturday']);
  assert.equal(rows[0].primary_photo_day, 'Sunday');
  assert.equal(rows[0].lunch_break_photography, false);
  assert.equal(rows[0].office_location, 'Collins St');
  assert.equal(typeof rows[0].updated_at, 'string');
  assert.ok(!Object.keys(rows[0]).some((key) => /[A-Z]/.test(key)), 'only snake_case columns are written');

  const read = await preferences.get(request(fullUrl, { cookie: aliceCookie }));
  const payload = await read.json();
  assert.deepEqual(Object.keys(payload.preferences).sort(), FULL_KEYS);
  assert.deepEqual(payload.preferences, expected);
});

test('preferences full: a partial PUT changes only the sent fields; another user row is untouched and unseen', async () => {
  deps.client.seed(T, { user_id: BOB, skill_level: 'professional', office_location: 'Private Bob Office', work_days: ['Sat'] });
  assert.equal((await put(fullInput())).status, 200);
  const response = await put({ eveningPhotography: false, officeLocation: null, workDays: [] });
  assert.equal(response.status, 200);
  const prefs = (await response.json()).preferences;
  assert.equal(prefs.eveningPhotography, false);
  assert.equal(prefs.officeLocation, null);
  assert.deepEqual(prefs.workDays, []);
  assert.equal(prefs.workStartTime, '08:30');
  assert.equal(prefs.skillLevel, 'advanced');

  const bob = deps.client.tables.get(T)!.find((row) => row.user_id === BOB)!;
  assert.equal(bob.office_location, 'Private Bob Office');
  assert.deepEqual(bob.work_days, ['Sat']);
  const read = await (await preferences.get(request(fullUrl, { cookie: aliceCookie }))).json();
  assert.doesNotMatch(JSON.stringify(read), /Private Bob|user_id|legacy_appwrite/i);
});

test('preferences full: exact maxima pass', async () => {
  const styles = Array.from({ length: 20 }, (_, index) => `${String(index).padStart(2, '0')}${'s'.repeat(38)}`);
  const response = await put({
    avoidsStyles: styles,
    workDays: ['Sun', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon'],
    secondaryPhotoDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    officeLocation: 'o'.repeat(120),
    workStartTime: '00:00',
    workEndTime: '23:59',
  });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const prefs = (await response.json()).preferences;
  assert.deepEqual(prefs.avoidsStyles, styles);
  assert.deepEqual(prefs.workDays, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(prefs.secondaryPhotoDays.length, 7);
  assert.equal(prefs.officeLocation, 'o'.repeat(120));
});

test('preferences full: invalid days, times, booleans, lengths, and unknown fields are 400 and write nothing', async () => {
  const invalid: Array<Record<string, unknown>> = [
    { workDays: ['Funday'] },
    { workDays: ['mon'] },
    { workDays: 'Mon' },
    { workDays: null },
    { workDays: [1] },
    { workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'] },
    { secondaryPhotoDays: ['Someday'] },
    { secondaryPhotoDays: 'Sunday' },
    { primaryPhotoDay: null },
    { primaryPhotoDay: 'Caturday' },
    { primaryPhotoDay: ['Saturday'] },
    { workStartTime: '9:00' },
    { workStartTime: '24:00' },
    { workEndTime: '12:60' },
    { lunchStartTime: '12:00:00' },
    { lunchEndTime: 1300 },
    { lunchEndTime: null },
    { lunchBreakPhotography: 'true' },
    { eveningPhotography: 1 },
    { wfhFlexibility: null },
    { adaptToWeather: [] },
    { adaptToCalendar: {} },
    { officeLocation: 'x'.repeat(121) },
    { officeLocation: 5 },
    { avoidsStyles: Array.from({ length: 21 }, (_, index) => `style-${index}`) },
    { avoidsStyles: [''] },
    { avoidsStyles: ['x'.repeat(41)] },
    { avoidsStyles: null },
    { legacyAppwriteId: 'x' },
    { legacy_appwrite_id: 'x' },
    { work_days: ['Mon'] },
    { createdAt: '2026-01-01' },
  ];
  for (const body of invalid) {
    const response = await put(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).code, 'validation');
  }
  assert.equal((deps.client.tables.get(T) ?? []).length, 0);
});

test('preferences full: without ?view=full the endpoint keeps the four-field contract', async () => {
  assert.equal((await put(fullInput())).status, 200);
  const basic = await preferences.get(request('/api/fotoai/preferences', { cookie: aliceCookie }));
  assert.deepEqual(Object.keys((await basic.json()).preferences).sort(), ['currentLocation', 'homeLocation', 'photographyInterests', 'skillLevel']);
  const rejected = await put({ workDays: ['Mon'] }, '/api/fotoai/preferences');
  assert.equal(rejected.status, 400);
  const accepted = await put({ skillLevel: 'beginner' }, '/api/fotoai/preferences');
  assert.deepEqual(Object.keys((await accepted.json()).preferences).sort(), ['currentLocation', 'homeLocation', 'photographyInterests', 'skillLevel']);
  // The basic save does not reset the schedule columns.
  assert.deepEqual(deps.client.tables.get(T)![0].work_days, ['Mon', 'Tue', 'Wed']);
});

test('preferences full: malformed stored values map to safe defaults and never leak extra columns', async () => {
  deps.client.seed(T, {
    user_id: ALICE,
    legacy_appwrite_id: 'must-not-leak',
    avoids_styles: ['ok', 7, '', 'x'.repeat(41)],
    work_days: ['Mon', 'bogus', 'Friday'],
    work_start_time: '9am',
    work_end_time: null,
    primary_photo_day: 'Caturday',
    secondary_photo_days: 'Sunday',
    lunch_break_photography: 'yes',
    evening_photography: false,
    office_location: 'x'.repeat(121),
  });
  const payload = await (await preferences.get(request(fullUrl, { cookie: aliceCookie }))).json();
  assert.deepEqual(Object.keys(payload.preferences).sort(), FULL_KEYS);
  const prefs = payload.preferences;
  assert.deepEqual(prefs.avoidsStyles, ['ok']);
  assert.deepEqual(prefs.workDays, ['Mon', 'Fri']);
  assert.equal(prefs.workStartTime, '09:00');
  assert.equal(prefs.workEndTime, '17:00');
  assert.equal(prefs.primaryPhotoDay, 'Saturday');
  assert.deepEqual(prefs.secondaryPhotoDays, ['Sunday']);
  assert.equal(prefs.lunchBreakPhotography, true);
  assert.equal(prefs.eveningPhotography, false);
  assert.equal(prefs.officeLocation, null);
  assert.doesNotMatch(JSON.stringify(payload), /must-not-leak|user_id/);
});

test('preferences full client: calls ?view=full with no owner id and maps malformed values to defaults', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (init?.method === 'PUT') return Response.json({ preferences: JSON.parse(String(init.body)) });
    return Response.json({ preferences: { workDays: ['Mon', 'Nope'], primaryPhotoDay: 'Caturday', lunchBreakPhotography: 'no', workStartTime: 'x', avoidsStyles: null } });
  };
  const loaded = await getFotoaiFullPreferences(fetcher);
  assert.deepEqual(loaded.workDays, ['Mon']);
  assert.equal(loaded.primaryPhotoDay, 'Saturday');
  assert.equal(loaded.lunchBreakPhotography, true);
  assert.equal(loaded.workStartTime, '09:00');
  assert.deepEqual(loaded.avoidsStyles, []);
  assert.deepEqual(loaded.secondaryPhotoDays, ['Sunday']);

  const saved = await saveFotoaiFullPreferences({ workDays: ['Tue'], eveningPhotography: false }, fetcher);
  assert.deepEqual(saved.workDays, ['Tue']);
  assert.equal(saved.eveningPhotography, false);
  assert.deepEqual(calls.map((call) => [call.url, call.init?.method ?? 'GET']), [
    ['/api/fotoai/preferences?view=full', 'GET'],
    ['/api/fotoai/preferences?view=full', 'PUT'],
  ]);
  assert.ok(calls.every((call) => !/userId|user_id|ownerId/.test(`${call.url}${String(call.init?.body ?? '')}`)));
});
