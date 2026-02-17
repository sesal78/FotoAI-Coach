
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health - Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Check Appwrite connection via health API
    const { health } = createAdminClient();
    await health.get();

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
