// API error envelope shared by web, mobile and server. Same JSON shape the live
// app returns today ({ error, code }), so one client parses the old and new APIs.

import { z } from 'zod';

export const ERROR_CODES = [
  'validation',
  'unauthenticated',
  'forbidden',
  'not_found',
  'rate_limited',
  'config',
  'upstream',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ApiErrorBody = z.object({
  error: z.string().min(1),
  code: z.enum(ERROR_CODES),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = Object.freeze({
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  config: 500,
  upstream: 502,
  internal: 500,
});

export function parseApiError(status: number, body: unknown): { code: ErrorCode; message: string } {
  const parsed = ApiErrorBody.safeParse(body);
  if (parsed.success) return { code: parsed.data.code, message: parsed.data.error };

  const code = ERROR_CODES.find((c) => HTTP_STATUS_BY_CODE[c] === status) ?? 'internal';
  return { code, message: `Request failed (status ${status})` };
}
