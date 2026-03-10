import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_EDITING_RECIPES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  STORAGE_BUCKET_SUBMISSIONS,
} from '@/lib/appwrite-collections';
import { generateEditingRecipe } from '@/lib/llm';
import type { EditingRecipeAnalysis } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/editing-recipe?userId=xxx
 * Fetch editing recipe history for a user.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_EDITING_RECIPES,
      [
        Query.equal('userId', userId),
        Query.orderDesc('analysisDate'),
        Query.limit(20),
      ]
    );

    const recipes: EditingRecipeAnalysis[] = result.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId as string,
      originalPhotoUrl: doc.originalPhotoUrl as string,
      editedPhotoUrl: doc.editedPhotoUrl as string,
      recipe: JSON.parse((doc.recipeJson as string) || '{}'),
      analysisDate: doc.analysisDate as string,
    }));

    return NextResponse.json({ recipes });
  } catch (error) {
    console.error('Failed to fetch editing recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

/**
 * POST /api/editing-recipe
 * Accepts multipart form: originalPhoto (File), editedPhoto (File), userId
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const originalPhoto = formData.get('originalPhoto') as File | null;
    const editedPhoto = formData.get('editedPhoto') as File | null;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    if (!originalPhoto || !editedPhoto) {
      return NextResponse.json({ error: 'Both originalPhoto and editedPhoto are required' }, { status: 400 });
    }

    const { databases, storage } = createAdminClient();

    // Get user context
    const [prefsResult, gearResult] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
        Query.equal('userId', userId), Query.limit(1),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTION_USER_GEAR, [
        Query.equal('userId', userId), Query.limit(20),
      ]),
    ]);

    const skillLevel = (prefsResult.documents[0]?.skillLevel as string) || 'intermediate';
    const gear = gearResult.documents.map((d) => `${d.brand} ${d.model}`);

    // Convert both photos to base64 data URIs
    const [originalBuffer, editedBuffer] = await Promise.all([
      originalPhoto.arrayBuffer().then((ab) => Buffer.from(ab)),
      editedPhoto.arrayBuffer().then((ab) => Buffer.from(ab)),
    ]);

    // Detect MIME from magic bytes — RAW files report wrong MIME types
    function detectMime(buf: Buffer, fallback: string): string {
      if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg';
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp'; // RIFF (WebP)
      // If none match, it's likely a RAW file
      return fallback;
    }

    const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.raw'];
    const VISION_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    const originalMime = detectMime(originalBuffer, originalPhoto.type || 'image/jpeg');
    const editedMime = detectMime(editedBuffer, editedPhoto.type || 'image/jpeg');

    // Check if either file is a RAW that can't be sent to vision API
    const origExt = (originalPhoto.name || '').toLowerCase().match(/\.\w+$/)?.[0] || '';
    const editExt = (editedPhoto.name || '').toLowerCase().match(/\.\w+$/)?.[0] || '';

    if ((RAW_EXTENSIONS.includes(origExt) && !VISION_MIMES.includes(originalMime)) ||
        (RAW_EXTENSIONS.includes(editExt) && !VISION_MIMES.includes(editedMime))) {
      return NextResponse.json(
        { error: 'RAW files cannot be analysed directly by the AI vision model. Please export both photos as JPEG or PNG first.' },
        { status: 400 }
      );
    }

    const originalDataUri = `data:${originalMime};base64,${originalBuffer.toString('base64')}`;
    const editedDataUri = `data:${editedMime};base64,${editedBuffer.toString('base64')}`;

    // Upload both to storage for record keeping
    const { InputFile } = await import('node-appwrite/file');
    let originalPhotoUrl = 'upload-failed';
    let editedPhotoUrl = 'upload-failed';

    try {
      const [origUpload, editUpload] = await Promise.all([
        storage.createFile(STORAGE_BUCKET_SUBMISSIONS, ID.unique(), InputFile.fromBuffer(originalBuffer, `original-${originalPhoto.name}`)),
        storage.createFile(STORAGE_BUCKET_SUBMISSIONS, ID.unique(), InputFile.fromBuffer(editedBuffer, `edited-${editedPhoto.name}`)),
      ]);
      const baseUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_SUBMISSIONS}/files`;
      const projectParam = `project=${process.env.APPWRITE_PROJECT_ID}`;
      originalPhotoUrl = `${baseUrl}/${origUpload.$id}/view?${projectParam}`;
      editedPhotoUrl = `${baseUrl}/${editUpload.$id}/view?${projectParam}`;
    } catch (uploadError) {
      console.error('Photo upload failed (non-blocking):', uploadError);
    }

    // Call the LLM two-image vision comparison
    const recipe = await generateEditingRecipe({
      originalImageDataUri: originalDataUri,
      editedImageDataUri: editedDataUri,
      skillLevel,
      gear,
    });

    // Persist the recipe
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_EDITING_RECIPES,
      ID.unique(),
      {
        userId,
        originalPhotoUrl,
        editedPhotoUrl,
        recipeJson: JSON.stringify(recipe),
        analysisDate: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      recipe: {
        id: doc.$id,
        userId,
        originalPhotoUrl,
        editedPhotoUrl,
        recipe,
        analysisDate: doc.analysisDate,
      } satisfies EditingRecipeAnalysis,
    });
  } catch (error) {
    console.error('Editing recipe generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate editing recipe' }, { status: 500 });
  }
}
