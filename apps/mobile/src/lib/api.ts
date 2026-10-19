// The app's only door to the server: /api/v2/* with the session's bearer token. Every answer is
// parsed with its contract schema, so a changed server shape shows an error, never wrong data.
// The client never adds a user id: the server takes identity from the token alone.

import { parseApiError, type ErrorCode } from '@fotoai/contracts';
import type { z } from 'zod';

export type ClientErrorCode = ErrorCode | 'offline' | 'bad_response';

// A config error (a server feature not set up) never gets better on a retry.
const RETRYABLE: ReadonlySet<ClientErrorCode> = new Set(['offline', 'upstream', 'rate_limited', 'internal']);

export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: ClientErrorCode, status: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.retryable = RETRYABLE.has(code);
  }
}

export interface ApiDeps {
  baseUrl: string;
  /** The current access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  /** Refreshes the session; true when a new token is ready. */
  refresh: () => Promise<boolean>;
  /** Called when the server still refuses the token after a refresh. */
  onSignedOut: () => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions<S extends z.ZodTypeAny> {
  schema: S;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

const OFFLINE_MESSAGE = 'No connection to FotoAI. Check your signal and try again.';

export function createApi(deps: ApiDeps) {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 20_000;

  async function send(path: string, opts: RequestOptions<z.ZodTypeAny>, token: string | null): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      return await doFetch(`${deps.baseUrl}${path}`, {
        method: opts.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiClientError('offline', 0, OFFLINE_MESSAGE);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }

  async function request<S extends z.ZodTypeAny>(path: string, opts: RequestOptions<S>): Promise<z.infer<S>> {
    let res = await send(path, opts, await deps.getToken());
    if (res.status === 401 && (await deps.refresh())) res = await send(path, opts, await deps.getToken());

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const { code, message } = parseApiError(res.status, body);
      if (res.status === 401) deps.onSignedOut();
      throw new ApiClientError(code, res.status, message);
    }
    const parsed = opts.schema.safeParse(body);
    if (!parsed.success) throw new ApiClientError('bad_response', res.status, 'FotoAI sent an answer this app does not understand. Update the app.');
    return parsed.data;
  }

  return { request };
}

export type Api = ReturnType<typeof createApi>;
