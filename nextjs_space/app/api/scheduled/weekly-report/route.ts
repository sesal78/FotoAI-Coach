
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { verifyCronRequest } from '@/lib/cron-auth';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { sendWeeklyReport } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/weekly-report - Generate and send weekly progress reports
 * This endpoint is called by cron jobs every Sunday
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const { databases, users } = createAdminClient();

    // Get all users from Appwrite Auth
    const allUsers = await users.list();
    const userList = allUsers.users;

    const results = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const user of userList) {
      try {
        // Get progress for streak info
        const progressResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USER_PROGRESS,
          [Query.equal('userId', user.$id), Query.limit(1)]
        );
        const progressDoc = progressResult.documents[0] ?? null;

        // Get challenges from the past week
        const weekChallengesResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_DAILY_CHALLENGES,
          [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('issuedDate', oneWeekAgo.toISOString()),
          ]
        );
        const weekChallenges = weekChallengesResult.documents;
        const completedChallenges = weekChallenges.filter((c) => c.status === 'completed');

        // Get submissions from the past week
        const weekSubmissionsResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_CHALLENGE_SUBMISSIONS,
          [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('submittedAt', oneWeekAgo.toISOString()),
          ]
        );
        const weekSubmissions = weekSubmissionsResult.documents;

        // Fetch challenge category for each submission
        const challengeIdSet = [
          ...new Set(weekSubmissions.map((s) => s.challengeId as string)),
        ];

        const challengeCategoryMap: Record<string, string> = {};
        await Promise.all(
          challengeIdSet.map(async (challengeId) => {
            try {
              const challengeDoc = await databases.getDocument(
                DATABASE_ID,
                COLLECTION_DAILY_CHALLENGES,
                challengeId
              );
              challengeCategoryMap[challengeId] = challengeDoc.category as string;
            } catch {
              // Challenge may have been deleted; skip
            }
          })
        );

        // Analyze favorite subjects
        const categoryCount: Record<string, number> = {};
        weekSubmissions.forEach((sub) => {
          const category = challengeCategoryMap[sub.challengeId as string];
          if (category) {
            categoryCount[category] = (categoryCount[category] || 0) + 1;
          }
        });

        const favoriteSubjects = Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([category]) => category);

        // Get week highlight (highest rated submission)
        const bestSubmission = weekSubmissions
          .filter((s) => s.rating)
          .sort((a, b) => ((b.rating as number) || 0) - ((a.rating as number) || 0))[0];

        const weekHighlight = bestSubmission
          ? `Your ${challengeCategoryMap[bestSubmission.challengeId as string] || 'photography'} challenge received ${bestSubmission.rating} stars!`
          : undefined;

        // Send weekly report email
        const emailSent = await sendWeeklyReport(user.email, user.name, {
          challengesCompleted: completedChallenges.length,
          currentStreak: (progressDoc?.currentStreak as number) || 0,
          favoriteSubjects,
          weekHighlight,
        });

        // Log agent action
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_AGENT_ACTIONS,
          ID.unique(),
          {
            userId: user.$id,
            actionType: 'WEEKLY_REPORT',
            details: JSON.stringify({
              challengesCompleted: completedChallenges.length,
              totalChallenges: weekChallenges.length,
              favoriteSubjects,
              emailSent,
            }),
            success: true,
          }
        );

        results.push({
          userId: user.$id,
          status: 'success',
          challengesCompleted: completedChallenges.length,
          emailSent,
        });
      } catch (userError) {
        console.error(`Weekly report failed for user ${user.$id}:`, userError);
        results.push({
          userId: user.$id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Weekly report generation completed',
      results,
    });
  } catch (error) {
    console.error('Weekly report cron failed:', error);
    return NextResponse.json(
      { error: 'Weekly report generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduled/weekly-report - Trigger via cron (GET request)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
