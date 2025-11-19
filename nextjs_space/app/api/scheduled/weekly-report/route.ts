
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWeeklyReport } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/weekly-report - Generate and send weekly progress reports
 * This endpoint is called by cron jobs every Sunday
 */
export async function POST(request: NextRequest) {
  try {
    // Get all active users
    const users = await prisma.user.findMany({
      include: { progress: true },
    });

    const results = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const user of users) {
      try {
        // Get challenges from the past week
        const weekChallenges = await prisma.dailyChallenge.findMany({
          where: {
            userId: user.id,
            issuedDate: { gte: oneWeekAgo },
          },
        });

        const completedChallenges = weekChallenges.filter(c => c.status === 'completed');

        // Get submissions from the past week
        const weekSubmissions = await prisma.challengeSubmission.findMany({
          where: {
            userId: user.id,
            submittedAt: { gte: oneWeekAgo },
          },
          include: {
            challenge: {
              select: {
                category: true,
              },
            },
          },
        });

        // Analyze favorite subjects
        const categoryCount: Record<string, number> = {};
        weekSubmissions.forEach(sub => {
          const category = sub.challenge.category;
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });

        const favoriteSubjects = Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([category]) => category);

        // Get week highlight (highest rated submission)
        const bestSubmission = weekSubmissions
          .filter(s => s.rating)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];

        const weekHighlight = bestSubmission
          ? `Your ${bestSubmission.challenge.category} challenge received ${bestSubmission.rating} stars!`
          : undefined;

        // Send weekly report email
        const emailSent = await sendWeeklyReport(user.email, user.name, {
          challengesCompleted: completedChallenges.length,
          currentStreak: user.progress?.currentStreak || 0,
          favoriteSubjects,
          weekHighlight,
        });

        // Log agent action
        await prisma.agentAction.create({
          data: {
            userId: user.id,
            actionType: 'WEEKLY_REPORT',
            details: JSON.stringify({
              challengesCompleted: completedChallenges.length,
              totalChallenges: weekChallenges.length,
              favoriteSubjects,
              emailSent,
            }),
            success: true,
          },
        });

        results.push({
          userId: user.id,
          status: 'success',
          challengesCompleted: completedChallenges.length,
          emailSent,
        });
      } catch (userError) {
        console.error(`Weekly report failed for user ${user.id}:`, userError);
        results.push({
          userId: user.id,
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
