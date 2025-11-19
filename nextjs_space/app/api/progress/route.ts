
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    // Get or create progress
    let progress = await prisma.userProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await prisma.userProgress.create({
        data: {
          userId,
          totalChallengesIssued: 0,
          totalChallengesCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    // Get recent submissions for analysis
    const recentSubmissions = await prisma.challengeSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      include: {
        challenge: {
          select: {
            category: true,
            difficulty: true,
          },
        },
      },
    });

    // Analyze favorite subjects
    const categoryCount: Record<string, number> = {};
    recentSubmissions.forEach(sub => {
      const category = sub.challenge.category;
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    const favoriteSubjects = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // Calculate completion rate
    const completionRate = progress.totalChallengesIssued > 0
      ? Math.round((progress.totalChallengesCompleted / progress.totalChallengesIssued) * 100)
      : 0;

    return NextResponse.json({
      progress: {
        ...progress,
        favoriteSubjects,
        completionRate,
        recentSubmissions: recentSubmissions.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Failed to fetch progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
