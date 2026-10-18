// v2 request pipeline: framework-free handlers that both the live app and later apps/web
// mount as route files. Deps are built lazily on the first request, so importing a route
// module (as `next build` does, with no secrets) never reads env.

import { HTTP_STATUS_BY_CODE, type ErrorCode } from '@fotoai/contracts';
import { createServerEnv, type ServerEnv } from '@fotoai/env';

export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }

  get status(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export interface V2Deps {
  env: ServerEnv;
  now: () => Date;
}

export type V2DepsProvider = () => V2Deps;

type Params = Record<string, string>;
export type V2Body = (request: Request, deps: V2Deps, ctx: { params: Params }) => Promise<Response>;
export type V2Route = (request: Request, ctx?: { params?: Params | Promise<Params> }) => Promise<Response>;

export function json(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function defineV2Handler(provider: V2DepsProvider, body: V2Body): V2Route {
  return async (request, ctx = {}) => {
    try {
      const deps = provider();
      const params = (await ctx.params) ?? {};
      return await body(request, deps, { params });
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message, code: err.code }, { status: err.status });
      console.error(`FotoAI v2 route error: ${err instanceof Error ? err.message : String(err)}`);
      return json({ error: 'Internal error', code: 'internal' }, { status: 500 });
    }
  };
}

let memo: V2Deps | null = null;

/** Production deps: env validated once, on the first request that needs it. */
export const defaultV2Deps: V2DepsProvider = () => (memo ??= { env: createServerEnv(), now: () => new Date() });
