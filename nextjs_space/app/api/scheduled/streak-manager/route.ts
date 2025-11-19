
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/streak-manager - Update user streaks
 * This endpoint is called by cron jobs daily at 11 PM
 */
export async function POST(request: NextRequest) {
  try {
    // Get all users with progress
    const users = await prisma.user.findMany({
      include: { progress: true },
    });

    const results = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      if (!user.progress) {
        continue;
      }

      try {
        const lastCompletionDate = user.progress.lastCompletionDate;

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
          await prisma.userProgress.update({
            where: { userId: user.id },
            data: {
              currentStreak: 0,
              lastStreakUpdate: new Date(),
            },
          });

          // Log agent action
          await prisma.agentAction.create({
            data: {
              userId: user.id,
              actionType: 'STREAK_RESET',
              details: JSON.stringify({
                previousStreak: user.progress.currentStreak,
                daysSinceCompletion,
              }),
              success: true,
            },
          });

          results.push({
            userId: user.id,
            status: 'streak_reset',
            previousStreak: user.progress.currentStreak,
          });
        } else {
          results.push({
            userId: user.id,
            status: 'streak_maintained',
            currentStreak: user.progress.currentStreak,
          });
        }
      } catch (userError) {
        console.error(`Streak manager failed for user ${user.id}:`, userError);
        results.push({
          userId: user.id,
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
