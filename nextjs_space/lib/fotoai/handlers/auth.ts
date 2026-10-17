// FotoAI auth handlers: login, logout, me, register, and the email flows
// (forgot-password, reset-password, verify-email, resend-verification) on
// Supabase Auth (GoTrue).
//
// Cookies are HttpOnly and only forwarded by the server. Access tokens expire
// (Supabase default 1 h). Refresh is not implemented in this build; an expired
// session returns 401 and the client signs in again. See the build report.
//
// Email links: GoTrue's /verify endpoint redirects to our page with the session
// in the URL fragment. The page reads it in the browser and POSTs it here. A
// `tokenHash` form (POST /auth/v1/verify) is also accepted for custom templates.
// Tokens are never logged and never echoed back.

import { FotoaiAuthError, FotoaiUpstreamError, FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { isUuid } from '../object-keys.ts';
import { createAccountSeedRepo } from '../repo-account-seed.ts';
import {
  FOTOAI_REFRESH_COOKIE,
  FOTOAI_SESSION_COOKIE,
  clearSessionCookie,
  readCookieValue,
  serializeSessionCookie,
} from '../session-cookie.ts';
import type { FotoaiOtpType, PasswordSession } from '../supabase-http.ts';
import { type DepsProvider, type FotoaiDeps, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Origins the auth emails may link back to. The request origin is used when it
 * is listed; anything else (proxy-internal host, spoofed Host header) falls
 * back to the first entry, the production site. GoTrue's own redirect
 * allow-list must contain the same `<origin>/reset-password` and
 * `<origin>/verify-email/confirm` URLs.
 */
export const FOTOAI_AUTH_REDIRECT_ORIGINS = [
  'https://myfoto.topues.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export const FOTOAI_RESET_PATH = '/reset-password';
export const FOTOAI_CONFIRM_PATH = '/verify-email/confirm';

const GENERIC_RESET_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';
const GENERIC_RESEND_MESSAGE = 'If an unconfirmed account with that email exists, a new verification link has been sent.';
const MAX_TOKEN_LENGTH = 8192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TYPES = new Set<FotoaiOtpType>(['signup', 'email']);

export function authRedirectOrigin(request: Request): string {
  let origin = '';
  try {
    origin = new URL(request.url).origin;
  } catch {
    // fall back below
  }
  const allowed: readonly string[] = FOTOAI_AUTH_REDIRECT_ORIGINS;
  return allowed.includes(origin) ? origin : FOTOAI_AUTH_REDIRECT_ORIGINS[0];
}

/** A cross-site HTML form cannot send application/json without a CORS preflight. */
function requireJsonContentType(request: Request): void {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new FotoaiValidationError('Content-Type must be application/json');
}

function assertFields(body: Record<string, unknown>, allowed: string[]): void {
  const unexpected = Object.keys(body).find((key) => !allowed.includes(key));
  if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);
}

function requireEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) throw new FotoaiValidationError('A valid email is required');
  return email;
}

function optionalToken(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TOKEN_LENGTH || /\s/.test(value)) {
    throw new FotoaiValidationError(`${field} is malformed`);
  }
  return value;
}

/** Exactly one of accessToken / tokenHash. */
function requireLinkToken(body: Record<string, unknown>): { accessToken: string } | { tokenHash: string } {
  const accessToken = optionalToken(body.accessToken, 'accessToken');
  const tokenHash = optionalToken(body.tokenHash, 'tokenHash');
  if (accessToken && !tokenHash) return { accessToken };
  if (tokenHash && !accessToken) return { tokenHash };
  throw new FotoaiValidationError('Send exactly one of accessToken or tokenHash');
}

function requireNewPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) throw new FotoaiValidationError('Password must be at least 8 characters');
  // GoTrue (bcrypt) rejects passwords over 72 bytes.
  if (new TextEncoder().encode(value).byteLength > 72) throw new FotoaiValidationError('Password must be at most 72 bytes');
  return value;
}

function clampExpiresIn(value: unknown): number {
  if (value === undefined || value === null) return 3600;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) throw new FotoaiValidationError('expiresIn is malformed');
  return Math.min(Math.max(n, 60), 60 * 60 * 24);
}

