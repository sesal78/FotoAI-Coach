// Early request-size gate for upload routes.
//
// request.formData() buffers the whole body in memory before any file-size
// check can run. This module rejects oversized bodies BEFORE parsing:
//   1. Content-Length must be present (411) and within the limit (413).
//   2. The body stream is counted while it is read; a body that exceeds the
//      limit despite its declared length is cut off (413) without buffering
//      more than the limit.
// A reverse proxy / runtime limit of the same size must also exist in front
// of the app (see the build report). This module is the app-level guard.

import { FotoaiError } from './errors.ts';

/** 50 MB photo + multipart overhead and text fields. */
export const MAX_UPLOAD_REQUEST_BYTES = 50 * 1024 * 1024 + 1024 * 1024;

export class FotoaiPayloadTooLargeError extends FotoaiError {
  constructor(message = 'Request body is too large') {
    super(413, 'payload_too_large', message);
    this.name = 'FotoaiPayloadTooLargeError';
  }
}

export class FotoaiLengthRequiredError extends FotoaiError {
  constructor(message = 'Content-Length header is required') {
    super(411, 'length_required', message);
    this.name = 'FotoaiLengthRequiredError';
  }
}

/** Reads and validates Content-Length. Throws 411 / 413. */
export function requireDeclaredLength(request: Request, maxBytes: number): number {
  const raw = request.headers.get('content-length');
  if (raw === null || raw.trim() === '') {
    throw new FotoaiLengthRequiredError();
  }
  if (!/^\d{1,15}$/.test(raw.trim())) {
    throw new FotoaiError(400, 'validation', 'Content-Length is not a valid number');
  }
  const declared = Number(raw.trim());
  if (declared > maxBytes) {
    throw new FotoaiPayloadTooLargeError(`Request body exceeds ${maxBytes} bytes`);
  }
  return declared;
}

/**
 * Returns a Request whose body stream stops with 413 once more than `maxBytes`
 * have been read. Headers, method, and URL are preserved. Use the returned
 * request for `.formData()` / `.json()` instead of the original.
 */
export function boundedRequest(request: Request, maxBytes: number): Request {
  requireDeclaredLength(request, maxBytes);
  if (!request.body) return request;

  let seen = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) {
        controller.error(new FotoaiPayloadTooLargeError(`Request body exceeds ${maxBytes} bytes`));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const init: RequestInit & { duplex: 'half' } = {
    method: request.method,
    headers: request.headers,
    body: request.body.pipeThrough(limiter),
    duplex: 'half',
  };
  return new Request(request.url, init);
}

/**
 * Parses multipart form data from a size-bounded copy of the request.
 * Any limiter error surfaces as a 413 FotoaiError.
 */
export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const bounded = boundedRequest(request, maxBytes);
  try {
    return await bounded.formData();
  } catch (err) {
    if (err instanceof FotoaiError) throw err;
    // undici wraps stream errors; the limiter is the only error source we cause.
    const cause = (err as { cause?: unknown })?.cause;
    if (cause instanceof FotoaiError) throw cause;
    const message = err instanceof Error ? err.message : String(err);
    if (/exceeds \d+ bytes/.test(message)) throw new FotoaiPayloadTooLargeError();
    throw new FotoaiError(400, 'validation', `Could not parse multipart body: ${message}`);
  }
}
