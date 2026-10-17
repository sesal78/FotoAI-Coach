// POST /api/fotoai/locations: the location scout needs the FotoAI session
// before any LLM call. The legacy /api/locations POST is gone.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createLocationHandlers } from '../../lib/fotoai/handlers/locations.ts';
import { BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

const URL_LOC = '/api/fotoai/locations';
const aliceCookie = cookieFor(TOKEN_ALICE);
const RESULT = {
  locations: [{ name: 'Hosier Lane', address: 'Melbourne CBD', bestTimes: ['6am'], whatToShoot: ['murals'], tips: 'Go early' }],
  summary: 'Laneways',
};

let deps: TestDeps;
let locations: ReturnType<typeof createLocationHandlers>;

beforeEach(() => {
  deps = createTestDeps();
  locations = createLocationHandlers(() => deps);
  deps.fakes.callLLM = () => ({ content: JSON.stringify(RESULT), model: 'fake' });
});

test('locations: no session (or a bad token) is 401 and never calls the LLM', async () => {
  assert.equal((await locations.scout(jsonRequest(URL_LOC, { query: 'street art' }))).status, 401);
  assert.equal((await locations.scout(jsonRequest(URL_LOC, { query: 'street art' }, { cookie: cookieFor('tok-unknown') }))).status, 401);
  assert.equal(deps.calls.length, 0);
});

test('locations: the session user gets the scout result through deps.services.ai.callLLM', async () => {
  const res = await locations.scout(jsonRequest(URL_LOC, { query: 'street art', location: 'Fitzroy, Melbourne' }, { cookie: aliceCookie }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), RESULT);
  const [call] = deps.calls;
  assert.equal(call.name, 'callLLM');
  const [messages, options] = call.args as [Array<{ role: string; content: string }>, Record<string, unknown>];
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /User's base location: Fitzroy, Melbourne/);
  assert.deepEqual(messages[1], { role: 'user', content: 'Find photography locations for: street art' });
  assert.equal(options.model, 'gpt-4.1-mini');
  assert.equal(options.json_mode, true);
});

test('locations: the base location defaults to Melbourne', async () => {
  await locations.scout(jsonRequest(URL_LOC, { query: 'beaches' }, { cookie: aliceCookie }));
  const [messages] = deps.calls[0].args as [Array<{ content: string }>];
  assert.match(messages[0].content, /User's base location: Melbourne, Australia/);
});

test('locations: bad input is 400 before any LLM call, including a client userId', async () => {
  const cases: unknown[] = [
    {},
    { query: '' },
    { query: 42 },
    { query: 'x'.repeat(501) },
    { query: 'ok', location: 'y'.repeat(121) },
    { query: 'ok', location: 7 },
    { query: 'ok', userId: BOB },
    { query: 'ok', model: 'gpt-4' },
  ];
  for (const bad of cases) {
    const res = await locations.scout(jsonRequest(URL_LOC, bad, { cookie: aliceCookie }));
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 80));
  }
  const res = await locations.scout(jsonRequest(`${URL_LOC}?userId=${BOB}`, { query: 'ok' }, { cookie: aliceCookie }));
  assert.equal(res.status, 400);
  assert.equal(deps.calls.length, 0);
});

test('locations: an LLM failure or a non-JSON reply is a clean 502', async () => {
  deps.fakes.callLLM = () => { throw new Error('LLM API error: 500 secret detail'); };
  let res = await locations.scout(jsonRequest(URL_LOC, { query: 'parks' }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
  assert.ok(!JSON.stringify(await res.json()).includes('secret detail'));

  deps.fakes.callLLM = () => ({ content: 'not json', model: 'fake' });
  res = await locations.scout(jsonRequest(URL_LOC, { query: 'parks' }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
});

test('locations: a body that is not a JSON object is 400', async () => {
  const res = await locations.scout(request(URL_LOC, { method: 'POST', cookie: aliceCookie, body: 'not json', headers: { 'content-type': 'application/json' } }));
  assert.equal(res.status, 400);
  assert.equal(deps.calls.length, 0);
});

test('locations: the route and page use the session-only FotoAI endpoint; the legacy POST is removed', () => {
  const legacy = readFileSync(new URL('../../app/api/locations/route.ts', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../../app/api/fotoai/locations/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../app/locations/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(legacy, /export\s+async\s+function\s+POST|export\s+const\s+POST/);
  assert.doesNotMatch(legacy, /callLLM|@\/lib\/llm/);
  assert.match(route, /createLocationHandlers/);
  assert.match(route, /export const POST = handlers\.scout/);
  assert.match(page, /fetch\('\/api\/fotoai\/locations',\s*{\s*method:\s*'POST'/);
  assert.doesNotMatch(page, /userId|user_id/);
});