/** Proves an access token from an email link and returns its owner id. */
async function verifiedUserId(deps: FotoaiDeps, accessToken: string): Promise<string> {
  const user = await deps.client.getUser(accessToken);
  if (!user || !isUuid(user.id)) throw new FotoaiAuthError('Link is invalid or has expired');
  return user.id.toLowerCase();
}

/** Starts an email-sending call without waiting, so response time does not reveal whether the account exists. */
function sendInBackground(deps: FotoaiDeps, label: string, task: () => Promise<void>): void {
  void (async () => {
    try {
      await task();
    } catch (err) {
      const status = err instanceof FotoaiUpstreamError ? err.upstreamStatus : undefined;
      deps.log?.(status === 429 ? 'warn' : 'error', `${label} failed`, { status });
    }
  })();
}

/** Legacy register seeded preferences + progress; do it once a session exists. Never blocks sign-in. */
async function seedAccountDefaults(deps: FotoaiDeps, session: PasswordSession): Promise<void> {
  try {
    await createAccountSeedRepo(deps.client).ensureAccountDefaults({ userId: session.userId, accessToken: session.accessToken });
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? (err as { code?: unknown }).code : undefined;
    deps.log?.('warn', 'Account default rows could not be created', { code });
  }
}

function sessionHeaders(session: PasswordSession, secure: boolean): Headers {
  const headers = new Headers();
  headers.append('Set-Cookie', serializeSessionCookie(FOTOAI_SESSION_COOKIE, session.accessToken, { secure, maxAge: session.expiresIn }));
  headers.append('Set-Cookie', serializeSessionCookie(FOTOAI_REFRESH_COOKIE, session.refreshToken, { secure, maxAge: REFRESH_COOKIE_MAX_AGE }));
  return headers;
}

function clearedHeaders(secure: boolean): Headers {
  const headers = new Headers();
  headers.append('Set-Cookie', clearSessionCookie(FOTOAI_SESSION_COOKIE, secure));
  headers.append('Set-Cookie', clearSessionCookie(FOTOAI_REFRESH_COOKIE, secure));
  return headers;
}

function requireCredentials(body: Record<string, unknown>): { email: string; password: string } {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) throw new FotoaiValidationError('Email and password are required');
  if (email.length > 254 || password.length > 1024) throw new FotoaiValidationError('Credentials are too long');
  return { email, password };
}

