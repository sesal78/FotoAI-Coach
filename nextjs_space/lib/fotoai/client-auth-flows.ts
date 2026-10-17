// Browser client for the FotoAI email flows (forgot/reset password, email
// verification). Link tokens are read from the URL by the page, sent once in a
// JSON body, and never stored or logged.

import { FotoaiClientError, type FotoaiFetch } from './client.ts';

interface FotoaiErrorBody {
  error?: string;
  code?: string;
}

async function postJson<T>(path: string, value: Record<string, unknown>, fetcher: FotoaiFetch): Promise<T> {
  const response = await fetcher(path, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  const data = await response.json().catch(() => ({})) as T & FotoaiErrorBody;
  if (!response.ok) {
    throw new FotoaiClientError(
      data.error || `FotoAI request failed (${response.status})`,
      response.status,
      data.code,
    );
  }
  return data;
}

/** What an auth email link carried, parsed from the URL fragment or query. */
export type FotoaiLinkToken =
  | { kind: 'session'; accessToken: string; refreshToken: string | null; expiresIn: string | null; type: string | null }
  | { kind: 'hash'; tokenHash: string; type: string | null }
  | { kind: 'error'; code: string }
  | { kind: 'none' };

/**
 * GoTrue redirects with `#access_token=...&refresh_token=...&type=recovery`
 * (or `#error=...&error_code=otp_expired`). A custom template may send
 * `?token_hash=...&type=...` instead.
 */
export function parseFotoaiLinkToken(hash: string, search: string): FotoaiLinkToken {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const error = fragment.get('error_code') || fragment.get('error') || query.get('error_code') || query.get('error');
  if (error) return { kind: 'error', code: error };
  const accessToken = fragment.get('access_token');
  if (accessToken) {
    return {
      kind: 'session',
      accessToken,
      refreshToken: fragment.get('refresh_token'),
      expiresIn: fragment.get('expires_in'),
      type: fragment.get('type'),
    };
  }
  const tokenHash = query.get('token_hash');
  if (tokenHash) return { kind: 'hash', tokenHash, type: query.get('type') };
  return { kind: 'none' };
}

export async function requestFotoaiPasswordReset(email: string, fetcher: FotoaiFetch = fetch): Promise<void> {
  await postJson('/api/fotoai/auth/forgot-password', { email }, fetcher);
}

export async function resetFotoaiPassword(
  token: { accessToken: string } | { tokenHash: string },
  password: string,
  fetcher: FotoaiFetch = fetch,
): Promise<void> {
  await postJson('/api/fotoai/auth/reset-password', { ...token, password }, fetcher);
}

/** Confirms the email link only. No session is created: the user signs in next. */
export async function verifyFotoaiEmail(
  token:
    | { accessToken: string }
    | { tokenHash: string; type?: 'signup' | 'email' },
  fetcher: FotoaiFetch = fetch,
): Promise<void> {
  await postJson('/api/fotoai/auth/verify-email', token as Record<string, unknown>, fetcher);
}

export async function resendFotoaiVerification(email: string, fetcher: FotoaiFetch = fetch): Promise<void> {
  await postJson('/api/fotoai/auth/resend-verification', { email }, fetcher);
}
