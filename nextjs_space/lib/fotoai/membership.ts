// FotoAI membership boundary.
//
// Identity comes ONLY from the server-side session cookie, verified against
// Supabase Auth. A userId supplied by the browser (query, body, form) is an
// error, never an input. Every FotoAI route calls resolvePrincipal() first and
// then assertNoBrowserIdentity() on whatever the client sent.

import { FotoaiAuthError, FotoaiValidationError } from './errors.ts';
import { isUuid } from './object-keys.ts';
import { FOTOAI_SESSION_COOKIE, readCookieValue } from './session-cookie.ts';

export interface VerifiedUser {
  id: string;
  email: string | null;
  name?: string | null;
}

/** Anything that can turn an access token into a verified user (Supabase Auth). */
export interface IdentityVerifier {
  getUser(accessToken: string): Promise<VerifiedUser | null>;
}

export interface FotoaiPrincipal {
  /** auth.users.id of the session owner. The only user id FotoAI code may use. */
  userId: string;
  email: string | null;
  name: string | null;
  /** The session's access token, forwarded to PostgREST/Storage so RLS applies. */
  accessToken: string;
}

const MAX_TOKEN_LENGTH = 8192;
const MAX_DISPLAY_NAME_LENGTH = 120;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

export function sanitizeAuthName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const safe = value.replace(CONTROL_CHARACTERS, '').trim();
  if (!safe || safe.length > MAX_DISPLAY_NAME_LENGTH) return null;
  return safe;
}

/**
 * Resolves the principal from the raw Cookie header. Throws FotoaiAuthError
 * (401) when there is no cookie, the token is malformed, or Supabase rejects it.
 */
export async function resolvePrincipal(
  cookieHeader: string | null | undefined,
  verifier: IdentityVerifier,
): Promise<FotoaiPrincipal> {
  const token = readCookieValue(cookieHeader, FOTOAI_SESSION_COOKIE);
  if (!token) {
    throw new FotoaiAuthError('No FotoAI session');
  }
  if (token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
    throw new FotoaiAuthError('Malformed session token');
  }

  const user = await verifier.getUser(token);
  if (!user || !isUuid(user.id)) {
    throw new FotoaiAuthError('Session is not valid');
  }

  return {
    userId: user.id.toLowerCase(),
    email: user.email ?? null,
    name: sanitizeAuthName(user.name),
    accessToken: token,
  };
}

const IDENTITY_FIELDS = ['userId', 'user_id', 'userid', 'ownerId', 'owner_id'];

/**
 * Rejects client input that tries to name a user. Accepts a parsed JSON body,
 * URLSearchParams, or FormData. Throws FotoaiValidationError (400).
 */
export function assertNoBrowserIdentity(
  input: Record<string, unknown> | URLSearchParams | FormData | null | undefined,
): void {
  if (!input) return;

  let keys: string[];
  if (input instanceof URLSearchParams || input instanceof FormData) {
    keys = Array.from(input.keys());
  } else if (typeof input === 'object') {
    keys = Object.keys(input);
  } else {
    return;
  }

  const offending = keys.find((k) => IDENTITY_FIELDS.includes(k));
  if (offending) {
    throw new FotoaiValidationError(
      `"${offending}" must not be sent by the client; identity comes from the session`,
    );
  }
}
