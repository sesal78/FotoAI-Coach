// FotoAI auth handlers: login, logout, me, register (Supabase Auth).
//
// Cookies are HttpOnly and only forwarded by the server. Access tokens expire
// (Supabase default 1 h). Refresh is not implemented in this build; an expired
// session returns 401 and the client signs in again. See the build report.

import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import {
  FOTOAI_REFRESH_COOKIE,
  FOTOAI_SESSION_COOKIE,
  clearSessionCookie,
  readCookieValue,
  serializeSessionCookie,
} from '../session-cookie.ts';
import type { PasswordSession } from '../supabase-http.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

      const { userId, session } = await deps.client.signUp(email, password, name);
      if (!session) {
        // Shared Auth may require email confirmation. No session yet.
        return json({ success: true, userId, confirmationRequired: true }, { status: 202 });
      }
      return json({ success: true, userId: session.userId, confirmationRequired: false }, {
        status: 201,
        headers: sessionHeaders(session, deps.env.cookieSecure),
      });
    }),
  };
}
