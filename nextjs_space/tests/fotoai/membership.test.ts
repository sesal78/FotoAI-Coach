import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiAuthError, FotoaiValidationError } from '../../lib/fotoai/errors.ts';
import { assertNoBrowserIdentity, resolvePrincipal } from '../../lib/fotoai/membership.ts';
import { readCookieValue, serializeSessionCookie } from '../../lib/fotoai/session-cookie.ts';
import { ALICE, TOKEN_ALICE, createFakeSupabase } from './helpers/fake-supabase.ts';

test('membership: no cookie -> 401', async () => {
  await assert.rejects(resolvePrincipal(null, createFakeSupabase()), FotoaiAuthError);
  await assert.rejects(resolvePrincipal('', createFakeSupabase()), FotoaiAuthError);
  await assert.rejects(resolvePrincipal('foto_session=appwrite-cookie-only', createFakeSupabase()), FotoaiAuthError);
});

test('membership: unknown or malformed token -> 401', async () => {
  const client = createFakeSupabase();
  await assert.rejects(resolvePrincipal('fotoai_session=not-a-real-token', client), FotoaiAuthError);
  await assert.rejects(resolvePrincipal('fotoai_session=has space', client), FotoaiAuthError);
  await assert.rejects(resolvePrincipal(`fotoai_session=${'x'.repeat(9000)}`, client), FotoaiAuthError);
});

test('membership: valid token -> principal derived from Supabase Auth, not from the cookie text', async () => {
  const principal = await resolvePrincipal(`other=1; fotoai_session=${TOKEN_ALICE}; foo=bar`, createFakeSupabase());
  assert.equal(principal.userId, ALICE);
  assert.equal(principal.email, 'alice@test.invalid');
  assert.equal(principal.accessToken, TOKEN_ALICE);
});

test('membership: verifier returning a non-UUID id is rejected', async () => {
  const verifier = { getUser: async () => ({ id: 'admin', email: null }) };
  await assert.rejects(resolvePrincipal(`fotoai_session=${TOKEN_ALICE}`, verifier), FotoaiAuthError);
});

test('membership: client-supplied identity fields are rejected everywhere', () => {
  assert.throws(() => assertNoBrowserIdentity({ userId: ALICE }), FotoaiValidationError);
  assert.throws(() => assertNoBrowserIdentity({ user_id: ALICE }), FotoaiValidationError);
  assert.throws(() => assertNoBrowserIdentity({ ownerId: ALICE }), FotoaiValidationError);
  assert.throws(() => assertNoBrowserIdentity(new URLSearchParams('userId=x')), FotoaiValidationError);
  const form = new FormData();
  form.set('user_id', ALICE);
  assert.throws(() => assertNoBrowserIdentity(form), FotoaiValidationError);

  assert.doesNotThrow(() => assertNoBrowserIdentity({ challengeId: 'x', notes: 'ok' }));
  assert.doesNotThrow(() => assertNoBrowserIdentity(new URLSearchParams('limit=5')));
  assert.doesNotThrow(() => assertNoBrowserIdentity(null));
});

test('session-cookie: parse and serialise', () => {
  assert.equal(readCookieValue('a=1; fotoai_session=abc%20def; b=2', 'fotoai_session'), 'abc def');
  assert.equal(readCookieValue('fotoai_session=', 'fotoai_session'), null);
  assert.equal(readCookieValue('fotoai_sessionx=1', 'fotoai_session'), null);
  const header = serializeSessionCookie('fotoai_session', 'tok', { secure: true, maxAge: 3600 });
  assert.match(header, /^fotoai_session=tok; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure$/);
});