export function createAuthHandlers(provider: DepsProvider) {
  return {
    /** POST /api/fotoai/auth/login */
    login: withFotoai(provider, async (request, deps) => {
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const { email, password } = requireCredentials(body);
      const session = await deps.client.signInWithPassword(email, password);
      return json({ success: true, userId: session.userId }, { headers: sessionHeaders(session, deps.env.cookieSecure) });
    }),

    /** POST /api/fotoai/auth/logout */
    logout: withFotoai(provider, async (request, deps) => {
      const token = readCookieValue(request.headers.get('cookie'), FOTOAI_SESSION_COOKIE);
      if (token) {
        try {
          await deps.client.signOut(token);
        } catch (err) {
          deps.log?.('warn', `Sign-out upstream call failed: ${(err as Error).message}`);
        }
      }
      return json({ success: true }, { headers: clearedHeaders(deps.env.cookieSecure) });
    }),

    /** GET /api/fotoai/auth/me */
    me: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      return json({ id: principal.userId, email: principal.email, name: principal.name });
    }),

    /** POST /api/fotoai/auth/register */
    register: withFotoai(provider, async (request, deps) => {
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const { email, password } = requireCredentials(body);
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
      if (!name) throw new FotoaiValidationError('Name is required');

      const redirectTo = `${authRedirectOrigin(request)}${FOTOAI_CONFIRM_PATH}`;
      const { userId, session } = await deps.client.signUpWithRedirect(email, password, name, redirectTo);
      if (!session) {
        // Shared Auth may require email confirmation. No session yet; rows are seeded at verify-email.
        return json({ success: true, userId, confirmationRequired: true }, { status: 202 });
      }
      await seedAccountDefaults(deps, session);
      return json({ success: true, userId: session.userId, confirmationRequired: false }, {
        status: 201,
        headers: sessionHeaders(session, deps.env.cookieSecure),
      });
    }),

    /** POST /api/fotoai/auth/forgot-password {email} -> always the same 200. */
    forgotPassword: withFotoai(provider, async (request, deps) => {
      requireJsonContentType(request);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      assertFields(body, ['email']);
      const email = requireEmail(body.email);
      const redirectTo = `${authRedirectOrigin(request)}${FOTOAI_RESET_PATH}`;
      sendInBackground(deps, 'Password recovery request', () => deps.client.requestPasswordRecovery(email, redirectTo));
      return json({ success: true, message: GENERIC_RESET_MESSAGE });
    }),

    /**
     * POST /api/fotoai/auth/reset-password {accessToken | tokenHash, password}
     * Sets the new password, then revokes the recovery session (GoTrue logout,
     * global scope) and clears any FotoAI cookies. The user signs in again.
     */
    resetPassword: withFotoai(provider, async (request, deps) => {
      requireJsonContentType(request);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      assertFields(body, ['accessToken', 'tokenHash', 'password']);
      const password = requireNewPassword(body.password);
      const link = requireLinkToken(body);

      let accessToken: string;
      if ('accessToken' in link) {
        await verifiedUserId(deps, link.accessToken);
        accessToken = link.accessToken;
      } else {
        accessToken = (await deps.client.verifyTokenHash('recovery', link.tokenHash)).accessToken;
      }
      await deps.client.updateUserPassword(accessToken, password);
      try {
        await deps.client.signOut(accessToken);
      } catch (err) {
        deps.log?.('warn', 'Recovery session sign-out failed', { status: err instanceof FotoaiUpstreamError ? err.upstreamStatus : undefined });
      }
      return json({ success: true, message: 'Password has been reset successfully.' }, { headers: clearedHeaders(deps.env.cookieSecure) });
    }),

    /**
     * POST /api/fotoai/auth/verify-email
     *   {accessToken, refreshToken, expiresIn?}   (fragment from GoTrue's redirect)
     *   {tokenHash, type?: 'signup' | 'email'}    (custom template)
     * Sets the FotoAI session cookies exactly like login and seeds default rows.
     */
    verifyEmail: withFotoai(provider, async (request, deps) => {
      requireJsonContentType(request);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      assertFields(body, ['accessToken', 'refreshToken', 'expiresIn', 'tokenHash', 'type']);
      const link = requireLinkToken(body);

      let session: PasswordSession;
      if ('accessToken' in link) {
        if (body.type !== undefined) throw new FotoaiValidationError('type is only used with tokenHash');
        const refreshToken = optionalToken(body.refreshToken, 'refreshToken');
        if (!refreshToken) throw new FotoaiValidationError('refreshToken is required with accessToken');
        const expiresIn = clampExpiresIn(body.expiresIn);
        const userId = await verifiedUserId(deps, link.accessToken);
        session = { userId, accessToken: link.accessToken, refreshToken, expiresIn };
      } else {
        if (body.refreshToken !== undefined || body.expiresIn !== undefined) {
          throw new FotoaiValidationError('refreshToken and expiresIn are only used with accessToken');
        }
        const type = body.type === undefined ? 'email' : body.type;
        if (typeof type !== 'string' || !VERIFY_TYPES.has(type as FotoaiOtpType)) {
          throw new FotoaiValidationError('type must be "signup" or "email"');
        }
        session = await deps.client.verifyTokenHash(type as FotoaiOtpType, link.tokenHash);
        if (!isUuid(session.userId)) throw new FotoaiAuthError('Link is invalid or has expired');
        session = { ...session, userId: session.userId.toLowerCase() };
      }

      await seedAccountDefaults(deps, session);
      return json({ success: true, userId: session.userId }, { headers: sessionHeaders(session, deps.env.cookieSecure) });
    }),

    /** POST /api/fotoai/auth/resend-verification {email} -> always the same 200. */
    resendVerification: withFotoai(provider, async (request, deps) => {
      requireJsonContentType(request);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      assertFields(body, ['email']);
      const email = requireEmail(body.email);
      const redirectTo = `${authRedirectOrigin(request)}${FOTOAI_CONFIRM_PATH}`;
      sendInBackground(deps, 'Confirmation resend', () => deps.client.resendSignupConfirmation(email, redirectTo));
      return json({ success: true, message: GENERIC_RESEND_MESSAGE });
    }),
  };
}
