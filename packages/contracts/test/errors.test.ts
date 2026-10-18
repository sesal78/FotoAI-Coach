import { expect, test } from 'vitest';

import { HTTP_STATUS_BY_CODE, parseApiError } from '../src/index.ts';

test('status map matches the live app error classes', () => {
  expect(HTTP_STATUS_BY_CODE).toEqual({
    validation: 400,
    unauthenticated: 401,
    forbidden: 403,
    not_found: 404,
    rate_limited: 429,
    config: 500,
    upstream: 502,
    internal: 500,
  });
});

test('parses a live-app error body', () => {
  expect(parseApiError(429, { error: 'Slow down', code: 'rate_limited' })).toEqual({ code: 'rate_limited', message: 'Slow down' });
});

test('falls back to the HTTP status when the body is not an error envelope', () => {
  expect(parseApiError(401, '<html>')).toEqual({ code: 'unauthenticated', message: 'Request failed (status 401)' });
  expect(parseApiError(418, null)).toEqual({ code: 'internal', message: 'Request failed (status 418)' });
});

test('an unknown code in the body falls back to the status', () => {
  expect(parseApiError(404, { error: 'x', code: 'teapot' }).code).toBe('not_found');
});
