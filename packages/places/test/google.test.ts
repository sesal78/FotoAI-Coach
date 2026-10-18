import { readFileSync } from 'node:fs';

import { PlaceDetail, PlaceSummary } from '@fotoai/contracts';
import { expect, test } from 'vitest';

import { createPlacesClient, PlacesError, PRO_FIELDS, type FetchLike } from '../src/index.ts';

const KEY = 'AIzaFAKE-test-key-123';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const FLINDERS = { lat: -37.8183, lng: 144.9671 };

type Call = { url: string; init?: RequestInit };

function setup(reply: (url: string) => Response | Error, key: string | null = KEY) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const value = reply(url);
    if (value instanceof Error) throw value;
    return value;
  };
  const client = createPlacesClient({ key: key ?? undefined, fetch, log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) } });
  return { client, calls, logs };
}

const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
const header = (call: Call, name: string) => new Headers(call.init?.headers).get(name);
const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(PlacesError);
  await expect(promise).rejects.toMatchObject({ code });
};

test('no key: every method is a config error and fetch is never called', async () => {
  const { client, calls } = setup(() => ok('{}'), null);
  await expectCode(client.nearby(FLINDERS.lat, FLINDERS.lng, 2000), 'config');
  await expectCode(client.search('Shrine of Remembrance'), 'config');
  await expectCode(client.details(FED), 'config');
  await expectCode(client.photoUri(`places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`, 800), 'config');
  expect(calls).toHaveLength(0);
});

test('the key goes in the header only, and field masks hold no Enterprise fields', async () => {
  const { client, calls } = setup((url) =>
    ok(fixture(url.includes(':searchNearby') ? 'places-nearby.json' : url.includes(':searchText') ? 'places-search.json' : url.includes('/media') ? 'places-photo.json' : 'places-details.json')),
  );
  await client.nearby(FLINDERS.lat, FLINDERS.lng, 2000);
  await client.search('Shrine of Remembrance', { ...FLINDERS, radiusM: 5000 });
  await client.details(FED);
  await client.details(FED, 'summary');
  await client.photoUri(`places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`, 800);
  for (const call of calls) {
    expect(call.url).not.toContain(KEY);
    expect(header(call, 'x-goog-api-key')).toBe(KEY);
  }
  const masks = calls.map((c) => header(c, 'x-goog-fieldmask')).filter((m): m is string => m !== null);
  expect(masks.length).toBe(4);
  for (const field of masks.flatMap((m) => m.split(','))) {
    expect(PRO_FIELDS).toContain(field.replace(/^places\./, ''));
  }
  expect(masks.join(',')).not.toMatch(/rating|userRatingCount|reviews|editorialSummary|regularOpeningHours|priceLevel/);
});

test('nearby maps the fixture to summaries with distance and the first photo', async () => {
  const { client, calls } = setup(() => ok(fixture('places-nearby.json')));
  const places = await client.nearby(FLINDERS.lat, FLINDERS.lng, 2000);
  expect(places).toHaveLength(2);
  places.forEach((p) => PlaceSummary.parse(p));
  expect(places[0]).toMatchObject({ placeId: FED, name: 'Federation Square', primaryType: 'tourist_attraction' });
  expect(places[0]!.distanceM).toBeGreaterThan(150); // about 176 m from the station point
  expect(places[0]!.distanceM).toBeLessThan(200);
  expect(places[0]!.photo).toMatchObject({ name: expect.stringContaining(`places/${FED}/photos/`), attributions: [{ displayName: 'Photographer 1' }] });
  expect(places[1]!.photo).toBeNull();
  const body = JSON.parse(String(calls[0]!.init?.body));
  expect(body).toMatchObject({ maxResultCount: 20, locationRestriction: { circle: { radius: 2000 } } });
  expect(body.includedTypes).toContain('scenic_spot');
});

test('nearby rejects a radius outside 1..50,000 m before any fetch', async () => {
  const { client, calls } = setup(() => ok('{}'));
  await expectCode(client.nearby(FLINDERS.lat, FLINDERS.lng, 0), 'validation');
  await expectCode(client.nearby(FLINDERS.lat, FLINDERS.lng, 50_001), 'validation');
  await expectCode(client.nearby(91, 0, 1000), 'validation');
  expect(calls).toHaveLength(0);
});

