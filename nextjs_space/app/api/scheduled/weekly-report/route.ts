
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { verifyCronRequest } from '@/lib/cron-auth';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_USER_PROGRESS,
  COLLECTION_PHOTO_CRITIQUES,
  COLLECTION_WEEKLY_REPORTS,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { sendWeeklyReport } from '@/lib/email';
import { generateWeeklyInsights } from '@/lib/llm';
import type { WeeklyInsightsData } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Compute average of an array of numbers, or null if empty.
 */
function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * POST /api/scheduled/weekly-report - Generate and send weekly insights reports
 * Called by cron every Sunday.
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const { databases, users } = createAdminClient();

    const allUsers = await users.list();
    const userList = allUsers.users;

    const results = [];
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const weekStart = oneWeekAgo.toISOString().split('T')[0];
    const weekEnd = now.toISOString().split('T')[0];

    for (const user of userList) {
      try {
        // Fetch all required data in parallel
        const [
          progressResult,
          thisWeekChallenges,
          lastWeekChallenges,
          thisWeekSubmissions,
          thisWeekCritiques,
          lastWeekCritiques,
          prefsResult,
        ] = await Promise.all([
          databases.listDocuments(DATABASE_ID, COLLECTION_USER_PROGRESS, [
            Query.equal('userId', user.$id), Query.limit(1),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('issuedDate', oneWeekAgo.toISOString()),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('issuedDate', twoWeeksAgo.toISOString()),
            Query.lessThan('issuedDate', oneWeekAgo.toISOString()),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_CHALLENGE_SUBMISSIONS, [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('submittedAt', oneWeekAgo.toISOString()),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('critiqueDate', oneWeekAgo.toISOString()),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('critiqueDate', twoWeeksAgo.toISOString()),
            Query.lessThan('critiqueDate', oneWeekAgo.toISOString()),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
            Query.equal('userId', user.$id), Query.limit(1),
          ]),
        ]);

        const progressDoc = progressResult.documents[0] ?? null;
        const skillLevel = (prefsResult.documents[0]?.skillLevel as string) || 'intermediate';

        // Compute stats
        const completedThisWeek = thisWeekChallenges.documents.filter((c) => c.status === 'completed');
        const completedLastWeek = lastWeekChallenges.documents.filter((c) => c.status === 'completed');

        const thisWeekScores = thisWeekCritiques.documents.map((c) => c.overallScore as number);
        const lastWeekScores = lastWeekCritiques.documents.map((c) => c.overallScore as number);

        // Category breakdown from this week's completed challenges
        const categoryCount: Record<string, number> = {};
        completedThisWeek.forEach((c) => {
          const cat = c.category as string;
          if (cat) categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const topCategories = Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat]) => cat);

        const completionRate = thisWeekChallenges.documents.length > 0
          ? Math.round((completedThisWeek.length / thisWeekChallenges.documents.length) * 100)
          : 0;

        const stats: WeeklyInsightsData = {
          weekStart,
          weekEnd,
          challengesCompletedThisWeek: completedThisWeek.length,
          challengesCompletedLastWeek: completedLastWeek.length,
          submissionsThisWeek: thisWeekSubmissions.documents.length,
          averageCritiqueScore: avg(thisWeekScores),
          previousAverageCritiqueScore: avg(lastWeekScores),
          scoreTrend: {
            technical: avg(thisWeekCritiques.documents.map((c) => c.technicalScore as number)),
            composition: avg(thisWeekCritiques.documents.map((c) => c.compositionScore as number)),
            creative: avg(thisWeekCritiques.documents.map((c) => c.creativeScore as number)),
          },
          previousScoreTrend: {
            technical: avg(lastWeekCritiques.documents.map((c) => c.technicalScore as number)),
            composition: avg(lastWeekCritiques.documents.map((c) => c.compositionScore as number)),
            creative: avg(lastWeekCritiques.documents.map((c) => c.creativeScore as number)),
          },
          topCategories,
          challengeCompletionRate: completionRate,
          currentStreak: (progressDoc?.currentStreak as number) || 0,
          longestStreak: (progressDoc?.longestStreak as number) || 0,
        };

        // Generate AI insights
        const insights = await generateWeeklyInsights({
          userName: user.name,
          skillLevel,
          stats,
        });

        // Persist report to weekly_reports collection
        const reportDoc = await databases.createDocument(
          DATABASE_ID,
          COLLECTION_WEEKLY_REPORTS,
          ID.unique(),
          {
            userId: user.$id,
            weekStart,
            weekEnd,
            statsJson: JSON.stringify(stats),
            insightsJson: JSON.stringify(insights),
            reportDate: now.toISOString(),
          }
        );

        // Send email
        const emailSent = await sendWeeklyReport(user.email, user.name, {
          challengesCompleted: completedThisWeek.length,
          challengesCompletedLastWeek: completedLastWeek.length,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
          averageScore: stats.averageCritiqueScore,
          previousAverageScore: stats.previousAverageCritiqueScore,
          completionRate,
          favoriteSubjects: topCategories,
          insights,
        });

        // Log agent action
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_AGENT_ACTIONS,
          ID.unique(),
          {
            userId: user.$id,
            actionType: 'WEEKLY_INSIGHTS_REPORT',
            details: JSON.stringify({
              reportId: reportDoc.$id,
              challengesCompleted: completedThisWeek.length,
              averageScore: stats.averageCritiqueScore,
              emailSent,
            }),
            success: true,
          }
        );

        results.push({
          userId: user.$id,
          status: 'success',
          reportId: reportDoc.$id,
          challengesCompleted: completedThisWeek.length,
          emailSent,
        });
      } catch (userError) {
        console.error(`Weekly insights failed for user ${user.$id}:`, userError);
        results.push({
          userId: user.$id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Weekly insights report generation completed',
      results,
    });
  } catch (error) {
    console.error('Weekly insights cron failed:', error);
    return NextResponse.json(
      { error: 'Weekly insights report generation failed' },
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
