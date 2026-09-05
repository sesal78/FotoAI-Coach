import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createFotoaiSupabaseClient } from '../../lib/fotoai/supabase-http.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, TEST_ENV, type TestDeps } from './helpers/deps.ts';

type Handler = (request: Request, context?: { params: { id: string } }) => Promise<Response>;
type PreferencesHandlers = { get: Handler; put: Handler };
type GearHandlers = { list: Handler; create: Handler; remove: Handler };

let deps: TestDeps;
let preferences: PreferencesHandlers;
let gear: GearHandlers;

beforeEach(async () => {
  deps = createTestDeps();
  const provider = () => deps;
  const preferencesModule = await import('../../lib/fotoai/handlers/preferences.ts');
  const gearModule = await import('../../lib/fotoai/handlers/gear.ts');
  preferences = preferencesModule.createPreferencesHandlers(provider);
  gear = gearModule.createGearHandlers(provider);
});

async function body(response: Response): Promise<any> {
  return response.json();
}

const aliceCookie = cookieFor(TOKEN_ALICE);
const preferenceUrl = '/api/fotoai/preferences';
const gearUrl = '/api/fotoai/gear';

function validPreferences(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    skillLevel: 'advanced',
    photographyInterests: ['street', 'portrait'],
    homeLocation: 'Melbourne',
    currentLocation: 'CBD',
    ...overrides,
  };
}

function validGear(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { category: 'camera', brand: 'Fujifilm', model: 'X-T5', ...overrides };
}

test('preferences and gear: every route returns 401 without a session', async () => {
  const cases: Array<[string, Promise<Response>]> = [
    ['preferences get', preferences.get(request(preferenceUrl))],
    ['preferences put', preferences.put(jsonRequest(preferenceUrl, validPreferences(), { method: 'PUT' }))],
    ['gear list', gear.list(request(gearUrl))],
    ['gear create', gear.create(jsonRequest(gearUrl, validGear()))],
    ['gear delete', gear.remove(request(`${gearUrl}/${ALICE}`, { method: 'DELETE' }), { params: { id: ALICE } })],
  ];
  for (const [label, pending] of cases) {
    const response = await pending;
    assert.equal(response.status, 401, label);
    assert.equal((await body(response)).code, 'unauthenticated', label);
  }
});

test('preferences and gear: every owner alias is 400 in each accepted input channel', async () => {
  for (const key of ['userId', 'user_id', 'userid', 'ownerId', 'owner_id']) {
    const cases = [
      preferences.get(request(`${preferenceUrl}?${key}=${BOB}`, { cookie: aliceCookie })),
      preferences.put(jsonRequest(`${preferenceUrl}?${key}=${BOB}`, validPreferences(), { method: 'PUT', cookie: aliceCookie })),
      preferences.put(jsonRequest(preferenceUrl, validPreferences({ [key]: BOB }), { method: 'PUT', cookie: aliceCookie })),
      gear.list(request(`${gearUrl}?${key}=${BOB}`, { cookie: aliceCookie })),
      gear.create(jsonRequest(`${gearUrl}?${key}=${BOB}`, validGear(), { cookie: aliceCookie })),
      gear.create(jsonRequest(gearUrl, validGear({ [key]: BOB }), { cookie: aliceCookie })),
      gear.remove(request(`${gearUrl}/${ALICE}?${key}=${BOB}`, { method: 'DELETE', cookie: aliceCookie }), { params: { id: ALICE } }),
    ];
    for (const response of await Promise.all(cases)) {
      assert.equal(response.status, 400, `${key} must be rejected`);
      assert.equal((await body(response)).code, 'validation');
    }
  }
});