test('search sends a location bias when given a point', async () => {
  const { client, calls } = setup(() => ok(fixture('places-search.json')));
  const places = await client.search('Shrine of Remembrance', { ...FLINDERS, radiusM: 5000 });
  expect(places[0]).toMatchObject({ name: 'Shrine of Remembrance', primaryType: 'historical_landmark' });
  expect(JSON.parse(String(calls[0]!.init?.body))).toMatchObject({
    textQuery: 'Shrine of Remembrance',
    pageSize: 20,
    locationBias: { circle: { center: { latitude: FLINDERS.lat, longitude: FLINDERS.lng }, radius: 5000 } },
  });
  await client.search('Shrine of Remembrance');
  expect(JSON.parse(String(calls[1]!.init?.body)).locationBias).toBeUndefined();
  await expectCode(client.search('   '), 'validation');
  await expectCode(client.search('x'.repeat(121)), 'validation');
});

test('details maps up to 5 photos and the address', async () => {
  const { client } = setup(() => ok(fixture('places-details.json')));
  const place = await client.details(FED);
  PlaceDetail.parse(place);
  expect(place).toMatchObject({ placeId: FED, formattedAddress: expect.stringContaining('Melbourne'), distanceM: null });
  expect(place!.photos).toHaveLength(5);
});

test('details 404 is null; details 500 is upstream without Google text', async () => {
  expect(await setup(() => new Response('{"error":{"status":"NOT_FOUND"}}', { status: 404 })).client.details(FED)).toBeNull();
  const failing = setup(() => new Response('{"error":{"message":"API key not valid AIza..."}}', { status: 500 }));
  const err = await failing.client.details(FED).catch((e: unknown) => e);
  expect(err).toMatchObject({ code: 'upstream' });
  expect(String((err as Error).message)).not.toMatch(/API key|AIza/);
  await expectCode(setup(() => new Error('socket hang up')).client.details(FED), 'upstream');
  await expectCode(setup(() => ok('not json')).client.details(FED), 'upstream');
  await expectCode(setup(() => ok('{}')).client.details('bad id!'), 'validation');
});

test('a photo name for another path or with ../ is rejected before any fetch', async () => {
  const { client, calls } = setup(() => ok(fixture('places-photo.json')));
  for (const bad of [
    `places/${FED}/photos/../../v1/places:searchNearby`,
    `places/${FED}/reviews/AXCi2Q1photoRef0123456789abcdef`,
    `https://evil.example/places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`,
    `places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef?key=x`,
  ]) {
    await expectCode(client.photoUri(bad, 800), 'validation');
  }
  await expectCode(client.photoUri(`places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`, 1601), 'validation');
  expect(calls).toHaveLength(0);
  expect(await client.photoUri(`places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`, 800)).toEqual({
    photoUri: 'https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto=s1600-w1600',
  });
  expect(calls[0]!.url).toMatch(/\/media\?maxWidthPx=800&skipHttpRedirect=true$/);
});

test('a photoUri that contains the key is refused', async () => {
  const { client, logs } = setup(() => ok(JSON.stringify({ photoUri: `https://lh3.googleusercontent.com/x?key=${KEY}` })));
  await expectCode(client.photoUri(`places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`, 800), 'upstream');
  expect(logs.some((l) => l.includes('photoUri carried the key'))).toBe(true);
  expect(logs.join('\n')).not.toContain(KEY);
});

test('every call logs its sku and status, never the key or the query text', async () => {
  const { client, logs } = setup((url) => (url.includes(':searchText') ? ok(fixture('places-search.json')) : new Response('{}', { status: 503 })));
  await client.search('My secret beach');
  await client.nearby(FLINDERS.lat, FLINDERS.lng, 1000).catch(() => undefined);
  expect(logs).toEqual(['places call sku=search_pro status=200', 'places call sku=nearby_pro status=503']);
  expect(logs.join('\n')).not.toMatch(/secret|AIza|-37\.8/);
});

test('one malformed place in a list is skipped, not a failure of the whole list', async () => {
  const body = JSON.parse(fixture('places-nearby.json'));
  body.places.push({ id: 'ChIJnoLocation00000000000', displayName: { text: 'No location' } });
  const { client, logs } = setup(() => ok(JSON.stringify(body)));
  const places = await client.nearby(FLINDERS.lat, FLINDERS.lng, 2000);
  expect(places.map((p) => p.placeId)).toEqual([FED, 'ChIJiYrPnj5d1moRk5nGq2b0F4w']);
  expect(logs).toContain('places skipped 1 incomplete result(s)');
});
