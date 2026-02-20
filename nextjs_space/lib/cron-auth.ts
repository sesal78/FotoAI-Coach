import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifies that the request carries the expected CRON_SECRET.
 * Returns a 401 response if invalid, or null if the request is authorised.
 *
 * Usage in a route handler:
 *   const authError = verifyCronRequest(request);
 *   if (authError) return authError;
 */
export function verifyCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron-auth] CRON_SECRET is not set — all cron requests are blocked');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (provided !== secret) {
    console.warn('[cron-auth] Unauthorised cron request');
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  return null;
}
