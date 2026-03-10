
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
  COLLECTION_PHOTO_CRITIQUES,
  STORAGE_BUCKET_SUBMISSIONS,
} from '@/lib/appwrite-collections';
import { generateFeedback, critiquePhoto } from '@/lib/llm';
import { awardChallengeXP, awardSubmissionXP } from '@/lib/xp';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  // RAW formats
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
  'image/x-olympus-orf', 'image/x-panasonic-rw2', 'image/x-pentax-pef',
  'image/x-samsung-srw', 'image/x-dcraw',
  // Some browsers report RAW as generic
  'application/octet-stream',
];
const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.raw'];
const VISION_SUPPORTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (RAW files are large)

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
      const ext = (photo.name || '').toLowerCase().match(/\.\w+$/)?.[0] || '';
      const isRawByExt = RAW_EXTENSIONS.includes(ext);
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(photo.type);
      if (!isAllowedMime && !isRawByExt) {
        return NextResponse.json(
          { error: `Invalid file type "${photo.type}". Allowed: JPEG, PNG, WebP, HEIC, and RAW formats (CR2, NEF, ARW, DNG, RAF, ORF, etc.)` },
          { status: 400 }
        );
      }
      if (photo.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size: 50 MB' },
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

    // Fire-and-forget: award XP for challenge completion + submission
    awardChallengeXP(
      databases, userId,
      challenge.challengeType as string,
      challenge.difficulty as string || 'medium',
      challenge.category as string || 'street',
      challengeId,
    ).catch((err) => console.error('XP award (challenge) failed:', err));

    awardSubmissionXP(databases, userId, submissionDoc.$id)
      .catch((err) => console.error('XP award (submission) failed:', err));

    // Fire-and-forget: generate feedback + photo critique asynchronously
    generateFeedbackAsync(databases, submissionDoc.$id, {
      challengeText: challenge.challengeText as string,
      userNotes: notes || undefined,
      skillLevel: preferences?.skillLevel || 'intermediate',
    }).catch((err) => {
      console.error('Async feedback generation failed:', err);
    });

    if (photoUrl) {
      generateCritiqueAsync(databases, storage, {
        userId,
        submissionId: submissionDoc.$id,
        photoUrl,
        challengeText: challenge.challengeText as string,
        skillLevel: preferences?.skillLevel || 'intermediate',
      }).catch((err) => {
        console.error('Async photo critique failed:', err);
      });
    }

    return NextResponse.json({
      submission: { ...submissionDoc, id: submissionDoc.$id },
      message: photoUrl
        ? 'Challenge submitted! Feedback and photo critique are being generated...'
        : 'Challenge submitted successfully! Feedback is being generated...',
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

async function generateCritiqueAsync(
  databases: any,
  storage: any,
  context: {
    userId: string;
    submissionId: string;
    photoUrl: string;
    challengeText: string;
    skillLevel: string;
  },
) {
  try {
    // Fetch gear for context
    const gearResult = await databases.listDocuments(
      DATABASE_ID, COLLECTION_USER_GEAR,
      [Query.equal('userId', context.userId), Query.limit(20)],
    );
    const gear = gearResult.documents.map((d: any) => `${d.brand} ${d.model}`);

    // Download photo from Appwrite storage and convert to base64
    const fileIdMatch = context.photoUrl.match(/files\/([^/]+)\//);
    if (!fileIdMatch) {
      console.error('Could not extract file ID from photoUrl:', context.photoUrl);
      return;
    }

    const fileBytes = await storage.getFileView(STORAGE_BUCKET_SUBMISSIONS, fileIdMatch[1]);
    const buffer = Buffer.from(fileBytes);

    // Detect format: if it's a RAW file (not JPEG/PNG), we can't send to vision API
    // Check JPEG magic bytes (FF D8 FF) or PNG (89 50 4E 47)
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    if (!isJpeg && !isPng) {
      console.warn('Auto-critique skipped: file is not JPEG/PNG (likely RAW). Vision API requires standard image formats.');
      return;
    }
    const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
    const imageDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const result = await critiquePhoto({
      imageDataUri,
      skillLevel: context.skillLevel,
      challengeText: context.challengeText,
      gear,
    });

    const critiqueDoc = await databases.createDocument(DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, ID.unique(), {
      userId: context.userId,
      submissionId: context.submissionId,
      photoUrl: context.photoUrl,
      technicalScore: result.technicalScore,
      compositionScore: result.compositionScore,
      creativeScore: result.creativeScore,
      overallScore: result.overallScore,
      technicalFeedback: result.technicalFeedback,
      compositionFeedback: result.compositionFeedback,
      creativeFeedback: result.creativeFeedback,
      strengths: result.strengths,
      improvements: result.improvements,
      suggestedSettings: result.suggestedSettings || '',
      critiqueDate: new Date().toISOString(),
    });

    console.log('Auto-critique generated for submission:', context.submissionId);

    // Award XP for high critique scores
    const { awardCritiqueXP } = await import('@/lib/xp');
    await awardCritiqueXP(databases, context.userId, {
      technical: result.technicalScore,
      composition: result.compositionScore,
      creative: result.creativeScore,
    }, critiqueDoc.$id).catch((err: unknown) => console.error('XP award (auto-critique) failed:', err));
  } catch (error) {
    console.error('Auto-critique failed for submission:', context.submissionId, error);
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
