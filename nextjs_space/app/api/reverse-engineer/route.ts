import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_REVERSE_ANALYSES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  STORAGE_BUCKET_SUBMISSIONS,
} from '@/lib/appwrite-collections';
import { reverseEngineerPhoto } from '@/lib/llm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reverse-engineer — Fetch reverse analyses for a user
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_REVERSE_ANALYSES, [
      Query.equal('userId', userId),
      Query.orderDesc('analysisDate'),
      Query.limit(20),
    ]);

    const analyses = result.documents.map((d) => ({
      id: d.$id,
      userId: d.userId,
      photoUrl: d.photoUrl,
      result: JSON.parse(d.resultJson || '{}'),
      analysisDate: d.analysisDate,
    }));

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error('Failed to fetch reverse analyses:', error);
    return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 });
  }
}

/**
 * POST /api/reverse-engineer — Reverse-engineer an uploaded inspiration photo
 * Accepts multipart form: photo (File), userId
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const photo = formData.get('photo') as File | null;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    if (!photo) {
      return NextResponse.json({ error: 'photo file required' }, { status: 400 });
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

    // Convert photo to base64 data URI
    const buffer = Buffer.from(await photo.arrayBuffer());
    const mimeType = photo.type || 'image/jpeg';
    const imageDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // Upload to storage for record keeping
    let photoUrl = 'upload-failed';
    try {
      const { InputFile } = await import('node-appwrite/file');
      const uploaded = await storage.createFile(
        STORAGE_BUCKET_SUBMISSIONS, ID.unique(),
        InputFile.fromBuffer(buffer, photo.name),
      );
      photoUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_SUBMISSIONS}/files/${uploaded.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
    } catch {
      // Non-critical — continue even if storage upload fails
    }

    // Call the LLM vision reverse-engineering
    const result = await reverseEngineerPhoto({ imageDataUri, skillLevel, gear });

    // Persist to collection
    const doc = await databases.createDocument(
      DATABASE_ID, COLLECTION_REVERSE_ANALYSES, ID.unique(), {
        userId,
        photoUrl,
        resultJson: JSON.stringify(result),
        analysisDate: new Date().toISOString(),
      },
    );

    return NextResponse.json({
      analysis: {
        id: doc.$id,
        userId,
        photoUrl,
        result,
        analysisDate: doc.analysisDate,
      },
    });
  } catch (error) {
    console.error('Reverse engineering failed:', error);
    return NextResponse.json({ error: 'Failed to analyse photo' }, { status: 500 });
  }
}
