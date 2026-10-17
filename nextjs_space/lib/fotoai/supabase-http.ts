// Minimal Supabase HTTP client (GoTrue, PostgREST, Storage) built on fetch.
//
// Why not @supabase/supabase-js: the package is not installed and this build
// may not add dependencies. The surface here is small and every call is
// explicit about which credential it uses:
//   * user calls  -> apikey: anon key,          Authorization: Bearer <user token>  (RLS applies)
//   * server calls-> apikey: service role key,  Authorization: Bearer <service key> (bypasses RLS)
// Server calls are limited to signing, deleting, uploading under a server-built
// owner-prefixed key, XP awards, and cron jobs. Every request-path caller must
// have proven ownership first (see photos.ts, xp.ts).

import type { FotoaiEnv } from './env.ts';
import {
  FotoaiAuthError,
  FotoaiForbiddenError,
  FotoaiNotFoundError,
  FotoaiUpstreamError,
  FotoaiValidationError,
} from './errors.ts';
import { sanitizeAuthName, type IdentityVerifier, type VerifiedUser } from './membership.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PasswordSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface FotoaiSupabaseClient extends IdentityVerifier {
  signInWithPassword(email: string, password: string): Promise<PasswordSession>;
  /** Exchanges a refresh token for a new session (the refresh token rotates). */
  refreshSession(refreshToken: string): Promise<PasswordSession>;
  signUp(email: string, password: string, name: string): Promise<{ userId: string | null; session: PasswordSession | null }>;
  signOut(accessToken: string): Promise<void>;
  /** Sign-up that tells GoTrue where the confirmation link should land (redirect_to). */
  signUpWithRedirect(email: string, password: string, name: string, redirectTo: string): Promise<{ userId: string | null; session: PasswordSession | null }>;
  /** POST /auth/v1/recover. Sends the reset email. Errors never carry the email or body. */
  requestPasswordRecovery(email: string, redirectTo: string): Promise<void>;
  /** POST /auth/v1/resend {type:'signup'}. Errors never carry the email or body. */
  resendSignupConfirmation(email: string, redirectTo: string): Promise<void>;
  /** POST /auth/v1/verify {type, token_hash}. Rejected or expired hash -> 401. */
  verifyTokenHash(type: FotoaiOtpType, tokenHash: string): Promise<PasswordSession>;
  /** PUT /auth/v1/user {password} with the user's token. Bad token -> 401, rejected password -> 400. */
  updateUserPassword(accessToken: string, password: string): Promise<void>;

  restSelect<T = Record<string, unknown>>(table: string, query: Record<string, string>, accessToken: string): Promise<T[]>;
  restInsert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>, accessToken: string): Promise<T>;
  restUpsert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>, onConflict: string, accessToken: string): Promise<T>;
  restUpdate<T = Record<string, unknown>>(table: string, query: Record<string, string>, patch: Record<string, unknown>, accessToken: string): Promise<T[]>;
  restDelete<T = Record<string, unknown>>(table: string, query: Record<string, string>, accessToken: string): Promise<T[]>;

  /** Uploads with the USER token so the Storage insert policy applies. */
  storageUpload(objectKey: string, bytes: Uint8Array, contentType: string, accessToken: string): Promise<void>;
  /** Server-only: signs with the service role. Caller must have checked ownership. */
  storageCreateSignedUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  /** Server-only: removes with the service role. Caller must have checked ownership. */
  storageRemove(objectKeys: string[]): Promise<void>;
  /**
   * Server-only: uploads with the service role. Used for photo kinds the Storage
   * insert policy does not cover; the caller builds the key from the session and
   * must assert its owner prefix first (photos.ts does).
   */
  storageUploadAsService(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void>;

  /** Server-only: calls one allow-listed SQL function with the service role. */
  serviceRpc<T = unknown>(fn: FotoaiServiceRpc, args: Record<string, unknown>): Promise<T>;
  /** Cron only: service-role table access across all users. */
  serviceSelect<T = Record<string, unknown>>(table: string, query: Record<string, string>): Promise<T[]>;
  serviceInsert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T>;
  serviceUpdate<T = Record<string, unknown>>(table: string, query: Record<string, string>, patch: Record<string, unknown>): Promise<T[]>;
  /** Cron only: one page of auth users (id, email, name). */
  adminListUsers(page: number, perPage: number): Promise<VerifiedUser[]>;
}

