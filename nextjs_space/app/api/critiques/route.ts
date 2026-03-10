import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_PHOTO_CRITIQUES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  STORAGE_BUCKET_SUBMISSIONS,
} from '@/lib/appwrite-collections';
import { critiquePhoto } from '@/lib/llm';
import { awardCritiqueXP } from '@/lib/xp';

export const dynamic = 'force-dynamic';

/**
 * GET /api/critiques - Fetch critiques for a user
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const submissionId = request.nextUrl.searchParams.get('submissionId');
  const critiqueId = request.nextUrl.searchParams.get('critiqueId');

  if (!userId && !critiqueId) {
    return NextResponse.json({ error: 'userId or critiqueId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();

    if (critiqueId) {
      const doc = await databases.getDocument(DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, critiqueId);
      return NextResponse.json({ critique: { ...doc, id: doc.$id } });
    }

    const filters: string[] = [Query.equal('userId', userId!), Query.orderDesc('critiqueDate')];
    if (submissionId) filters.push(Query.equal('submissionId', submissionId));
    filters.push(Query.limit(20));

    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, filters);
    const critiques = result.documents.map((d) => ({ ...d, id: d.$id }));
    return NextResponse.json({ critiques });
  } catch (error) {
    console.error('Failed to fetch critiques:', error);
    return NextResponse.json({ error: 'Failed to fetch critiques' }, { status: 500 });
  }
}

/**
 * POST /api/critiques - Analyse a photo
 * Accepts multipart form: photo (File), userId, submissionId? (to critique an existing submission)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const submissionId = formData.get('submissionId') as string | null;
    const challengeText = formData.get('challengeText') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const { databases, storage } = createAdminClient();

    // Get user context in parallel
    const [prefsResult, gearResult] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
        Query.equal('userId', userId), Query.limit(1),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTION_USER_GEAR, [
        Query.equal('userId', userId), Query.limit(20),
      ]),
    ]);

    const skillLevel = prefsResult.documents[0]?.skillLevel || 'intermediate';
    const gear = gearResult.documents.map((d) => `${d.brand} ${d.model}`);

    // Resolve the image to a base64 data URI
    let imageDataUri: string;
    let photoUrl: string;

    if (photo) {
      // Direct upload — convert to base64
      const buffer = Buffer.from(await photo.arrayBuffer());
      const rawMime = photo.type || 'image/jpeg';
      const ext = (photo.name || '').toLowerCase().match(/\.\w+$/)?.[0] || '';
      const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.raw'];
      const isRaw = RAW_EXTENSIONS.includes(ext) || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(rawMime);

      if (isRaw) {
        // Check if it's actually a JPEG/PNG with wrong MIME (some cameras do this)
        const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
        if (!isJpeg && !isPng) {
          return NextResponse.json(
            { error: 'RAW files cannot be analysed directly. Please export as JPEG or PNG first, then upload for critique.' },
            { status: 400 }
          );
        }
        // It's actually JPEG/PNG with wrong extension/MIME — proceed
      }
      // Use detected MIME based on magic bytes, not the file's reported MIME
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
      const mimeType = isJpeg ? 'image/jpeg' : rawMime.startsWith('image/') ? rawMime : 'image/jpeg';
      imageDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

      // Also upload to storage for record keeping
      const { InputFile } = await import('node-appwrite/file');
      try {
        const uploaded = await storage.createFile(
          STORAGE_BUCKET_SUBMISSIONS, ID.unique(),
          InputFile.fromBuffer(buffer, photo.name),
        );
        photoUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_SUBMISSIONS}/files/${uploaded.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
      } catch {
        photoUrl = 'upload-failed';
      }
    } else if (submissionId) {
      // Critique an existing submission's photo
      const sub = await databases.getDocument(DATABASE_ID, COLLECTION_CHALLENGE_SUBMISSIONS, submissionId);
      if (!sub.photoUrl) {
        return NextResponse.json({ error: 'Submission has no photo to critique' }, { status: 400 });
      }
      photoUrl = sub.photoUrl as string;

      // Download from Appwrite and convert to base64
      const fileIdMatch = photoUrl.match(/files\/([^/]+)\//);
      if (fileIdMatch) {
        const fileBytes = await storage.getFileView(STORAGE_BUCKET_SUBMISSIONS, fileIdMatch[1]);
        const buffer = Buffer.from(fileBytes);
        // Detect actual format from magic bytes
        const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
        if (!isJpeg && !isPng) {
          return NextResponse.json(
            { error: 'This photo appears to be a RAW file. Please export as JPEG or PNG first for critique.' },
            { status: 400 }
          );
        }
        const detectedMime = isJpeg ? 'image/jpeg' : 'image/png';
        imageDataUri = `data:${detectedMime};base64,${buffer.toString('base64')}`;
      } else {
        return NextResponse.json({ error: 'Could not resolve photo from submission' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Either photo file or submissionId is required' }, { status: 400 });
    }

    // Call the LLM vision critique
    const result = await critiquePhoto({
      imageDataUri,
      skillLevel,
      challengeText: challengeText || undefined,
      gear,
    });

    // Store the critique
    const critiqueData: Record<string, unknown> = {
      userId,
      photoUrl,
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
    };
    if (submissionId) critiqueData.submissionId = submissionId;

    const doc = await databases.createDocument(
      DATABASE_ID, COLLECTION_PHOTO_CRITIQUES, ID.unique(), critiqueData,
    );

    // Fire-and-forget: award XP for high critique scores
    awardCritiqueXP(databases, userId, {
      technical: result.technicalScore,
      composition: result.compositionScore,
      creative: result.creativeScore,
    }, doc.$id).catch((err) => console.error('XP award (critique) failed:', err));

    return NextResponse.json({
      critique: { ...doc, id: doc.$id },
    });
  } catch (error) {
    console.error('Photo critique failed:', error);
    return NextResponse.json({ error: 'Failed to critique photo' }, { status: 500 });
  }
}
