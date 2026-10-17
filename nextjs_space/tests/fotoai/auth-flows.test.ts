// Email auth flows on Supabase GoTrue: forgot-password, reset-password,
// verify-email, resend-verification, and the register redirect + seeding.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiUpstreamError, FotoaiValidationError } from '../../lib/fotoai/errors.ts';
import { authRedirectOrigin, createAuthHandlers } from '../../lib/fotoai/handlers/auth.ts';
import { createFotoaiSupabaseClient } from '../../lib/fotoai/supabase-http.ts';
import { parseFotoaiLinkToken } from '../../lib/fotoai/client-auth-flows.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, TEST_ENV, type TestDeps } from './helpers/deps.ts';

type Logged = { level: string; message: string; meta?: Record<string, unknown> };

let deps: TestDeps;
let auth: ReturnType<typeof createAuthHandlers>;
let logged: Logged[];
let gotrue: Array<{ op: string; args: unknown[] }>;

beforeEach(() => {
  deps = createTestDeps();
  logged = [];
  deps.log = (level, message, meta) => { logged.push({ level, message, meta }); };
  gotrue = [];
  // Record every GoTrue call the flows make, then defer to the fake.
  const client = deps.client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const op of ['requestPasswordRecovery', 'resendSignupConfirmation', 'verifyTokenHash', 'updateUserPassword', 'signOut', 'signUpWithRedirect', 'getUser']) {
    const original = client[op].bind(deps.client);
    client[op] = async (...args: unknown[]) => {
      gotrue.push({ op, args });
      return original(...args);
    };
  }
  auth = createAuthHandlers(() => deps);
});