export type FotoaiOtpType = 'signup' | 'email' | 'recovery';

export const FOTOAI_SERVICE_RPCS = ['fotoai_award_skill_xp'] as const;
export type FotoaiServiceRpc = (typeof FOTOAI_SERVICE_RPCS)[number];

function assertTable(table: string): void {
  if (!/^fotoai_[a-z_]+$/.test(table)) {
    throw new FotoaiValidationError(`Refusing to query non-FotoAI table "${table}"`);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

/** Generic on purpose: GoTrue's text ("User already registered") would reveal which emails have accounts. */
export const SIGN_UP_REJECTED_MESSAGE = 'Sign-up could not be completed. Check your details and try again.';

/** A 400/422 from GoTrue sign-up. `detail` is for server logs only and never carries the email. */
export class FotoaiSignUpRejectedError extends FotoaiValidationError {
  readonly detail: { status: number; code: string };

  constructor(message: string, detail: { status: number; code: string }) {
    super(message);
    this.name = 'FotoaiSignUpRejectedError';
    this.detail = detail;
  }
}

async function signUpRejected(res: Response): Promise<FotoaiSignUpRejectedError> {
  let code = '';
  try {
    const body = (await res.json()) as { error_code?: unknown };
    code = typeof body.error_code === 'string' ? body.error_code.slice(0, 60) : '';
  } catch {
    // keep the generic message
  }
  // A weak password says nothing about whether the account exists.
  const message = code === 'weak_password' ? 'Password is too weak' : SIGN_UP_REJECTED_MESSAGE;
  return new FotoaiSignUpRejectedError(message, { status: res.status, code });
}

function mapStatus(res: Response, detail: string): never {
  if (res.status === 401) throw new FotoaiAuthError('Supabase rejected the session');
  if (res.status === 403) throw new FotoaiForbiddenError('Supabase denied the operation');
  if (res.status === 404) throw new FotoaiNotFoundError();
  throw new FotoaiUpstreamError(res.status, `Supabase error ${res.status}: ${detail}`);
}

export function createFotoaiSupabaseClient(env: FotoaiEnv, fetchImpl: FetchLike = fetch): FotoaiSupabaseClient {
  const base = env.supabaseUrl;

  const userHeaders = (accessToken: string, extra: Record<string, string> = {}) => ({
    apikey: env.anonKey,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  });
  const serviceHeaders = (extra: Record<string, string> = {}) => ({
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    ...extra,
  });

  const toQuery = (query: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) params.set(k, v);
    return params.toString();
  };

  return {
    async getUser(accessToken: string): Promise<VerifiedUser | null> {
      const res = await fetchImpl(`${base}/auth/v1/user`, { headers: userHeaders(accessToken) });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Auth user lookup failed: ${await readError(res)}`);
      const body = (await res.json()) as { id?: string; email?: string | null; user_metadata?: unknown };
      if (!body?.id) return null;
      const metadata = body.user_metadata && typeof body.user_metadata === 'object' && !Array.isArray(body.user_metadata)
        ? body.user_metadata as Record<string, unknown>
        : null;
      return { id: body.id, email: body.email ?? null, name: sanitizeAuthName(metadata?.name) };
    },

    async signInWithPassword(email, password) {
      const res = await fetchImpl(`${base}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new FotoaiAuthError('Invalid credentials');
      }
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Sign-in failed: ${await readError(res)}`);
      const body = (await res.json()) as {
        access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string };
      };
      if (!body.access_token || !body.refresh_token || !body.user?.id) {
        throw new FotoaiUpstreamError(res.status, 'Sign-in response lacked a session');
      }
      return {
        userId: body.user.id,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in ?? 3600,
      };
    },

    async signUp(email, password, name) {
      const res = await fetchImpl(`${base}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: { name } }),
      });
      if (res.status === 400 || res.status === 422) throw await signUpRejected(res);
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Sign-up failed: ${await readError(res)}`);
      const body = (await res.json()) as {
        id?: string; access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string };
      };
      const userId = body.user?.id ?? body.id ?? null;
      // With email confirmation enabled on the shared Auth, no session is returned.
      const session = body.access_token && body.refresh_token && userId
        ? { userId, accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in ?? 3600 }
        : null;
      return { userId, session };
    },

    async refreshSession(refreshToken) {
      const res = await fetchImpl(`${base}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new FotoaiAuthError('Refresh token rejected');
      }
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Session refresh failed: ${await readError(res)}`);
      const body = (await res.json()) as {
        access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string };
      };
      if (!body.access_token || !body.refresh_token || !body.user?.id) {
        throw new FotoaiUpstreamError(res.status, 'Refresh response lacked a session');
      }
      return {
        userId: body.user.id,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in ?? 3600,
      };
    },

    async signOut(accessToken) {
      const res = await fetchImpl(`${base}/auth/v1/logout`, { method: 'POST', headers: userHeaders(accessToken) });
      // 401/403/404 mean the session is already gone; that is fine for logout.
      if (!res.ok && ![401, 403, 404].includes(res.status)) {
        throw new FotoaiUpstreamError(res.status, `Sign-out failed: ${await readError(res)}`);
      }
    },

    async signUpWithRedirect(email, password, name, redirectTo) {
      const res = await fetchImpl(`${base}/auth/v1/signup?${toQuery({ redirect_to: redirectTo })}`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: { name } }),
      });
      if (res.status === 400 || res.status === 422) throw await signUpRejected(res);
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Sign-up failed: ${await readError(res)}`);
      const body = (await res.json()) as {
        id?: string; access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string };
      };
      const userId = body.user?.id ?? body.id ?? null;
      const session = body.access_token && body.refresh_token && userId
        ? { userId, accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in ?? 3600 }
        : null;
      return { userId, session };
    },

    async requestPasswordRecovery(email, redirectTo) {
      const res = await fetchImpl(`${base}/auth/v1/recover?${toQuery({ redirect_to: redirectTo })}`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Status only: the body may echo the address.
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Password recovery request failed (${res.status})`);
    },

    async resendSignupConfirmation(email, redirectTo) {
      const res = await fetchImpl(`${base}/auth/v1/resend?${toQuery({ redirect_to: redirectTo })}`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', email }),
      });
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Confirmation resend failed (${res.status})`);
    },

    async verifyTokenHash(type, tokenHash) {
      const res = await fetchImpl(`${base}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, token_hash: tokenHash }),
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new FotoaiAuthError('Link is invalid or has expired');
      }
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Token verification failed (${res.status})`);
      const body = (await res.json()) as {
        access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string };
      };
      if (!body.access_token || !body.refresh_token || !body.user?.id) {
        throw new FotoaiUpstreamError(res.status, 'Verification response lacked a session');
      }
      return {
        userId: body.user.id,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in ?? 3600,
      };
    },

    async updateUserPassword(accessToken, password) {
      const res = await fetchImpl(`${base}/auth/v1/user`, {
        method: 'PUT',
        headers: userHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ password }),
      });
      if (res.status === 401 || res.status === 403) throw new FotoaiAuthError('Link is invalid or has expired');
      if (res.status === 400 || res.status === 422) {
        let code = '';
        try {
          code = String(((await res.json()) as { error_code?: unknown }).error_code ?? '');
        } catch {
          // keep the generic message
        }
        if (code === 'same_password') throw new FotoaiValidationError('New password must be different from the old password');
        if (code === 'weak_password') throw new FotoaiValidationError('Password is too weak');
        throw new FotoaiValidationError('Password was rejected');
      }
      if (!res.ok) throw new FotoaiUpstreamError(res.status, `Password update failed (${res.status})`);
    },

    async restSelect(table, query, accessToken) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery(query)}`, {
        headers: userHeaders(accessToken, { Accept: 'application/json' }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any[];
    },

    async restInsert(table, row, accessToken) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}`, {
        method: 'POST',
        headers: userHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      const rows = (await res.json()) as any[];
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new FotoaiUpstreamError(res.status, 'Insert did not return exactly one row');
      }
      return rows[0];
    },

    async restUpsert(table, row, onConflict, accessToken) {
      assertTable(table);
      if (!/^[a-z_]+$/.test(onConflict)) throw new FotoaiValidationError('Invalid upsert conflict column');
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery({ on_conflict: onConflict })}`, {
        method: 'POST',
        headers: userHeaders(accessToken, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(row),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      const rows = (await res.json()) as any[];
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new FotoaiUpstreamError(res.status, 'Upsert did not return exactly one row');
      }
      return rows[0];
    },

    async restUpdate(table, query, patch, accessToken) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery(query)}`, {
        method: 'PATCH',
        headers: userHeaders(accessToken, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(patch),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any[];
    },

    async restDelete(table, query, accessToken) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery(query)}`, {
        method: 'DELETE',
        headers: userHeaders(accessToken, { Prefer: 'return=representation' }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any[];
    },

    async storageUpload(objectKey, bytes, contentType, accessToken) {
      const res = await fetchImpl(`${base}/storage/v1/object/${env.bucket}/${objectKey}`, {
        method: 'POST',
        headers: userHeaders(accessToken, { 'Content-Type': contentType, 'x-upsert': 'false' }),
        body: bytes,
      });
      if (!res.ok) mapStatus(res, await readError(res));
    },

    async storageCreateSignedUrl(objectKey, expiresInSeconds) {
      const res = await fetchImpl(`${base}/storage/v1/object/sign/${env.bucket}/${objectKey}`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      const body = (await res.json()) as { signedURL?: string; signedUrl?: string };
      const path = body.signedURL ?? body.signedUrl;
      if (!path) throw new FotoaiUpstreamError(res.status, 'Sign response lacked signedURL');
      return path.startsWith('http') ? path : `${base}/storage/v1${path}`;
    },

    async storageRemove(objectKeys) {
      const res = await fetchImpl(`${base}/storage/v1/object/${env.bucket}`, {
        method: 'DELETE',
        headers: serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefixes: objectKeys }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
    },

    async storageUploadAsService(objectKey, bytes, contentType) {
      const res = await fetchImpl(`${base}/storage/v1/object/${env.bucket}/${objectKey}`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': contentType, 'x-upsert': 'false' }),
        body: bytes,
      });
      if (!res.ok) mapStatus(res, await readError(res));
    },

    async serviceRpc(fn, args) {
      if (!(FOTOAI_SERVICE_RPCS as readonly string[]).includes(fn)) {
        throw new FotoaiValidationError(`Refusing to call function "${fn}"`);
      }
      const res = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(args),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any;
    },

    async serviceSelect(table, query) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery(query)}`, {
        headers: serviceHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any[];
    },

    async serviceInsert(table, row) {
      assertTable(table);
      const res = await fetchImpl(`${base}/rest/v1/${table}`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      const rows = (await res.json()) as any[];
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new FotoaiUpstreamError(res.status, 'Insert did not return exactly one row');
      }
      return rows[0];
    },

    async serviceUpdate(table, query, patch) {
      assertTable(table);
      if (!Object.keys(query).some((k) => k !== 'select')) {
        throw new FotoaiValidationError('Refusing an unfiltered service update');
      }
      const res = await fetchImpl(`${base}/rest/v1/${table}?${toQuery(query)}`, {
        method: 'PATCH',
        headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(patch),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      return (await res.json()) as any[];
    },

    async adminListUsers(page, perPage) {
      const res = await fetchImpl(`${base}/auth/v1/admin/users?${toQuery({ page: String(page), per_page: String(perPage) })}`, {
        headers: serviceHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) mapStatus(res, await readError(res));
      const body = (await res.json()) as { users?: Array<{ id?: string; email?: string | null; user_metadata?: Record<string, unknown> }> };
      return (body.users ?? [])
        .filter((u): u is { id: string; email?: string | null; user_metadata?: Record<string, unknown> } => typeof u.id === 'string')
        .map((u) => ({ id: u.id, email: u.email ?? null, name: sanitizeAuthName(u.user_metadata?.name) }));
    },
  };
}
