import { NextResponse } from 'next/server';
import { readFotoaiEnv } from '@/lib/fotoai/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health - Health check endpoint (Docker healthcheck, deploy.sh, monitor.sh).
 * Checks that the FotoAI Supabase config loads and that Supabase Auth answers.
 */
export async function GET() {
  try {
    const env = readFotoaiEnv();
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Supabase Auth health returned ${res.status}`);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      service: 'foto-ai-agent',
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
