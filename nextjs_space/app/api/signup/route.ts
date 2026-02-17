
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/signup — Proxies to /api/auth/register
 * Kept for backwards compatibility; prefer /api/auth/register directly.
 */
export async function POST(request: NextRequest) {
  const url = new URL('/api/auth/register', request.url);
  return NextResponse.rewrite(url);
}
