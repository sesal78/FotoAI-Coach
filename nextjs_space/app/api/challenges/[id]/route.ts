
import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_USER_PROGRESS,
} from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

/**
 * GET /api/challenges/[id] - Get a specific challenge
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { databases } = createAdminClient();

    const challengeDoc = await databases.getDocument(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      params.id
    );

    // Fetch submissions for this challenge
    const submissionsResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_CHALLENGE_SUBMISSIONS,
      [Query.equal('challengeId', params.id)]
    );

    const challenge = {
      ...challengeDoc,
      id: challengeDoc.$id,
      submissions: submissionsResult.documents.map((s) => ({ ...s, id: s.$id })),
    };

    return NextResponse.json({ challenge });
  } catch (error: any) {
    // Appwrite throws a 404-equivalent when document not found
    if (error?.code === 404) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
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

    const { databases } = createAdminClient();

    const updateData: Record<string, unknown> = { status };
    if (status === 'completed') {
      updateData.completedDate = new Date().toISOString();
    }

    const challengeDoc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      params.id,
      updateData
    );

    // If completed, update user progress
    if (status === 'completed') {
      const userId = challengeDoc.userId as string;

      const progressResult = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_USER_PROGRESS,
        [Query.equal('userId', userId), Query.limit(1)]
      );

      if (progressResult.documents.length > 0) {
        const progressDoc = progressResult.documents[0];

        // Calculate streak
        const lastCompletionDate = progressDoc.lastCompletionDate
          ? new Date(progressDoc.lastCompletionDate)
          : null;

        let newStreak = 1;
        if (lastCompletionDate) {
          const daysDiff = Math.floor(
            (new Date().getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff === 1) {
            // Consecutive day
            newStreak = (progressDoc.currentStreak || 0) + 1;
          } else if (daysDiff === 0) {
            // Same day
            newStreak = progressDoc.currentStreak || 1;
          } else {
            // Streak broken
            newStreak = 1;
          }
        }

        await databases.updateDocument(
          DATABASE_ID,
          COLLECTION_USER_PROGRESS,
          progressDoc.$id,
          {
            totalChallengesCompleted: (progressDoc.totalChallengesCompleted || 0) + 1,
            currentStreak: newStreak,
            longestStreak: Math.max(progressDoc.longestStreak || 0, newStreak),
            lastCompletionDate: new Date().toISOString(),
            lastStreakUpdate: new Date().toISOString(),
          }
        );
      }
    }

    const challenge = { ...challengeDoc, id: challengeDoc.$id };

    return NextResponse.json({ challenge, message: 'Challenge updated' });
  } catch (error: any) {
    if (error?.code === 404) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    console.error('Failed to update challenge:', error);
    return NextResponse.json(
      { error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}
