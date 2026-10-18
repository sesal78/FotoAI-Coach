// Small request helpers shared by v2 handlers.

import { ApiError } from './handler.ts';

const MAX_BODY = 4096;

/** The request body as a JSON object (at most 4 KB); anything else is a validation error. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ApiError('validation', 'Request body is too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('validation', 'Request body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('validation', 'Request body must be a JSON object');
  return body as Record<string, unknown>;
}
