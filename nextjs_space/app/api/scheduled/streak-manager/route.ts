
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/streak-manager - Update user streaks
 * This endpoint is called by cron jobs daily at 11 PM
 */
export async function POST(request: NextRequest) {
  try {
    const { databases, users } = createAdminClient();

    // Get all users from Appwrite Auth
    const allUsers = await users.list();
    const userList = allUsers.users;

    const results = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of userList) {
      try {
        // Get user progress document
        const progressResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USER_PROGRESS,
          [Query.equal('userId', user.$id), Query.limit(1)]
        );

        if (progressResult.documents.length === 0) {
          // No progress record — skip user
          continue;
        }

        const progressDoc = progressResult.documents[0];
        const lastCompletionDate = progressDoc.lastCompletionDate
          ? new Date(progressDoc.lastCompletionDate as string)
          : null;

        if (!lastCompletionDate) {
          // No completion yet, streak remains 0
          continue;
        }

        // Calculate days since last completion
        const daysSinceCompletion = Math.floor(
          (today.getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // If more than 1 day has passed, reset streak
        if (daysSinceCompletion > 1) {
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_USER_PROGRESS,
            progressDoc.$id,
            {
              currentStreak: 0,
              lastStreakUpdate: new Date().toISOString(),
            }
          );

          // Log agent action
          await databases.createDocument(
            DATABASE_ID,
            COLLECTION_AGENT_ACTIONS,
            ID.unique(),
            {
              userId: user.$id,
              actionType: 'STREAK_RESET',
              details: JSON.stringify({
                previousStreak: progressDoc.currentStreak,
                daysSinceCompletion,
              }),
              success: true,
            }
          );

          results.push({
            userId: user.$id,
            status: 'streak_reset',
            previousStreak: progressDoc.currentStreak,
          });
        } else {
          results.push({
            userId: user.$id,
            status: 'streak_maintained',
            currentStreak: progressDoc.currentStreak,
          });
        }
      } catch (userError) {
        console.error(`Streak manager failed for user ${user.$id}:`, userError);
        results.push({
          userId: user.$id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Streak management completed',
      results,
    });
  } catch (error) {
    console.error('Streak manager cron failed:', error);
    return NextResponse.json(
      { error: 'Streak management failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduled/streak-manager - Trigger via cron (GET request)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
