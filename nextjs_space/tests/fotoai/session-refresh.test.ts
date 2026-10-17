// Session refresh: an expired or nearly expired access cookie is renewed from
// the refresh cookie on any FotoAI API call, so users stay signed in.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHandlers } from '../../lib/fotoai/handlers/auth.ts';
import { createChallengeHandlers } from '../../lib/fotoai/handlers/challenges.ts';
import { accessTokenNeedsRefresh } from '../../lib/fotoai/session-refresh.ts';
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
