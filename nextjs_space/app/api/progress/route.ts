
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_USER_PROGRESS,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_DAILY_CHALLENGES,
} from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

/**
 * GET /api/progress - Get user progress and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { databases } = createAdminClient();

    // Get or create progress
    const progressResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_PROGRESS,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    let progressDoc;
    if (progressResult.documents.length > 0) {
      progressDoc = progressResult.documents[0];
    } else {
      progressDoc = await databases.createDocument(
        DATABASE_ID,
        COLLECTION_USER_PROGRESS,
        ID.unique(),
        {
          userId,
          totalChallengesIssued: 0,
          totalChallengesCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        }
      );
    }

    // Get recent submissions
    const submissionsResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_CHALLENGE_SUBMISSIONS,
      [
        Query.equal('userId', userId),
        Query.orderDesc('submittedAt'),
        Query.limit(10),
      ]
    );
    const recentSubmissions = submissionsResult.documents;

    // Fetch challenge data for each submission (to get category/difficulty)
    const challengeIds = [
      ...new Set(recentSubmissions.map((s) => s.challengeId as string)),
    ];

    const challengeMap: Record<string, { category: string; difficulty: string }> = {};
    await Promise.all(
      challengeIds.map(async (challengeId) => {
        try {
          const challengeDoc = await databases.getDocument(
            DATABASE_ID,
            COLLECTION_DAILY_CHALLENGES,
            challengeId
          );
          challengeMap[challengeId] = {
            category: challengeDoc.category,
            difficulty: challengeDoc.difficulty,
          };
        } catch {
          // Challenge may have been deleted; skip
        }
      })
    );

    // Analyze favorite subjects
    const categoryCount: Record<string, number> = {};
    recentSubmissions.forEach((sub) => {
      const category = challengeMap[sub.challengeId as string]?.category;
      if (category) {
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      }
    });

    const favoriteSubjects = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // Calculate completion rate
    const totalIssued = progressDoc.totalChallengesIssued || 0;
    const totalCompleted = progressDoc.totalChallengesCompleted || 0;
    const completionRate =
      totalIssued > 0 ? Math.round((totalCompleted / totalIssued) * 100) : 0;

    // Enrich recent submissions with challenge info and map IDs
    const enrichedSubmissions = recentSubmissions.slice(0, 5).map((sub) => ({
      ...sub,
      id: sub.$id,
      challenge: challengeMap[sub.challengeId as string] ?? null,
    }));

    const progress = {
      ...progressDoc,
      id: progressDoc.$id,
      favoriteSubjects,
      completionRate,
      recentSubmissions: enrichedSubmissions,
    };

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Failed to fetch progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
