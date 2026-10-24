// FotoAI session cookies. Separate names from the legacy cookie (foto_session)
// so an old cookie never opens a FotoAI session.
//
// The browser never sees the token: cookies are HttpOnly and only the server
// forwards them to Supabase.

export const FOTOAI_SESSION_COOKIE = 'fotoai_session';
export const FOTOAI_REFRESH_COOKIE = 'fotoai_refresh';

/** Reads one cookie value from a raw Cookie header. Returns null if absent. */
export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (raw === '') return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export interface CookieOptions {
  secure: boolean;
  /** Seconds. 0 clears the cookie. */
  maxAge: number;
}

/** Serializes a Set-Cookie header value. Always HttpOnly, Path=/, SameSite=Lax. */
export function serializeSessionCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(name: string, secure: boolean): string {
  return serializeSessionCookie(name, '', { secure, maxAge: 0 });
}
