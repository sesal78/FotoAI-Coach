// FotoAI (Supabase path) error types. Framework-free so tests run under plain Node.

export class FotoaiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FotoaiError';
    this.status = status;
    this.code = code;
  }
}

/** 400 — the request shape is wrong (bad id, bad key, client sent a userId). */
export class FotoaiValidationError extends FotoaiError {
  constructor(message: string) {
    super(400, 'validation', message);
    this.name = 'FotoaiValidationError';
  }
}

/** 401 — no usable session. */
export class FotoaiAuthError extends FotoaiError {
  constructor(message = 'Not authenticated') {
    super(401, 'unauthenticated', message);
    this.name = 'FotoaiAuthError';
  }
}

/** 403 — authenticated, but the object belongs to someone else. Used only when
 *  the caller already proved the object exists (e.g. a stored key that does not
 *  match its own row). Lookups by id return 404 instead to avoid an oracle. */
export class FotoaiForbiddenError extends FotoaiError {
  constructor(message = 'Forbidden') {
    super(403, 'forbidden', message);
    this.name = 'FotoaiForbiddenError';
  }
}

/** 404 — not found for this owner. Also returned for rows owned by others. */
export class FotoaiNotFoundError extends FotoaiError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
    this.name = 'FotoaiNotFoundError';
  }
}

/** 500 — server misconfiguration (missing env). Never includes secret values. */
export class FotoaiConfigError extends FotoaiError {
  constructor(message: string) {
    super(500, 'config', message);
    this.name = 'FotoaiConfigError';
  }
}

/** 502 — Supabase answered with an unexpected status. */
export class FotoaiUpstreamError extends FotoaiError {
  readonly upstreamStatus: number;

  constructor(upstreamStatus: number, message: string) {
    super(502, 'upstream', message);
    this.name = 'FotoaiUpstreamError';
    this.upstreamStatus = upstreamStatus;
  }
}

export function isFotoaiError(err: unknown): err is FotoaiError {
  return err instanceof FotoaiError;
}