function post(path: string, body: unknown, init: { origin?: string; cookie?: string; contentType?: string } = {}): Request {
  const headers = new Headers({ 'content-type': init.contentType ?? 'application/json' });
  if (init.cookie) headers.set('cookie', init.cookie);
  return new Request(`${init.origin ?? 'http://localhost:3000'}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function setCookies(res: Response): string[] {
  return (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const calls = (op: string) => gotrue.filter((call) => call.op === op);

// ----- forgot-password --------------------------------------------------

test('forgot-password: known and unknown emails get the identical 200 and the reset link goes to /reset-password', async () => {
  const known = await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'Alice@Test.invalid' }));
  const unknown = await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'nobody@test.invalid' }));
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.deepEqual(setCookies(known), []);
  assert.deepEqual(calls('requestPasswordRecovery').map((call) => call.args), [
    ['alice@test.invalid', 'http://localhost:3000/reset-password'],
    ['nobody@test.invalid', 'http://localhost:3000/reset-password'],
  ]);
});

test('forgot-password: an upstream failure or rate limit still answers the same 200 and logs no address', async () => {
  const baseline = await (await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'alice@test.invalid' }))).json();
  for (const status of [500, 429]) {
    deps.client.requestPasswordRecovery = async () => { throw new FotoaiUpstreamError(status, `Password recovery request failed (${status})`); };
    const response = await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'alice@test.invalid' }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), baseline);
  }
  await tick();
  assert.deepEqual(logged.map((entry) => [entry.level, entry.meta?.status]), [['error', 500], ['warn', 429]]);
  assert.doesNotMatch(JSON.stringify(logged), /alice/i);
});

test('forgot-password: bad email, owner id, extra field, or non-JSON content type is 400 with no GoTrue call', async () => {
  const bodies: unknown[] = [
    {}, { email: '' }, { email: 'not-an-email' }, { email: 7 }, { email: `${'a'.repeat(250)}@x.io` },
    { email: 'alice@test.invalid', userId: ALICE }, { email: 'alice@test.invalid', redirectTo: 'https://evil.example' }, [],
  ];
  for (const body of bodies) {
    const response = await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  const form = await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'alice@test.invalid' }, { contentType: 'text/plain' }));
  assert.equal(form.status, 400);
  assert.equal(calls('requestPasswordRecovery').length, 0);
});

test('auth redirects: only allow-listed origins are used; anything else falls back to production', async () => {
  for (const [origin, expected] of [
    ['https://myfoto.topues.com', 'https://myfoto.topues.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['https://evil.example', 'https://myfoto.topues.com'],
    ['http://localhost', 'https://myfoto.topues.com'],
    ['http://0.0.0.0:3000', 'https://myfoto.topues.com'],
  ]) {
    assert.equal(authRedirectOrigin(new Request(`${origin}/api/fotoai/auth/forgot-password`)), expected, origin);
  }
  await auth.forgotPassword(post('/api/fotoai/auth/forgot-password', { email: 'alice@test.invalid' }, { origin: 'https://evil.example' }));
  assert.equal(calls('requestPasswordRecovery')[0].args[1], 'https://myfoto.topues.com/reset-password');
});

// ----- resend-verification ---------------------------------------------

test('resend-verification: generic 200 for any address, link goes to /verify-email/confirm, failures stay hidden', async () => {
  const known = await auth.resendVerification(post('/api/fotoai/auth/resend-verification', { email: 'alice@test.invalid' }));
  const unknown = await auth.resendVerification(post('/api/fotoai/auth/resend-verification', { email: 'ghost@test.invalid' }));
  assert.equal(known.status, 200);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.deepEqual(calls('resendSignupConfirmation')[0].args, ['alice@test.invalid', 'http://localhost:3000/verify-email/confirm']);

  deps.client.resendSignupConfirmation = async () => { throw new FotoaiUpstreamError(429, 'Confirmation resend failed (429)'); };
  const limited = await auth.resendVerification(post('/api/fotoai/auth/resend-verification', { email: 'alice@test.invalid' }));
  assert.equal(limited.status, 200);
  assert.deepEqual(await limited.json(), await (await auth.resendVerification(post('/api/fotoai/auth/resend-verification', { email: 'x@test.invalid' }))).json());
  await tick();
  assert.doesNotMatch(JSON.stringify(logged), /alice/i);

  for (const body of [{}, { email: 'nope' }, { email: 'alice@test.invalid', user_id: ALICE }, { email: 'alice@test.invalid', type: 'recovery' }]) {
    assert.equal((await auth.resendVerification(post('/api/fotoai/auth/resend-verification', body))).status, 400, JSON.stringify(body));
  }
});

// ----- reset-password ---------------------------------------------------

test('reset-password: fragment access token sets the password, revokes the recovery session, and logs nobody in', async () => {
  const response = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: TOKEN_ALICE, password: 'new-horse-battery' }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).success, true);
  assert.deepEqual(calls('updateUserPassword').map((call) => call.args), [[TOKEN_ALICE, 'new-horse-battery']]);
  assert.deepEqual(calls('signOut').map((call) => call.args), [[TOKEN_ALICE]]);
  const cookies = setCookies(response);
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((cookie) => /Max-Age=0/.test(cookie) && /^fotoai_(session|refresh)=;/.test(cookie)), cookies.join(' | '));
});

test('reset-password: token_hash form verifies as recovery, then sets the password', async () => {
  const response = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { tokenHash: 'hash-bob', password: 'new-horse-battery' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls('verifyTokenHash').map((call) => call.args), [['recovery', 'hash-bob']]);
  assert.deepEqual(calls('updateUserPassword').map((call) => call.args), [[TOKEN_BOB, 'new-horse-battery']]);
});

test('reset-password: short or over-long password is 400 before any GoTrue call', async () => {
  for (const password of ['', 'short', '1234567', 'x'.repeat(73), 'é'.repeat(37), 12345678, null]) {
    const response = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: TOKEN_ALICE, password }));
    assert.equal(response.status, 400, String(password));
  }
  assert.equal(gotrue.length, 0);
  const exact = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: TOKEN_ALICE, password: 'x'.repeat(72) }));
  assert.equal(exact.status, 200);
});

test('reset-password: bad access token or expired hash is 401 and changes no password', async () => {
  const badToken = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: 'bogus-token', password: 'new-horse-battery' }));
  assert.equal(badToken.status, 401);
  const badHash = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { tokenHash: 'expired-hash', password: 'new-horse-battery' }));
  assert.equal(badHash.status, 401);
  assert.equal(calls('updateUserPassword').length, 0);
  assert.deepEqual(setCookies(badToken), []);
});

test('reset-password: malformed token shapes, owner ids, and extra fields are 400', async () => {
  const bodies: unknown[] = [
    { password: 'new-horse-battery' },
    { accessToken: TOKEN_ALICE, tokenHash: 'hash-alice', password: 'new-horse-battery' },
    { accessToken: '', password: 'new-horse-battery' },
    { accessToken: 'has space', password: 'new-horse-battery' },
    { accessToken: 'x'.repeat(8193), password: 'new-horse-battery' },
    { tokenHash: 42, password: 'new-horse-battery' },
    { accessToken: TOKEN_ALICE, password: 'new-horse-battery', userId: BOB },
    { accessToken: TOKEN_ALICE, password: 'new-horse-battery', email: 'bob@test.invalid' },
  ];
  for (const body of bodies) {
    const response = await auth.resetPassword(post('/api/fotoai/auth/reset-password', body));
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.equal(calls('updateUserPassword').length, 0);
});

test('reset-password: a password GoTrue rejects is 400 with a safe message', async () => {
  deps.client.updateUserPassword = async () => { throw new FotoaiValidationError('New password must be different from the old password'); };
  const response = await auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: TOKEN_ALICE, password: 'same-old-pass' }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'New password must be different from the old password');
});

// ----- verify-email -----------------------------------------------------

test('verify-email: fragment tokens set the FotoAI session cookies like login and seed default rows once', async () => {
  const response = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: 3600 }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.deepEqual(await response.json(), { success: true, userId: ALICE });
  const cookies = setCookies(response);
  assert.ok(cookies.some((cookie) => cookie.startsWith(`fotoai_session=${TOKEN_ALICE};`) && /HttpOnly/.test(cookie) && /Max-Age=3600/.test(cookie) && /SameSite=Lax/.test(cookie)));
  assert.ok(cookies.some((cookie) => cookie.startsWith('fotoai_refresh=ref-alice;') && /HttpOnly/.test(cookie)));

  const prefs = deps.client.tables.get('fotoai_user_preferences')!;
  assert.equal(prefs.length, 1);
  assert.equal(prefs[0].user_id, ALICE);
  assert.deepEqual(prefs[0].work_days, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  assert.deepEqual(prefs[0].photography_interests, ['street', 'portrait', 'architecture']);
  assert.equal(prefs[0].primary_photo_day, 'Saturday');
  const progress = deps.client.tables.get('fotoai_user_progress')!;
  assert.equal(progress.length, 1);
  assert.equal(progress[0].user_id, ALICE);

  // A second verify (or a returning user) never overwrites or duplicates rows.
  prefs[0].skill_level = 'professional';
  const again = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice' }));
  assert.equal(again.status, 200);
  assert.equal(deps.client.tables.get('fotoai_user_preferences')!.length, 1);
  assert.equal(deps.client.tables.get('fotoai_user_preferences')![0].skill_level, 'professional');
  assert.equal(deps.client.tables.get('fotoai_user_progress')!.length, 1);
  assert.equal(deps.client.serviceCalls.length, 0, 'seeding uses the user token only');
});

test('verify-email: token_hash form verifies with GoTrue and sets that user cookie', async () => {
  const response = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { tokenHash: 'hash-bob', type: 'signup' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls('verifyTokenHash').map((call) => call.args), [['signup', 'hash-bob']]);
  assert.ok(setCookies(response).some((cookie) => cookie.startsWith(`fotoai_session=${TOKEN_BOB};`)));
  const defaultType = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { tokenHash: 'hash-alice' }));
  assert.equal(defaultType.status, 200);
  assert.deepEqual(calls('verifyTokenHash')[1].args, ['email', 'hash-alice']);
});

test('verify-email: bad token or expired hash is 401 and sets no cookie or row', async () => {
  for (const body of [{ accessToken: 'bogus-token', refreshToken: 'ref-x' }, { tokenHash: 'expired-hash' }]) {
    const response = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', body));
    assert.equal(response.status, 401, JSON.stringify(body));
    assert.deepEqual(setCookies(response), []);
  }
  assert.equal((deps.client.tables.get('fotoai_user_preferences') ?? []).length, 0);
});

test('verify-email: malformed bodies are 400 with no cookie', async () => {
  const bodies: unknown[] = [
    {},
    { accessToken: TOKEN_ALICE },
    { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', type: 'signup' },
    { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: -5 },
    { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: 'soon' },
    { tokenHash: 'hash-alice', type: 'recovery' },
    { tokenHash: 'hash-alice', type: 'magiclink' },
    { tokenHash: 'hash-alice', refreshToken: 'ref-alice' },
    { accessToken: TOKEN_ALICE, tokenHash: 'hash-alice', refreshToken: 'ref-alice' },
    { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', userId: ALICE },
    { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', redirect: '/admin' },
  ];
  for (const body of bodies) {
    const response = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(setCookies(response), []);
  }
  const textPlain = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice' }, { contentType: 'text/plain' }));
  assert.equal(textPlain.status, 400);
});

test('verify-email: a client expiresIn is clamped to 1 minute .. 1 day for the cookie', async () => {
  const long = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: 999999999 }));
  assert.ok(setCookies(long).some((cookie) => cookie.startsWith('fotoai_session=') && /Max-Age=86400/.test(cookie)));
  const short = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: '5' }));
  assert.ok(setCookies(short).some((cookie) => cookie.startsWith('fotoai_session=') && /Max-Age=60/.test(cookie)));
});

test('verify-email: a seeding failure is logged without detail but still signs the user in', async () => {
  deps.client.restInsert = async () => { throw new FotoaiUpstreamError(500, `insert failed for ${TOKEN_ALICE}`); };
  const response = await auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice' }));
  assert.equal(response.status, 200);
  assert.ok(setCookies(response).some((cookie) => cookie.startsWith(`fotoai_session=${TOKEN_ALICE};`)));
  assert.deepEqual(logged.map((entry) => [entry.level, entry.message, entry.meta?.code]), [['warn', 'Account default rows could not be created', 'upstream']]);
});

test('auth flows: link tokens and new passwords never appear in logs or response bodies', async () => {
  const secrets = [TOKEN_ALICE, 'ref-alice', 'hash-alice', 'bogus-token', 'expired-hash', 'new-horse-battery'];
  const captured: string[] = [];
  const original = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  console.error = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };
  console.warn = console.error;
  console.log = console.error;
  console.info = console.error;
  try {
    deps.client.signOut = async () => { throw new FotoaiUpstreamError(500, 'Sign-out failed: upstream'); };
    const responses = await Promise.all([
      auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: TOKEN_ALICE, refreshToken: 'ref-alice' })),
      auth.verifyEmail(post('/api/fotoai/auth/verify-email', { accessToken: 'bogus-token', refreshToken: 'ref-alice' })),
      auth.verifyEmail(post('/api/fotoai/auth/verify-email', { tokenHash: 'hash-alice' })),
      auth.verifyEmail(post('/api/fotoai/auth/verify-email', { tokenHash: 'expired-hash' })),
      auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: TOKEN_ALICE, password: 'new-horse-battery' })),
      auth.resetPassword(post('/api/fotoai/auth/reset-password', { accessToken: 'bogus-token', password: 'new-horse-battery' })),
      auth.resetPassword(post('/api/fotoai/auth/reset-password', { tokenHash: 'expired-hash', password: 'new-horse-battery' })),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.text()));
    await tick();
    const haystack = `${JSON.stringify(logged)}\n${captured.join('\n')}\n${bodies.join('\n')}`;
    for (const secret of secrets) assert.ok(!haystack.includes(secret), `${secret} leaked`);
    assert.ok(logged.some((entry) => entry.message === 'Recovery session sign-out failed'));
  } finally {
    Object.assign(console, original);
  }
});

// ----- register ---------------------------------------------------------

test('register: asks GoTrue to send the confirmation link to /verify-email/confirm and seeds rows when a session is returned', async () => {
  const pending = await auth.register(post('/api/fotoai/auth/register', { email: 'new@test.invalid', password: 'long-enough', name: 'New' }));
  assert.equal(pending.status, 202);
  assert.deepEqual(calls('signUpWithRedirect')[0].args, ['new@test.invalid', 'long-enough', 'New', 'http://localhost:3000/verify-email/confirm']);
  assert.equal((deps.client.tables.get('fotoai_user_preferences') ?? []).length, 0);

  deps.client.signUpWithRedirect = async () => ({
    userId: ALICE,
    session: { userId: ALICE, accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: 3600 },
  });
  const immediate = await auth.register(post('/api/fotoai/auth/register', { email: 'alice@test.invalid', password: 'long-enough', name: 'Alice' }));
  assert.equal(immediate.status, 201);
  assert.ok(setCookies(immediate).some((cookie) => cookie.startsWith(`fotoai_session=${TOKEN_ALICE};`)));
  assert.equal(deps.client.tables.get('fotoai_user_preferences')![0].user_id, ALICE);
  assert.equal(deps.client.tables.get('fotoai_user_progress')![0].user_id, ALICE);

  // The session cookie from verify works for the normal session routes.
  const me = await auth.me(new Request('http://localhost:3000/api/fotoai/auth/me', { headers: { cookie: cookieFor(TOKEN_ALICE) } }));
  assert.equal((await me.json()).id, ALICE);
});

// ----- browser link parsing -------------------------------------------

test('link parsing: fragment session, token_hash query, GoTrue error fragment, and nothing', () => {
  assert.deepEqual(parseFotoaiLinkToken('#access_token=a.b.c&refresh_token=r1&expires_in=3600&token_type=bearer&type=recovery', ''), {
    kind: 'session', accessToken: 'a.b.c', refreshToken: 'r1', expiresIn: '3600', type: 'recovery',
  });
  assert.deepEqual(parseFotoaiLinkToken('', '?token_hash=abc&type=email'), { kind: 'hash', tokenHash: 'abc', type: 'email' });
  assert.deepEqual(parseFotoaiLinkToken('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', ''), { kind: 'error', code: 'otp_expired' });
  assert.deepEqual(parseFotoaiLinkToken('', ''), { kind: 'none' });
});

// ----- HTTP client (GoTrue wire format) --------------------------------

test('supabase HTTP: GoTrue email-flow requests use the documented paths, bodies, and credentials', async () => {
  const seen: Array<{ url: string; method?: string; headers: Headers; body: any }> = [];
  const replies: Response[] = [
    new Response('{}', { status: 200 }),
    new Response('{}', { status: 200 }),
    Response.json({ access_token: 'at', refresh_token: 'rt', expires_in: 1800, user: { id: ALICE } }),
    new Response('{}', { status: 200 }),
    Response.json({ id: ALICE }),
  ];
  const client = createFotoaiSupabaseClient(TEST_ENV, async (input, init) => {
    seen.push({ url: input, method: init?.method, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null });
    return replies.shift()!;
  });
  await client.requestPasswordRecovery('a@test.invalid', 'https://myfoto.topues.com/reset-password');
  await client.resendSignupConfirmation('a@test.invalid', 'https://myfoto.topues.com/verify-email/confirm');
  const session = await client.verifyTokenHash('recovery', 'th');
  await client.updateUserPassword('at', 'new-password');
  await client.signUpWithRedirect('a@test.invalid', 'pw-long-enough', 'A', 'https://myfoto.topues.com/verify-email/confirm');

  const base = TEST_ENV.supabaseUrl;
  assert.deepEqual(seen.map((call) => [call.method, call.url]), [
    ['POST', `${base}/auth/v1/recover?redirect_to=https%3A%2F%2Fmyfoto.topues.com%2Freset-password`],
    ['POST', `${base}/auth/v1/resend?redirect_to=https%3A%2F%2Fmyfoto.topues.com%2Fverify-email%2Fconfirm`],
    ['POST', `${base}/auth/v1/verify`],
    ['PUT', `${base}/auth/v1/user`],
    ['POST', `${base}/auth/v1/signup?redirect_to=https%3A%2F%2Fmyfoto.topues.com%2Fverify-email%2Fconfirm`],
  ]);
  assert.deepEqual(seen[0].body, { email: 'a@test.invalid' });
  assert.deepEqual(seen[1].body, { type: 'signup', email: 'a@test.invalid' });
  assert.deepEqual(seen[2].body, { type: 'recovery', token_hash: 'th' });
  assert.deepEqual(seen[3].body, { password: 'new-password' });
  assert.equal(seen[3].headers.get('Authorization'), 'Bearer at');
  assert.ok(seen.every((call) => call.headers.get('apikey') === TEST_ENV.anonKey), 'never the service role key');
  assert.deepEqual(session, { userId: ALICE, accessToken: 'at', refreshToken: 'rt', expiresIn: 1800 });
});

test('supabase HTTP: GoTrue email-flow errors map to 401/400/502 and never carry the address or body', async () => {
  const reply = (status: number, body: unknown) => async () => Response.json(body, { status });
  const echo = { msg: 'a@test.invalid is rate limited', error_code: 'over_email_send_rate_limit' };
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(429, echo)).requestPasswordRecovery('a@test.invalid', 'x'), (err: any) => {
    assert.ok(err instanceof FotoaiUpstreamError);
    assert.equal(err.upstreamStatus, 429);
    assert.doesNotMatch(err.message, /a@test\.invalid|rate limited/);
    return true;
  });
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(500, echo)).resendSignupConfirmation('a@test.invalid', 'x'), (err: any) => {
    assert.doesNotMatch(err.message, /a@test\.invalid/);
    return true;
  });
  for (const status of [400, 403, 404, 422]) {
    await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(status, { error_code: 'otp_expired' })).verifyTokenHash('email', 'th'), (err: any) => err.status === 401);
  }
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(401, {})).updateUserPassword('at', 'pw'), (err: any) => err.status === 401);
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(422, { error_code: 'same_password', msg: 'x' })).updateUserPassword('at', 'pw'), (err: any) => (
    err.status === 400 && err.message === 'New password must be different from the old password'
  ));
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(422, { error_code: 'weak_password' })).updateUserPassword('at', 'pw'), (err: any) => (
    err.status === 400 && err.message === 'Password is too weak'
  ));
  await assert.rejects(createFotoaiSupabaseClient(TEST_ENV, reply(503, {})).updateUserPassword('at', 'pw'), (err: any) => err.status === 502);
});
