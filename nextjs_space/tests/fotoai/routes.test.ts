// HTTP-level tests for the FotoAI route handlers (Web Request/Response, no Next).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHandlers } from '../../lib/fotoai/handlers/auth.ts';
import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { createProgressHandlers } from '../../lib/fotoai/handlers/progress.ts';
import { createSubmissionHandlers } from '../../lib/fotoai/handlers/submissions.ts';
import { FotoaiUpstreamError } from '../../lib/fotoai/errors.ts';
import { errorResponse } from '../../lib/fotoai/handlers/shared.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

let deps: TestDeps;
let auth: ReturnType<typeof createAuthHandlers>;
let subs: ReturnType<typeof createSubmissionHandlers>;
let challenges: ReturnType<typeof createChallengeHandlers>;
let progress: ReturnType<typeof createProgressHandlers>;
let aliceChallenge: Record<string, any>;
let bobChallenge: Record<string, any>;

beforeEach(() => {
  deps = createTestDeps();
  const provider = () => deps;
  auth = createAuthHandlers(provider);
  subs = createSubmissionHandlers(provider);
  challenges = createChallengeHandlers(provider);
  progress = createProgressHandlers(provider);
  aliceChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: ALICE, challenge_type: 'AFTER_WORK', challenge_text: 'Alice task', status: 'pending', issued_date: '2026-09-01T10:00:00Z',
  });
  bobChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: BOB, challenge_type: 'AFTER_WORK', challenge_text: 'Bob task', status: 'pending', issued_date: '2026-09-02T10:00:00Z',
  });
});

async function body(res: Response): Promise<any> {
  return res.json();
}

function setCookies(res: Response): string[] {
  return (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
}

interface TestFile { name: string; type: string; bytes: Uint8Array }

/**
 * Builds a multipart body the way a browser sends FormData: raw bytes with
 * Content-Type and Content-Length headers. (undici's Request does not set
 * Content-Length for a FormData body, but browsers always do.)
 */
function multipart(fields: Record<string, string | TestFile>): { body: Uint8Array; headers: Record<string, string> } {
  const boundary = 'fotoai-route-test-boundary';
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    } else {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.name}"\r\nContent-Type: ${v.type}\r\n\r\n`));
      chunks.push(v.bytes);
      chunks.push(enc.encode('\r\n'));
    }
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { body.set(c, off); off += c.byteLength; }
  return {
    body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(total) },
  };
}

// ---------------------------------------------------------------------------
// Unauthenticated denial
// ---------------------------------------------------------------------------

