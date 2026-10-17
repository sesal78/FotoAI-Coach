// Keeps FotoAI users signed in.
//
// The access cookie lives as long as the Supabase access token (about an hour).
// Before a request is handled, an expired or nearly expired access token is
// exchanged for a new session using the HttpOnly refresh cookie. The handler
// then sees the new token, and the response sets both cookies again. A
// rejected refresh token clears both cookies, so the user is asked to sign in.

import { createHash } from 'node:crypto';

import { FotoaiAuthError } from './errors.ts';
import {
  FOTOAI_REFRESH_COOKIE,
  FOTOAI_SESSION_COOKIE,
  clearSessionCookie,
  readCookieValue,
  serializeSessionCookie,
} from './session-cookie.ts';
import type { FotoaiSupabaseClient, PasswordSession } from './supabase-http.ts';

export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const REFRESH_MARGIN_SECONDS = 60;
// While a refresh is in flight its result is shared; once it succeeds, it is shared until the
// new access token expires, because slow handlers (portfolio, critiques, chat) deliver the new
// cookies late and the browser keeps sending the old refresh token meanwhile.
const IN_FLIGHT_MS = 5 * 60_000;

// Single-flight per process: refresh tokens rotate, and GoTrue revokes a session when an
// already-used refresh token is presented again after its short reuse window. Parallel or
// slow requests (LLM and upload calls) that carry the same old token must therefore share
// one refresh call and its result instead of each calling GoTrue.
const sharedRefresh = new Map<string, { promise: Promise<PasswordSession>; until: number }>();

function refreshOnce(client: Pick<FotoaiSupabaseClient, 'refreshSession'>, refreshToken: string): Promise<PasswordSession> {
  const now = Date.now();
  for (const [key, entry] of sharedRefresh) if (entry.until < now) sharedRefresh.delete(key);
  const key = createHash('sha256').update(refreshToken).digest('hex');
  const existing = sharedRefresh.get(key);
  if (existing) return existing.promise;
  const promise = client.refreshSession(refreshToken);
  const entry = { promise, until: now + IN_FLIGHT_MS };
  sharedRefresh.set(key, entry);
  promise.then(
    (session) => { entry.until = Date.now() + Math.max(IN_FLIGHT_MS, (session.expiresIn - REFRESH_MARGIN_SECONDS) * 1000); },
    // A failed refresh is never shared: drop it so a later attempt can succeed.
    () => sharedRefresh.delete(key),
  );
  return promise;
}

/** Exchanges a refresh token for a session, sharing the result with concurrent callers. */
export function exchangeRefreshToken(client: Pick<FotoaiSupabaseClient, 'refreshSession'>, refreshToken: string): Promise<PasswordSession> {
  return refreshOnce(client, refreshToken);
}

/** Drops the shared result for a refresh token (logout). */
export function forgetRefreshToken(refreshToken: string): void {
  sharedRefresh.delete(createHash('sha256').update(refreshToken).digest('hex'));
}

/** Test hook: forget shared refresh results between tests. */
export function resetRefreshCacheForTests(): void {
  sharedRefresh.clear();
}

/** True when there is no access token or its JWT `exp` is within the margin. Unknown shapes are left to Supabase. */
export function accessTokenNeedsRefresh(token: string | null, nowMs: number = Date.now()): boolean {
  if (!token) return true;
  const payload = token.split('.')[1];
  if (!payload) return false;
  try {
    const exp = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))?.exp;
    return typeof exp === 'number' && exp * 1000 - nowMs < REFRESH_MARGIN_SECONDS * 1000;
  } catch {
    return false;
  }
}

export function sessionSetCookies(session: PasswordSession, secure: boolean): string[] {
  return [
    serializeSessionCookie(FOTOAI_SESSION_COOKIE, session.accessToken, { secure, maxAge: session.expiresIn }),
    serializeSessionCookie(FOTOAI_REFRESH_COOKIE, session.refreshToken, { secure, maxAge: REFRESH_COOKIE_MAX_AGE }),
  ];
}

function withCookies(cookieHeader: string, replacements: Record<string, string>): string {
  const kept = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !Object.keys(replacements).includes(part.slice(0, part.indexOf('=')).trim()));
  for (const [name, value] of Object.entries(replacements)) kept.push(`${name}=${encodeURIComponent(value)}`);
  return kept.join('; ');
}

/**
 * Returns the request to handle (with the new access token when refreshed) and
 * the Set-Cookie values to add to the response. Network or upstream failures
 * leave the request unchanged and set no cookies.
 */
export async function refreshSessionIfNeeded(
  request: Request,
  client: Pick<FotoaiSupabaseClient, 'refreshSession'>,
  secure: boolean,
): Promise<{ request: Request; setCookies: string[] }> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const access = readCookieValue(cookieHeader, FOTOAI_SESSION_COOKIE);
  const refresh = readCookieValue(cookieHeader, FOTOAI_REFRESH_COOKIE);
  if (!refresh || !accessTokenNeedsRefresh(access)) return { request, setCookies: [] };

  try {
    const session = await refreshOnce(client, refresh);
    const headers = new Headers(request.headers);
    headers.set('cookie', withCookies(cookieHeader, {
      [FOTOAI_SESSION_COOKIE]: session.accessToken,
      [FOTOAI_REFRESH_COOKIE]: session.refreshToken,
    }));
    // duplex is required by Node when the copied request has a streaming body.
    const init = { headers, duplex: 'half' } as RequestInit;
    return { request: new Request(request, init), setCookies: sessionSetCookies(session, secure) };
  } catch (err) {
    if (err instanceof FotoaiAuthError) {
      return {
        request,
        setCookies: [clearSessionCookie(FOTOAI_SESSION_COOKIE, secure), clearSessionCookie(FOTOAI_REFRESH_COOKIE, secure)],
      };
    }
    return { request, setCookies: [] };
  }
}

/** Adds Set-Cookie values to a response, copying it when its headers are immutable. */
export function appendSetCookies(response: Response, setCookies: string[]): Response {
  if (setCookies.length === 0) return response;
  try {
    for (const c of setCookies) response.headers.append('Set-Cookie', c);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const c of setCookies) headers.append('Set-Cookie', c);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}
