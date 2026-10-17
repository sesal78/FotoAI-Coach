// Session refresh: an expired or nearly expired access cookie is renewed from
// the refresh cookie on any FotoAI API call, so users stay signed in.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHandlers } from '../../lib/fotoai/handlers/auth.ts';
import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { accessTokenNeedsRefresh, resetRefreshCacheForTests } from '../../lib/fotoai/session-refresh.ts';
import { TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { createTestDeps, request, type TestDeps } from './helpers/deps.ts';

let deps: TestDeps;
let challenges: ReturnType<typeof createChallengeHandlers>;
let auth: ReturnType<typeof createAuthHandlers>;

function jwtExpiringIn(seconds: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + seconds })}.sig`;
}

function setCookies(res: Response): string[] {
  return (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
}

beforeEach(() => {
  resetRefreshCacheForTests();
  deps = createTestDeps();
  challenges = createChallengeHandlers(() => deps);
  auth = createAuthHandlers(() => deps);
});

test('refresh: no access cookie but a valid refresh cookie -> request succeeds and new cookies are set', async () => {
  const res = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  assert.equal(res.status, 200);
  const cookies = setCookies(res);
  assert.ok(cookies.some((c) => c.startsWith(`fotoai_session=${TOKEN_ALICE}`)), 'new access cookie');
  assert.ok(cookies.some((c) => c.startsWith('fotoai_refresh=ref-alice-2')), 'rotated refresh cookie');
  assert.ok(cookies.every((c) => c.includes('HttpOnly')));
});

test('refresh: an access token expiring within a minute is renewed before use', async () => {
  const cookie = `fotoai_session=${jwtExpiringIn(30)}; fotoai_refresh=ref-alice`;
  const res = await challenges.list(request('/api/fotoai/challenges', { cookie }));
  assert.equal(res.status, 200);
  assert.ok(setCookies(res).some((c) => c.startsWith(`fotoai_session=${TOKEN_ALICE}`)));
});

test('refresh: a valid access token is used as is (no refresh call, no cookies)', async () => {
  const res = await challenges.list(request('/api/fotoai/challenges', { cookie: `fotoai_session=${TOKEN_ALICE}; fotoai_refresh=ref-alice` }));
  assert.equal(res.status, 200);
  assert.deepEqual(setCookies(res), []);
});

test('refresh: a rejected refresh token clears both cookies and the call is 401', async () => {
  const res = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=revoked' }));
  assert.equal(res.status, 401);
  const cookies = setCookies(res);
  assert.ok(cookies.some((c) => c.startsWith('fotoai_session=;') && c.includes('Max-Age=0')));
  assert.ok(cookies.some((c) => c.startsWith('fotoai_refresh=;') && c.includes('Max-Age=0')));
});

test('refresh: auth/me renews the session so the app shell stays signed in', async () => {
  const res = await auth.me(request('/api/fotoai/auth/me', { cookie: 'fotoai_refresh=ref-alice' }));
  assert.equal(res.status, 200);
  assert.ok(setCookies(res).some((c) => c.startsWith(`fotoai_session=${TOKEN_ALICE}`)));
});

test('refresh: logout never refreshes (it only clears)', async () => {
  const res = await auth.logout(request('/api/fotoai/auth/logout', {
    method: 'POST', cookie: 'fotoai_refresh=ref-alice', headers: { 'content-type': 'application/json' }, body: '{}',
  }));
  assert.ok(!setCookies(res).some((c) => c.startsWith(`fotoai_session=${TOKEN_ALICE}`)));
});

test('refresh: token expiry check', () => {
  assert.equal(accessTokenNeedsRefresh(null), true);
  assert.equal(accessTokenNeedsRefresh(jwtExpiringIn(30)), true);
  assert.equal(accessTokenNeedsRefresh(jwtExpiringIn(3600)), false);
  assert.equal(accessTokenNeedsRefresh('not-a-jwt'), false, 'unknown shape: let Supabase decide');
});

function countRefreshCalls(): { count: () => number } {
  let n = 0;
  const real = deps.client.refreshSession.bind(deps.client);
  deps.client.refreshSession = async (token: string) => {
    n += 1;
    await new Promise((r) => setTimeout(r, 20)); // a slow GoTrue round trip
    return real(token);
  };
  return { count: () => n };
}

test('refresh: parallel requests with the same refresh token share one refresh call', async () => {
  const calls = countRefreshCalls();
  const req = () => challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  const results = await Promise.all([req(), req(), req(), req()]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(calls.count(), 1, 'GoTrue sees the old refresh token only once (no reuse detection)');
  const sessions = results.map((r) => setCookies(r).find((c) => c.startsWith('fotoai_refresh=')));
  assert.ok(sessions.every((c) => c === sessions[0]), 'every response sets the same rotated refresh token');
});

test('refresh: a late request still holding the old refresh token reuses the new session', async () => {
  const calls = countRefreshCalls();
  await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  const late = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  assert.equal(late.status, 200);
  assert.equal(calls.count(), 1);
  assert.ok(setCookies(late).some((c) => c.startsWith('fotoai_refresh=ref-alice-2')), 'the late response is not cleared');
});

test('refresh: a rejected refresh is not cached (a later valid token still works)', async () => {
  const bad = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=revoked' }));
  assert.equal(bad.status, 401);
  const good = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  assert.equal(good.status, 200);
});

test('logout: with only a refresh cookie, the session is still revoked at Supabase', async () => {
  const signedOut: string[] = [];
  deps.client.signOut = async (token: string) => { signedOut.push(token); };
  const res = await auth.logout(request('/api/fotoai/auth/logout', {
    method: 'POST', cookie: 'fotoai_refresh=ref-alice', headers: { 'content-type': 'application/json' }, body: '{}',
  }));
  assert.equal(res.status, 200);
  assert.deepEqual(signedOut, [TOKEN_ALICE], 'the refreshed access token is used to sign out');
  assert.ok(setCookies(res).every((c) => c.includes('Max-Age=0')), 'only clearing cookies are sent');
});

test('logout: a valid access cookie is signed out directly (no refresh)', async () => {
  const signedOut: string[] = [];
  deps.client.signOut = async (token: string) => { signedOut.push(token); };
  const calls = countRefreshCalls();
  await auth.logout(request('/api/fotoai/auth/logout', {
    method: 'POST', cookie: `fotoai_session=${TOKEN_ALICE}; fotoai_refresh=ref-alice`, headers: { 'content-type': 'application/json' }, body: '{}',
  }));
  assert.deepEqual(signedOut, [TOKEN_ALICE]);
  assert.equal(calls.count(), 0);
});

test('refresh: a request arriving minutes later with the old token still gets the shared session (slow handlers)', async () => {
  const calls = countRefreshCalls();
  await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  const realNow = Date.now;
  Date.now = () => realNow() + 10 * 60 * 1000; // 10 minutes later, e.g. after a long portfolio run
  try {
    const late = await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
    assert.equal(late.status, 200);
    assert.equal(calls.count(), 1, 'the old refresh token is not sent to GoTrue again');
  } finally {
    Date.now = realNow;
  }
});

test('logout forgets the shared session for its refresh token', async () => {
  const calls = countRefreshCalls();
  deps.client.signOut = async () => {};
  await auth.logout(request('/api/fotoai/auth/logout', {
    method: 'POST', cookie: 'fotoai_refresh=ref-alice', headers: { 'content-type': 'application/json' }, body: '{}',
  }));
  await challenges.list(request('/api/fotoai/challenges', { cookie: 'fotoai_refresh=ref-alice' }));
  assert.equal(calls.count(), 2, 'after logout the old token is not answered from the shared result');
});
