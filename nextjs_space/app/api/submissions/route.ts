
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateFeedback } from '@/lib/llm';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/submissions - Get user's submissions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const challengeId = searchParams.get('challengeId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const whereClause: any = { userId };
    if (challengeId) {
      whereClause.challengeId = challengeId;
    }

    const submissions = await prisma.challengeSubmission.findMany({
      where: whereClause,
      orderBy: { submittedAt: 'desc' },
      include: {
        challenge: true,
      },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Failed to fetch submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/submissions - Submit a challenge completion
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const challengeId = formData.get('challengeId') as string;
    const userId = formData.get('userId') as string;
    const notes = formData.get('notes') as string;
    const rating = formData.get('rating') as string;
    const photo = formData.get('photo') as File | null;

    if (!challengeId || !userId) {
      return NextResponse.json(
        { error: 'Challenge ID and User ID required' },
        { status: 400 }
      );
    }

    // Verify challenge exists
    const challenge = await prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let photoUrl = null;

    // Handle photo upload (local file storage)
    if (photo) {
      try {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'submissions');
        
        // Create directory if it doesn't exist
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        const timestamp = Date.now();
        const filename = `${userId}-${timestamp}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = join(uploadDir, filename);

        const bytes = await photo.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        photoUrl = `/uploads/submissions/${filename}`;
      } catch (uploadError) {
        console.error('Photo upload failed:', uploadError);
        // Continue without photo
      }
    }

    // Generate AI feedback
    let feedback = 'Great work completing this challenge!';
    try {
      feedback = await generateFeedback({
        challengeText: challenge.challengeText,
        userNotes: notes || undefined,
        skillLevel: user.preferences?.skillLevel || 'intermediate',
      });
    } catch (feedbackError) {
      console.error('Feedback generation failed:', feedbackError);
      // Use default feedback
    }

    // Create submission
    const submission = await prisma.challengeSubmission.create({
      data: {
        challengeId,
        userId,
        photoUrl,
        notes,
        feedback,
        rating: rating ? parseInt(rating) : null,
      },
    });

    // Update challenge status to completed
    await prisma.dailyChallenge.update({
      where: { id: challengeId },
      data: {
        status: 'completed',
        completedDate: new Date(),
      },
    });

    // Update user progress
    const progress = await prisma.userProgress.findUnique({
      where: { userId },
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
          newStreak = progress.currentStreak + 1;
        } else if (daysDiff === 0) {
          newStreak = progress.currentStreak;
        } else {
          newStreak = 1;
        }
      }

      // Determine challenge type increment
      const typeField = getProgressFieldForChallengeType(challenge.challengeType);

      await prisma.userProgress.update({
        where: { userId },
        data: {
          totalChallengesCompleted: { increment: 1 },
          currentStreak: newStreak,
          longestStreak: Math.max(progress.longestStreak, newStreak),
          lastCompletionDate: new Date(),
          lastStreakUpdate: new Date(),
          ...(typeField ? { [typeField]: { increment: 1 } } : {}),
        },
      });
    } else {
      // Create initial progress
      await prisma.userProgress.create({
        data: {
          userId,
          totalChallengesCompleted: 1,
          currentStreak: 1,
          longestStreak: 1,
          lastCompletionDate: new Date(),
          lastStreakUpdate: new Date(),
        },
      });
    }

    // Log agent action
    await prisma.agentAction.create({
      data: {
        userId,
        actionType: 'CHALLENGE_COMPLETED',
        details: JSON.stringify({
          challengeId,
          submissionId: submission.id,
          hasPhoto: !!photoUrl,
          rating: rating ? parseInt(rating) : null,
        }),
        success: true,
      },
    });

    return NextResponse.json({
      submission,
      message: 'Challenge submitted successfully!',
    });
  } catch (error) {
    console.error('Failed to submit challenge:', error);
    return NextResponse.json(
      { error: 'Failed to submit challenge' },
      { status: 500 }
    );
  }
}

function getProgressFieldForChallengeType(challengeType: string): string | null {
  const typeMap: Record<string, string> = {
    'WEEKEND_DEEP_DIVE': 'saturdayChallengesCompleted',
    'LUNCH_MICRO': 'lunchBreakCompleted',
    'AFTER_WORK': 'afterWorkCompleted',
    'WORK_FROM_HOME': 'wfhCompleted',
  };
  return typeMap[challengeType] || null;
}