test('routes: every protected route returns 401 without a session cookie', async () => {
  const cases: Array<[string, Promise<Response>]> = [
    ['me', auth.me(request('/api/fotoai/auth/me'))],
    ['submissions list', subs.list(request('/api/fotoai/submissions'))],
    ['submissions create', subs.create(request('/api/fotoai/submissions', { method: 'POST', ...multipart({ challengeId: aliceChallenge.id }) }))],
    ['submission get', subs.get(request(`/api/fotoai/submissions/${aliceChallenge.id}`), { params: { id: aliceChallenge.id } })],
    ['submission delete', subs.remove(request(`/api/fotoai/submissions/${aliceChallenge.id}`, { method: 'DELETE' }), { params: { id: aliceChallenge.id } })],
    ['submission photo', subs.photo(request(`/api/fotoai/submissions/${aliceChallenge.id}/photo`), { params: { id: aliceChallenge.id } })],
    ['challenges list', challenges.list(request('/api/fotoai/challenges'))],
    ['challenge get', challenges.get(request(`/api/fotoai/challenges/${aliceChallenge.id}`), { params: { id: aliceChallenge.id } })],
    ['challenge patch', challenges.patch(jsonRequest(`/api/fotoai/challenges/${aliceChallenge.id}`, { status: 'completed' }, { method: 'PATCH' }), { params: { id: aliceChallenge.id } })],
    ['progress', progress.get(request('/api/fotoai/progress'))],
  ];
  for (const [label, pending] of cases) {
    const res = await pending;
    assert.equal(res.status, 401, `${label} should be 401`);
    assert.equal((await body(res)).code, 'unauthenticated', label);
  }
  // Nothing was created or signed.
  assert.equal((deps.client.tables.get('fotoai_challenge_submissions') ?? []).length, 0);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('routes: an Appwrite cookie alone does not open a FotoAI session', async () => {
  const res = await auth.me(request('/api/fotoai/auth/me', { cookie: 'foto_session=some-appwrite-secret' }));
  assert.equal(res.status, 401);
});

test('routes: a stale/unknown token is 401', async () => {
  const res = await progress.get(request('/api/fotoai/progress', { cookie: cookieFor('expired-or-forged') }));
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// Forged ID denial (client-supplied identity)
// ---------------------------------------------------------------------------

test('routes: a client-supplied userId is rejected with 400 even for a valid session', async () => {
  const res1 = await subs.list(request(`/api/fotoai/submissions?userId=${BOB}`, { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(res1.status, 400);
  assert.match((await body(res1)).error, /must not be sent by the client/);

  const res2 = await subs.create(request('/api/fotoai/submissions', {
    method: 'POST', cookie: cookieFor(TOKEN_ALICE),
    ...multipart({ challengeId: aliceChallenge.id, userId: BOB }),
  }));
  assert.equal(res2.status, 400);

  const res3 = await challenges.patch(jsonRequest(`/api/fotoai/challenges/${aliceChallenge.id}`, { status: 'completed', user_id: BOB }, { method: 'PATCH', cookie: cookieFor(TOKEN_ALICE) }), { params: { id: aliceChallenge.id } });
  assert.equal(res3.status, 400);

  const res4 = await progress.get(request(`/api/fotoai/progress?userId=${BOB}`, { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(res4.status, 400);

  const res5 = await auth.login(jsonRequest('/api/fotoai/auth/login', { email: 'alice@test.invalid', password: 'correct-horse', userId: BOB }));
  assert.equal(res5.status, 400);

  assert.equal((deps.client.tables.get('fotoai_challenge_submissions') ?? []).length, 0);
  assert.equal((deps.client.tables.get('fotoai_user_progress') ?? []).length, 0);
});

// ---------------------------------------------------------------------------
// Cross-user denial
// ---------------------------------------------------------------------------

test('routes: alice cannot see or touch bob\'s challenge or submission (404), bob\'s data unchanged', async () => {
  // Bob creates a submission with a photo.
  const create = await subs.create(request('/api/fotoai/submissions', {
    method: 'POST', cookie: cookieFor(TOKEN_BOB),
    ...multipart({ challengeId: bobChallenge.id, notes: 'bob notes', photo: { name: 'bob.png', type: 'image/png', bytes: new Uint8Array([1, 2, 3]) } }),
  }));
  assert.equal(create.status, 201, JSON.stringify(await create.clone().json()));
  const bobSub = (await body(create)).submission;
  assert.ok(bobSub.photo_object_key.startsWith(`${BOB}/submissions/${bobSub.id}/`));

  const attempts: Array<[string, Promise<Response>]> = [
    ['get challenge', challenges.get(request(`/api/fotoai/challenges/${bobChallenge.id}`, { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: bobChallenge.id } })],
    ['patch challenge', challenges.patch(jsonRequest(`/api/fotoai/challenges/${bobChallenge.id}`, { status: 'skipped' }, { method: 'PATCH', cookie: cookieFor(TOKEN_ALICE) }), { params: { id: bobChallenge.id } })],
    ['submit to challenge', subs.create(request('/api/fotoai/submissions', { method: 'POST', cookie: cookieFor(TOKEN_ALICE), ...multipart({ challengeId: bobChallenge.id }) }))],
    ['get submission', subs.get(request(`/api/fotoai/submissions/${bobSub.id}`, { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: bobSub.id } })],
    ['delete submission', subs.remove(request(`/api/fotoai/submissions/${bobSub.id}`, { method: 'DELETE', cookie: cookieFor(TOKEN_ALICE) }), { params: { id: bobSub.id } })],
    ['sign photo', subs.photo(request(`/api/fotoai/submissions/${bobSub.id}/photo`, { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: bobSub.id } })],
  ];
  for (const [label, pending] of attempts) {
    const res = await pending;
    assert.equal(res.status, 404, `${label} should be 404`);
  }

  // Alice's listing shows nothing of Bob's.
  const list = await subs.list(request('/api/fotoai/submissions', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.deepEqual((await body(list)).submissions, []);
  const clist = await challenges.list(request('/api/fotoai/challenges', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.deepEqual((await body(clist)).challenges.map((c: any) => c.id), [aliceChallenge.id]);

  // Bob's rows and object still exist; no sign/remove was issued for alice.
  assert.equal(deps.client.tables.get('fotoai_challenge_submissions')!.length, 1);
  assert.equal(deps.client.objects.size, 1);
  assert.equal(deps.client.serviceCalls.length, 0);
  assert.equal(deps.client.tables.get('fotoai_daily_challenges')!.find((r) => r.id === bobChallenge.id)!.status, 'completed');
});

// ---------------------------------------------------------------------------
// Owner success
// ---------------------------------------------------------------------------

test('routes: owner can login, submit with photo, list, sign, and delete; object removed on delete', async () => {
  const login = await auth.login(jsonRequest('/api/fotoai/auth/login', { email: 'alice@test.invalid', password: 'correct-horse' }));
  assert.equal(login.status, 200);
  const cookies = setCookies(login);
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^fotoai_session=tok-alice; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600$/);
  assert.match(cookies[1], /^fotoai_refresh=ref-alice; Path=\/; HttpOnly; SameSite=Lax/);

  const me = await auth.me(request('/api/fotoai/auth/me', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(me.status, 200);
  assert.deepEqual(await body(me), { id: ALICE, email: 'alice@test.invalid', name: null });

  const create = await subs.create(request('/api/fotoai/submissions', {
    method: 'POST', cookie: cookieFor(TOKEN_ALICE),
    ...multipart({ challengeId: aliceChallenge.id, notes: 'my notes', rating: '5', photo: { name: 'Mine.JPG', type: 'image/jpeg', bytes: new Uint8Array([9, 9]) } }),
  }));
  assert.equal(create.status, 201, JSON.stringify(await create.clone().json()));
  const sub = (await body(create)).submission;
  assert.equal(sub.user_id, ALICE);
  assert.equal(sub.rating, 5);
  assert.match(sub.photo_object_key, new RegExp(`^${ALICE}/submissions/${sub.id}/[0-9a-f-]+\\.jpg$`));
  assert.ok(!('photoUrl' in sub), 'no public URL is stored');

  const get = await subs.get(request(`/api/fotoai/submissions/${sub.id}`, { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: sub.id } });
  assert.equal(get.status, 200);

  const photo = await subs.photo(request(`/api/fotoai/submissions/${sub.id}/photo?ttl=30`, { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: sub.id } });
  assert.equal(photo.status, 200);
  const signed = await body(photo);
  assert.equal(signed.expiresIn, 30);
  assert.ok(signed.url.includes(sub.photo_object_key));
  assert.equal(photo.headers.get('cache-control'), 'no-store');

  const prog = await progress.get(request('/api/fotoai/progress', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(prog.status, 200);
  const p = (await body(prog)).progress;
  assert.equal(p.total_challenges_completed, 1);
  assert.equal(p.current_streak, 1);
  assert.equal(p.recentSubmissions.length, 1);

  const actions = deps.client.tables.get('fotoai_agent_actions')!;
  assert.equal(actions.length, 1);
  assert.equal(actions[0].user_id, ALICE);

  const del = await subs.remove(request(`/api/fotoai/submissions/${sub.id}`, { method: 'DELETE', cookie: cookieFor(TOKEN_ALICE) }), { params: { id: sub.id } });
  assert.equal(del.status, 200);
  assert.equal(deps.client.objects.size, 0);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['sign', 'remove']);

  const logout = await auth.logout(request('/api/fotoai/auth/logout', { method: 'POST', cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(logout.status, 200);
  assert.ok(setCookies(logout).every((c) => /Max-Age=0/.test(c)));
});

test('routes: bad login is 401 and sets no cookie', async () => {
  const res = await auth.login(jsonRequest('/api/fotoai/auth/login', { email: 'alice@test.invalid', password: 'wrong' }));
  assert.equal(res.status, 401);
  assert.equal(setCookies(res).length, 0);
});

test('routes: malformed ids and bodies are 400, never 500', async () => {
  const r1 = await subs.get(request('/api/fotoai/submissions/not-a-uuid', { cookie: cookieFor(TOKEN_ALICE) }), { params: { id: 'not-a-uuid' } });
  assert.equal(r1.status, 400);
  const r2 = await challenges.patch(request(`/api/fotoai/challenges/${aliceChallenge.id}`, { method: 'PATCH', cookie: cookieFor(TOKEN_ALICE), body: 'not json' }), { params: { id: aliceChallenge.id } });
  assert.equal(r2.status, 400);
  const r3 = await subs.create(request('/api/fotoai/submissions', { method: 'POST', cookie: cookieFor(TOKEN_ALICE), ...multipart({ notes: 'no challenge' }) }));
  assert.equal(r3.status, 400);
});

test('routes: submission upload is size-gated before parsing (411 / 413), no DB access', async () => {
  let selects = 0;
  const original = deps.client.restSelect;
  deps.client.restSelect = async (...args) => { selects += 1; return original.call(deps.client, ...args); };

  // Streamed body without Content-Length -> 411.
  const noLength = new Request('http://localhost/api/fotoai/submissions', {
    method: 'POST',
    headers: { cookie: cookieFor(TOKEN_ALICE), 'content-type': 'multipart/form-data; boundary=x' },
    body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('--x--\r\n')); c.close(); } }),
    duplex: 'half',
  } as RequestInit);
  const r1 = await subs.create(noLength);
  assert.equal(r1.status, 411);

  // Declared size above the limit -> 413.
  const tooBig = new Request('http://localhost/api/fotoai/submissions', {
    method: 'POST',
    headers: { cookie: cookieFor(TOKEN_ALICE), 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(200 * 1024 * 1024) },
    body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('--x--\r\n')); c.close(); } }),
    duplex: 'half',
  } as RequestInit);
  const r2 = await subs.create(tooBig);
  assert.equal(r2.status, 413);

  assert.equal(selects, 0, 'no database query before the size gate');
  assert.equal((deps.client.tables.get('fotoai_challenge_submissions') ?? []).length, 0);
});

test('routes: unexpected upstream failures become a generic 500 with no detail leak', async () => {
  deps.client.restSelect = async () => { throw new Error('secret connection string leaked?'); };
  const res = await progress.get(request('/api/fotoai/progress', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal(res.status, 500);
  assert.deepEqual(await body(res), { error: 'Internal error', code: 'internal' });
  assert.equal(deps.logs.length, 1);
});

test('auth me: display name is trimmed, control-safe, bounded, or null', async () => {
  deps.client.getUser = async () => ({
    id: ALICE,
    email: 'alice@test.invalid',
    name: '  Alice\u0000 Camera\n  ',
  } as any);
  const named = await auth.me(request('/api/fotoai/auth/me', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.deepEqual(await body(named), { id: ALICE, email: 'alice@test.invalid', name: 'Alice Camera' });

  deps.client.getUser = async () => ({ id: ALICE, email: 'alice@test.invalid', name: 'x'.repeat(120) } as any);
  const maximum = await auth.me(request('/api/fotoai/auth/me', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.equal((await body(maximum)).name, 'x'.repeat(120));

  deps.client.getUser = async () => ({ id: ALICE, email: 'alice@test.invalid', name: null } as any);
  const missing = await auth.me(request('/api/fotoai/auth/me', { cookie: cookieFor(TOKEN_ALICE) }));
  assert.deepEqual(await body(missing), { id: ALICE, email: 'alice@test.invalid', name: null });

  for (const name of ['', '   ', '\u0000\n\t', 42, { unsafe: true }, 'x'.repeat(121)]) {
    deps.client.getUser = async () => ({ id: ALICE, email: 'alice@test.invalid', name } as any);
    const invalid = await auth.me(request('/api/fotoai/auth/me', { cookie: cookieFor(TOKEN_ALICE) }));
    assert.equal((await body(invalid)).name, null);
  }
});

test('routes: FotoaiUpstreamError response never exposes its sensitive marker', async () => {
  const marker = 'SENSITIVE-UPSTREAM-MARKER';
  const res = errorResponse(new FotoaiUpstreamError(503, marker), deps);
  const payload = await body(res);
  assert.equal(res.status, 502);
  assert.deepEqual(payload, { error: 'Upstream service error', code: 'upstream' });
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(marker));
  assert.match(deps.logs[0].message, new RegExp(marker));
});
