import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_WEEKLY_REPORTS,
} from '@/lib/appwrite-collections';
import type { WeeklyReport } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insights?userId=xxx&limit=10
 * Fetch weekly insight reports for a user (newest first).
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || '10'), 50);

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_WEEKLY_REPORTS,
      [
        Query.equal('userId', userId),
        Query.orderDesc('reportDate'),
        Query.limit(limit),
      ]
    );

    const reports: WeeklyReport[] = result.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId as string,
      weekStart: doc.weekStart as string,
      weekEnd: doc.weekEnd as string,
      stats: JSON.parse((doc.statsJson as string) || '{}'),
      insights: JSON.parse((doc.insightsJson as string) || '{}'),
      reportDate: doc.reportDate as string,
    }));

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Failed to fetch weekly insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}