test('preferences: caller gets only its four-field DTO or safe defaults', async () => {
  deps.client.seed('fotoai_user_preferences', {
    user_id: BOB,
    skill_level: 'professional',
    photography_interests: ['private-bob-interest'],
    home_location: 'Private Bob Home',
    current_location: 'Private Bob Current',
  });
  deps.client.seed('fotoai_user_preferences', {
    user_id: ALICE,
    skill_level: null,
    photography_interests: null,
    home_location: 42,
    current_location: null,
    legacy_appwrite_id: 'must-not-leak',
  });

  const response = await preferences.get(request(preferenceUrl, { cookie: aliceCookie }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.deepEqual(payload, {
    preferences: {
      skillLevel: 'intermediate',
      photographyInterests: [],
      homeLocation: null,
      currentLocation: null,
    },
  });
  assert.doesNotMatch(JSON.stringify(payload), /private-bob|user_id|legacy_appwrite/i);
});

test('preferences: repeated saves merge one owner row and set updated_at each time', async () => {
  const first = await preferences.put(jsonRequest(preferenceUrl, validPreferences(), { method: 'PUT', cookie: aliceCookie }));
  assert.equal(first.status, 200, JSON.stringify(await first.clone().json()));
  const firstUpdatedAt = deps.client.tables.get('fotoai_user_preferences')![0].updated_at;

  const second = await preferences.put(jsonRequest(preferenceUrl, {
    skillLevel: 'professional',
    photographyInterests: ['night'],
    homeLocation: 'Sydney',
    currentLocation: null,
  }, { method: 'PUT', cookie: aliceCookie }));
  assert.equal(second.status, 200, JSON.stringify(await second.clone().json()));

  const rows = (deps.client.tables.get('fotoai_user_preferences') ?? []).filter((row) => row.user_id === ALICE);
  assert.equal(rows.length, 1);
  assert.deepEqual(await body(second), {
    preferences: {
      skillLevel: 'professional',
      photographyInterests: ['night'],
      homeLocation: 'Sydney',
      currentLocation: null,
    },
  });
  assert.equal(typeof firstUpdatedAt, 'string');
  assert.equal(typeof rows[0].updated_at, 'string');
});

test('preferences: exact maxima pass, values trim, and interests deduplicate', async () => {
  const interests = Array.from({ length: 20 }, (_, index) => `${String(index).padStart(2, '0')}-${'x'.repeat(37)}`);
  const response = await preferences.put(jsonRequest(preferenceUrl, {
    skillLevel: 'beginner',
    photographyInterests: interests,
    homeLocation: ` ${'h'.repeat(120)} `,
    currentLocation: '  Sydney  ',
  }, { method: 'PUT', cookie: aliceCookie }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.deepEqual((await body(response)).preferences, {
    skillLevel: 'beginner',
    photographyInterests: interests,
    homeLocation: 'h'.repeat(120),
    currentLocation: 'Sydney',
  });

  const deduplicated = await preferences.put(jsonRequest(preferenceUrl, {
    photographyInterests: [' street ', 'street', 'portrait'],
  }, { method: 'PUT', cookie: aliceCookie }));
  assert.equal(deduplicated.status, 200);
  assert.deepEqual((await body(deduplicated)).preferences.photographyInterests, ['street', 'portrait']);

  for (const skillLevel of ['intermediate', 'advanced', 'professional']) {
    const valid = await preferences.put(jsonRequest(preferenceUrl, { skillLevel }, { method: 'PUT', cookie: aliceCookie }));
    assert.equal(valid.status, 200, skillLevel);
  }
});

test('preferences: invalid, null, empty, wrong-type, and one-over values are 400', async () => {
  const invalidBodies: unknown[] = [
    { skillLevel: 'expert' },
    { skillLevel: 1 },
    { skillLevel: null },
    { photographyInterests: Array.from({ length: 21 }, (_, index) => `interest-${index}`) },
    { photographyInterests: ['x'.repeat(41)] },
    { photographyInterests: [''] },
    { photographyInterests: ['   '] },
    { photographyInterests: ['street', 1] },
    { photographyInterests: 'street' },
    { photographyInterests: null },
    { homeLocation: 'x'.repeat(121) },
    { currentLocation: 'x'.repeat(121) },
    { homeLocation: 12 },
    { currentLocation: [] },
    { avoidsStyles: [] },
    null,
    [],
  ];
  for (const value of invalidBodies) {
    const response = await preferences.put(jsonRequest(preferenceUrl, value, { method: 'PUT', cookie: aliceCookie }));
    assert.equal(response.status, 400, JSON.stringify(value));
  }
  const malformed = await preferences.put(request(preferenceUrl, {
    method: 'PUT', cookie: aliceCookie, headers: { 'content-type': 'application/json' }, body: '{broken',
  }));
  assert.equal(malformed.status, 400);
});

test('preferences: omitted fields stay unchanged and only locations accept explicit null', async () => {
  deps.client.seed('fotoai_user_preferences', {
    user_id: ALICE,
    skill_level: 'beginner',
    photography_interests: ['macro'],
    home_location: 'Keep Home',
    current_location: 'Clear Me',
  });
  const response = await preferences.put(jsonRequest(preferenceUrl, {
    skillLevel: 'advanced',
    currentLocation: null,
  }, { method: 'PUT', cookie: aliceCookie }));
  assert.equal(response.status, 200);
  assert.deepEqual((await body(response)).preferences, {
    skillLevel: 'advanced',
    photographyInterests: ['macro'],
    homeLocation: 'Keep Home',
    currentLocation: null,
  });

  for (const value of [{ skillLevel: null }, { photographyInterests: null }]) {
    const invalid = await preferences.put(jsonRequest(preferenceUrl, value, { method: 'PUT', cookie: aliceCookie }));
    assert.equal(invalid.status, 400);
  }
});

test('gear: list returns at most 100 caller-owned four-field DTOs', async () => {
  for (let index = 0; index < 101; index += 1) {
    deps.client.seed('fotoai_user_gear', {
      user_id: ALICE,
      category: 'camera',
      brand: `Brand ${index}`,
      model: `Model ${index}`,
      created_at: new Date(2026, 0, 1, 0, index).toISOString(),
    });
  }
  deps.client.seed('fotoai_user_gear', {
    user_id: BOB, category: 'lens', brand: 'Private Bob Brand', model: 'Private Bob Model',
  });

  const response = await gear.list(request(gearUrl, { cookie: aliceCookie }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.gear.length, 100);
  assert.deepEqual(Object.keys(payload.gear[0]).sort(), ['brand', 'category', 'id', 'model']);
  assert.doesNotMatch(JSON.stringify(payload), /Private Bob|user_id/i);
});

test('gear: foreign delete is 404, malformed ID is 400, and owner delete succeeds', async () => {
  const own = deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Sony', model: 'A7' });
  const foreign = deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'lens', brand: 'Private', model: 'Bob' });

  const denied = await gear.remove(request(`${gearUrl}/${foreign.id}`, { method: 'DELETE', cookie: aliceCookie }), { params: { id: foreign.id } });
  assert.equal(denied.status, 404);
  assert.ok(deps.client.tables.get('fotoai_user_gear')!.some((row) => row.id === foreign.id));

  const malformed = await gear.remove(request(`${gearUrl}/bad`, { method: 'DELETE', cookie: aliceCookie }), { params: { id: 'bad' } });
  assert.equal(malformed.status, 400);

  const removed = await gear.remove(request(`${gearUrl}/${own.id}`, { method: 'DELETE', cookie: aliceCookie }), { params: { id: own.id } });
  assert.equal(removed.status, 200);
  assert.deepEqual(await body(removed), { success: true });
});

test('gear: every allowed category and exact brand/model maxima are accepted and trimmed', async () => {
  for (const category of ['camera', 'lens', 'tripod', 'light', 'other']) {
    const response = await gear.create(jsonRequest(gearUrl, {
      category,
      brand: ` ${'b'.repeat(80)} `,
      model: ` ${'m'.repeat(80)} `,
    }, { cookie: aliceCookie }));
    assert.equal(response.status, 201, category);
    const payload = await body(response);
    assert.deepEqual(payload.gear, {
      id: payload.gear.id,
      category,
      brand: 'b'.repeat(80),
      model: 'm'.repeat(80),
    });
    const row = deps.client.tables.get('fotoai_user_gear')!.at(-1)!;
    assert.equal(row.user_id, ALICE);
  }
});

test('gear: invalid category, empty, whitespace, bad type, one-over, arrays, and extra fields are 400', async () => {
  const invalidBodies: unknown[] = [
    validGear({ category: 'filter' }),
    validGear({ category: 'flash' }),
    validGear({ category: '' }),
    validGear({ category: 1 }),
    validGear({ brand: '' }),
    validGear({ brand: '   ' }),
    validGear({ model: '' }),
    validGear({ model: '   ' }),
    validGear({ brand: 'b'.repeat(81) }),
    validGear({ model: 'm'.repeat(81) }),
    validGear({ brand: 1 }),
    validGear({ model: [] }),
    validGear({ specs: 'not browser-editable' }),
    { category: 'camera', brand: 'Only brand' },
    null,
    [],
  ];
  for (const value of invalidBodies) {
    const response = await gear.create(jsonRequest(gearUrl, value, { cookie: aliceCookie }));
    assert.equal(response.status, 400, JSON.stringify(value));
  }
  const malformed = await gear.create(request(gearUrl, {
    method: 'POST', cookie: aliceCookie, headers: { 'content-type': 'application/json' }, body: '{broken',
  }));
  assert.equal(malformed.status, 400);
});

test('supabase HTTP: preference upsert uses the exact conflict query and Prefer header', async () => {
  let call: { input: string; init?: RequestInit } | undefined;
  const client = createFotoaiSupabaseClient(TEST_ENV, async (input, init) => {
    call = { input, init };
    return Response.json([{ user_id: ALICE, skill_level: 'advanced' }]);
  });
  await client.restUpsert('fotoai_user_preferences', {
    user_id: ALICE,
    skill_level: 'advanced',
  }, 'user_id', TOKEN_ALICE);

  assert.equal(call?.input, `${TEST_ENV.supabaseUrl}/rest/v1/fotoai_user_preferences?on_conflict=user_id`);
  assert.equal(call?.init?.method, 'POST');
  assert.equal(new Headers(call?.init?.headers).get('Prefer'), 'resolution=merge-duplicates,return=representation');
});

test('supabase HTTP: auth name comes only from bounded user_metadata.name', async () => {
  const responses = [
    { id: ALICE, email: 'alice@test.invalid', name: 'top-level-bad', app_metadata: { name: 'app-bad' }, user_metadata: { name: '  Alice\nCamera  ', private: 'ignored' } },
    { id: ALICE, email: 'alice@test.invalid', user_metadata: { name: 'x'.repeat(121) } },
    { id: ALICE, email: 'alice@test.invalid', user_metadata: { name: 42 } },
  ];
  const client = createFotoaiSupabaseClient(TEST_ENV, async () => Response.json(responses.shift()));
  assert.deepEqual(await client.getUser(TOKEN_ALICE), { id: ALICE, email: 'alice@test.invalid', name: 'AliceCamera' });
  assert.equal((await client.getUser(TOKEN_ALICE))?.name, null);
  assert.equal((await client.getUser(TOKEN_ALICE))?.name, null);
});
