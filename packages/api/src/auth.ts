// v2 identity: the access token comes from `Authorization: Bearer <token>` (mobile) or, if
// there is no Authorization header, from the fotoai_session cookie (web). The cookie path
// does no session refresh: the web keeps using /api/fotoai/* (which refreshes) until phase 4.
// Identity always comes from the verified token, never from the request body or query.

import { ApiError, type V2Deps } from './handler.ts';

export interface Principal {
  userId: string;
  email: string | null;
  accessToken: string;
}

const SESSION_COOKIE = 'fotoai_session'; // same name as nextjs_space/lib/fotoai/session-cookie.ts
const MAX_TOKEN_LENGTH = 8192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTITY_KEYS = ['userId', 'user_id', 'userid', 'ownerId', 'owner_id'] as const;

const notAuthenticated = () => new ApiError('unauthenticated', 'Not authenticated');

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function tokenFrom(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    const match = /^bearer (.*)$/i.exec(authorization);
    if (!match) throw notAuthenticated();
    return match[1] ?? '';
  }
  return cookieValue(request.headers.get('cookie'), SESSION_COOKIE);
}

export async function requirePrincipal(request: Request, deps: V2Deps): Promise<Principal> {
  const token = tokenFrom(request);
  if (!token || /\s/.test(token) || token.length > MAX_TOKEN_LENGTH) throw notAuthenticated();
  const user = await deps.verifyToken(token);
  if (!user || !UUID.test(user.userId)) throw notAuthenticated();
  return { userId: user.userId.toLowerCase(), email: user.email, accessToken: token };
}

export function rejectBrowserIdentity(input: URLSearchParams | Record<string, unknown> | null | undefined): void {
  if (!input) return;
  const present =
    input instanceof URLSearchParams
      ? IDENTITY_KEYS.some((key) => input.has(key))
      : IDENTITY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (present) throw new ApiError('validation', 'Identity comes from your session, not from the request');
}
