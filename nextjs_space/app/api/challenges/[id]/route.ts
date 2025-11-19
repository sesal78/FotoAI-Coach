
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/challenges/[id] - Get a specific challenge
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: params.id },
      include: {
        submissions: true,
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Failed to fetch challenge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/challenges/[id] - Update challenge status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'accepted', 'skipped', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const challenge = await prisma.dailyChallenge.update({
      where: { id: params.id },
      data: {
        status,
        completedDate: status === 'completed' ? new Date() : undefined,
      },
    });

    // If completed, update user progress
    if (status === 'completed') {
      const progress = await prisma.userProgress.findUnique({
        where: { userId: challenge.userId },
      });

      if (progress) {
        // Update streak logic
        const lastCompletionDate = progress.lastCompletionDate;
        let newStreak = 1;

        if (lastCompletionDate) {
          const daysDiff = Math.floor(
            (new Date().getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff === 1) {
            // Consecutive day
            newStreak = progress.currentStreak + 1;
          } else if (daysDiff === 0) {
            // Same day
            newStreak = progress.currentStreak;
          } else {
            // Streak broken
            newStreak = 1;
          }
        }

        await prisma.userProgress.update({
          where: { userId: challenge.userId },
          data: {
            totalChallengesCompleted: { increment: 1 },
            currentStreak: newStreak,
            longestStreak: Math.max(progress.longestStreak, newStreak),
            lastCompletionDate: new Date(),
            lastStreakUpdate: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ challenge, message: 'Challenge updated' });
  } catch (error) {
    console.error('Failed to update challenge:', error);
    return NextResponse.json(
      { error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}
