// Shared pieces for FotoAI route handlers. Uses only the Web Request/Response
// API so handlers run in Next.js Route Handlers AND in plain Node tests.

import type { FotoaiEnv } from '../env.ts';
import { FotoaiError, FotoaiUpstreamError, isFotoaiError } from '../errors.ts';
import { resolvePrincipal, type FotoaiPrincipal } from '../membership.ts';
import type { FotoaiPhotoService } from '../photos.ts';
import type { FotoaiRepository } from '../repository.ts';
import type { FotoaiServices } from '../services.ts';
import type { FotoaiSupabaseClient } from '../supabase-http.ts';
import type { FotoaiXpService } from '../xp.ts';

export interface FotoaiDeps {
  env: FotoaiEnv;
  client: FotoaiSupabaseClient;
  repo: FotoaiRepository;
  photos: FotoaiPhotoService;
  xp: FotoaiXpService;
  /** LLM, weather and email. Fakes in tests. */
  services: FotoaiServices;
  /** Injectable logger so tests stay quiet. */
  log?: (level: 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
}

/** Deps are resolved lazily per request so env is read at runtime, not at build. */
export type DepsProvider = () => FotoaiDeps;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', NO_STORE['Cache-Control']);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function errorResponse(err: unknown, deps?: Pick<FotoaiDeps, 'log'>): Response {
  if (err instanceof FotoaiUpstreamError) {
    deps?.log?.('error', err.message, { code: err.code });
    return json({ error: 'Upstream service error', code: err.code }, { status: err.status });
  }
  if (isFotoaiError(err)) {
    if (err.status >= 500) deps?.log?.('error', err.message, { code: err.code });
    return json({ error: err.message, code: err.code }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : String(err);
  (deps?.log ?? defaultLog)('error', `Unhandled FotoAI route error: ${message}`);
  return json({ error: 'Internal error', code: 'internal' }, { status: 500 });
}

export function defaultLog(level: 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const line = meta ? `${message} ${JSON.stringify(meta)}` : message;
  if (level === 'error') console.error('[fotoai]', line);
  else console.warn('[fotoai]', line);
}

/** Resolves the session principal from the request cookie or throws 401. */
export async function requirePrincipal(request: Request, deps: FotoaiDeps): Promise<FotoaiPrincipal> {
  return resolvePrincipal(request.headers.get('cookie'), deps.client);
}

/**
 * Wraps a handler body: resolves deps, runs it, maps errors to JSON responses.
 */
export function withFotoai(
  provider: DepsProvider,
  body: (request: Request, deps: FotoaiDeps, ctx: { params: Record<string, string> }) => Promise<Response>,
) {
  return async (request: Request, ctx?: { params?: Record<string, string> | Promise<Record<string, string>> }): Promise<Response> => {
    let deps: FotoaiDeps | undefined;
    try {
      deps = provider();
      const params = (await ctx?.params) ?? {};
      return await body(request, deps, { params });
    } catch (err) {
      return errorResponse(err, deps);
    }
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new FotoaiError(400, 'validation', 'Body must be a JSON object');
}
