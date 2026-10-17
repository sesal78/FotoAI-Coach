// Cron request check for /api/fotoai/scheduled/*.
//
// Same contract as lib/cron-auth.ts (which imports next/server, so it cannot
// run in the framework-free handlers or plain Node tests):
//   * CRON_SECRET unset or blank on the server -> 500. The routes never run open.
//   * Missing header, wrong scheme or wrong secret -> 401.
// The secret is read when the request arrives, never at import or build time,
// and compared in constant time (both sides hashed to the same length first).

import { createHash, timingSafeEqual } from 'node:crypto';

import { FotoaiAuthError, FotoaiConfigError } from './errors.ts';

export type CronSecretSource = () => string | undefined;

/** Default source: process.env.CRON_SECRET, read per call. */
export const readCronSecretFromEnv: CronSecretSource = () => process.env.CRON_SECRET;

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Throws FotoaiConfigError (500) or FotoaiAuthError (401); returns when authorised. */
export function assertCronRequest(request: Request, readSecret: CronSecretSource = readCronSecretFromEnv): void {
  const secret = readSecret()?.trim();
  if (!secret) {
    throw new FotoaiConfigError('Cron not configured: CRON_SECRET is not set on the server');
  }
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const ok = provided.length > 0 && timingSafeEqual(digest(provided), digest(secret));
  if (!ok) throw new FotoaiAuthError('Unauthorised');
}
