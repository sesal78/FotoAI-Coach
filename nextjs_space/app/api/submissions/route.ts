
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
  STORAGE_BUCKET_SUBMISSIONS,
} from '@/lib/appwrite-collections';
import { generateFeedback } from '@/lib/llm';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

    const { databases } = createAdminClient();

    const filters: string[] = [
      Query.equal('userId', userId),
      Query.orderDesc('submittedAt'),
    ];
    if (challengeId) {
      filters.push(Query.equal('challengeId', challengeId));
    }

    const submissionsResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_CHALLENGE_SUBMISSIONS,
      filters
    );

    // Fetch challenge data for each submission
    const submissions = await Promise.all(
      submissionsResult.documents.map(async (sub) => {
        let challenge = null;
        try {
          const challengeDoc = await databases.getDocument(
            DATABASE_ID,
            COLLECTION_DAILY_CHALLENGES,
            sub.challengeId as string
          );
          challenge = { ...challengeDoc, id: challengeDoc.$id };
        } catch {
          // Challenge may have been deleted; skip
        }
        return { ...sub, id: sub.$id, challenge };
      })
    );

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

    const { databases, storage, users } = createAdminClient();

    // Verify challenge exists
    let challenge;
    try {
      challenge = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_DAILY_CHALLENGES,
        challengeId
      );
    } catch {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Get user from Appwrite Auth
    let user;
    try {
      user = await users.get(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user preferences for skill level
    const prefsResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_PREFERENCES,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    const preferences = prefsResult.documents[0] ?? null;

    // Validate photo file before upload
    if (photo) {
      if (!ALLOWED_MIME_TYPES.includes(photo.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC' },
          { status: 400 }
        );
      }
      if (photo.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size: 10 MB' },
          { status: 400 }
        );
      }
    }

    let photoUrl: string | null = null;

    // Handle photo upload via Appwrite Storage
    if (photo && STORAGE_BUCKET_SUBMISSIONS) {
      try {
        const fileBuffer = Buffer.from(await photo.arrayBuffer());
        const uploaded = await storage.createFile(
          STORAGE_BUCKET_SUBMISSIONS,
          ID.unique(),
          InputFile.fromBuffer(fileBuffer, photo.name)
        );
        photoUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_SUBMISSIONS}/files/${uploaded.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
      } catch (uploadError) {
        console.error('Photo upload failed:', uploadError);
        // Continue without photo
      }
    } else if (photo && !STORAGE_BUCKET_SUBMISSIONS) {
      console.warn('Photo provided but APPWRITE_STORAGE_BUCKET_ID is not configured');
    }

    // Build submission data — omit null values for Appwrite compatibility
    const submissionData: Record<string, unknown> = {
      challengeId,
      userId,
      notes: notes || '',
      feedbackStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };
    if (photoUrl) submissionData.photoUrl = photoUrl;
    if (rating && parseInt(rating) >= 1 && parseInt(rating) <= 5) {
      submissionData.rating = parseInt(rating);
    }

    // Create submission document (feedback generated asynchronously)
    const submissionDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_CHALLENGE_SUBMISSIONS,
      ID.unique(),
      submissionData
    );

    // Update challenge status to completed
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      challengeId,
      {
        status: 'completed',
        completedDate: new Date().toISOString(),
      }
    );

    // Update user progress
    const progressResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_PROGRESS,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (progressResult.documents.length > 0) {
      const progressDoc = progressResult.documents[0];

      // Calculate streak
      const lastCompletionDate = progressDoc.lastCompletionDate
        ? new Date(progressDoc.lastCompletionDate as string)
        : null;

      let newStreak = 1;
      if (lastCompletionDate) {
        const daysDiff = Math.floor(
          (new Date().getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          newStreak = (progressDoc.currentStreak || 0) + 1;
        } else if (daysDiff === 0) {
          newStreak = progressDoc.currentStreak || 1;
        } else {
          newStreak = 1;
        }
      }

      // Determine challenge type field increment
      const typeField = getProgressFieldForChallengeType(challenge.challengeType as string);
      const typeFieldUpdate: Record<string, number> = {};
      if (typeField) {
        typeFieldUpdate[typeField] = (progressDoc[typeField] || 0) + 1;
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
          ...typeFieldUpdate,
        }
      );
    } else {
      // Create initial progress
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_USER_PROGRESS,
        ID.unique(),
        {
          userId,
          totalChallengesIssued: 0,
          totalChallengesCompleted: 1,
          currentStreak: 1,
          longestStreak: 1,
          lastCompletionDate: new Date().toISOString(),
          lastStreakUpdate: new Date().toISOString(),
        }
      );
    }

    // Log agent action
    await databases.createDocument(
      DATABASE_ID,
      COLLECTION_AGENT_ACTIONS,
      ID.unique(),
      {
        userId,
        actionType: 'CHALLENGE_COMPLETED',
        details: JSON.stringify({
          challengeId,
          submissionId: submissionDoc.$id,
          hasPhoto: !!photoUrl,
          rating: rating ? parseInt(rating) : null,
        }),
        success: true,
      }
    );

    // Fire-and-forget: generate feedback asynchronously
    generateFeedbackAsync(databases, submissionDoc.$id, {
      challengeText: challenge.challengeText as string,
      userNotes: notes || undefined,
      skillLevel: preferences?.skillLevel || 'intermediate',
    }).catch((err) => {
      console.error('Async feedback generation failed:', err);
    });

    return NextResponse.json({
      submission: { ...submissionDoc, id: submissionDoc.$id },
      message: 'Challenge submitted successfully! Feedback is being generated...',
    });
  } catch (error) {
    console.error('Failed to submit challenge:', error);
    return NextResponse.json(
      { error: 'Failed to submit challenge' },
      { status: 500 }
    );
  }
}

async function generateFeedbackAsync(
  databases: any,
  submissionId: string,
  context: { challengeText: string; userNotes?: string; skillLevel: string }
) {
  try {
    const feedback = await generateFeedback(context);
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_CHALLENGE_SUBMISSIONS,
      submissionId,
      {
        feedback: feedback || 'Great work!',
        feedbackStatus: 'ready',
      }
    );
    console.log('Async feedback generated for submission:', submissionId);
  } catch (error) {
    console.error('Async feedback failed for submission:', submissionId, error);
    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_CHALLENGE_SUBMISSIONS,
        submissionId,
        { feedbackStatus: 'ready' }
      );
    } catch (updateError) {
      console.error('Failed to update fallback feedback status:', updateError);
    }
  }
}

function getProgressFieldForChallengeType(challengeType: string): string | null {
  const typeMap: Record<string, string> = {
    WEEKEND_DEEP_DIVE: 'saturdayChallengesCompleted',
    LUNCH_MICRO: 'lunchBreakCompleted',
    AFTER_WORK: 'afterWorkCompleted',
    WORK_FROM_HOME: 'wfhCompleted',
  };
  return typeMap[challengeType] || null;
}
