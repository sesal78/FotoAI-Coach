import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_PORTFOLIO_ANALYSES,
  COLLECTION_USER_PREFERENCES,
} from '@/lib/appwrite-collections';
import { assessPortfolioPhoto, analyzePortfolioMeta } from '@/lib/llm';
import type { PortfolioPhotoAssessment, PortfolioAnalysis } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 3;
const MAX_ANALYSES_PER_DAY = 3;
const MAX_CONCURRENT = 5;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per photo

/**
 * GET /api/portfolio?userId=xxx — Fetch portfolio analysis history
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_PORTFOLIO_ANALYSES, [
      Query.equal('userId', userId),
      Query.orderDesc('analysisDate'),
      Query.limit(limit),
    ]);

    const analyses = result.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId,
      photoCount: doc.photoCount,
      analysis: JSON.parse((doc.analysisJson as string) || '{}'),
      analysisDate: doc.analysisDate,
    }));

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error('Failed to fetch portfolio analyses:', error);
    return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 });
  }
}

/**
 * POST /api/portfolio — Upload multiple photos and get portfolio analysis
 * Accepts multipart form: userId + photo_0..photo_N files
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const { databases } = createAdminClient();

    // Rate limit: max 3 analyses per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAnalyses = await databases.listDocuments(DATABASE_ID, COLLECTION_PORTFOLIO_ANALYSES, [
      Query.equal('userId', userId),
      Query.greaterThanEqual('analysisDate', todayStart.toISOString()),
      Query.limit(MAX_ANALYSES_PER_DAY + 1),
    ]);

    if (todayAnalyses.documents.length >= MAX_ANALYSES_PER_DAY) {
      return NextResponse.json(
        { error: `Rate limit: maximum ${MAX_ANALYSES_PER_DAY} portfolio analyses per day` },
        { status: 429 },
      );
    }

    // Collect photo files
    const photos: File[] = [];
    for (let i = 0; i < MAX_PHOTOS; i++) {
      const file = formData.get(`photo_${i}`) as File | null;
      if (file) photos.push(file);
    }

    if (photos.length < MIN_PHOTOS) {
      return NextResponse.json(
        { error: `At least ${MIN_PHOTOS} photos required (received ${photos.length})` },
        { status: 400 },
      );
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS} photos allowed (received ${photos.length})` },
        { status: 400 },
      );
    }

    // Validate files
    for (let i = 0; i < photos.length; i++) {
      if (!ALLOWED_MIME_TYPES.includes(photos[i].type)) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: invalid file type. Allowed: JPEG, PNG, WebP, HEIC` },
          { status: 400 },
        );
      }
      if (photos[i].size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: file too large. Maximum 10 MB per photo` },
          { status: 400 },
        );
      }
    }

    // Get user skill level
    const prefsResult = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
      Query.equal('userId', userId), Query.limit(1),
    ]);
    const skillLevel = prefsResult.documents[0]?.skillLevel || 'intermediate';

    // Convert all photos to base64 data URIs
    const imageDataUris: string[] = [];
    for (const photo of photos) {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const mimeType = photo.type || 'image/jpeg';
      imageDataUris.push(`data:${mimeType};base64,${buffer.toString('base64')}`);
    }

    // Step 1: Per-image assessments (parallel, max 5 concurrent)
    const assessments: PortfolioPhotoAssessment[] = [];
    for (let batch = 0; batch < imageDataUris.length; batch += MAX_CONCURRENT) {
      const batchPromises = imageDataUris
        .slice(batch, batch + MAX_CONCURRENT)
        .map((uri, batchIdx) =>
          assessPortfolioPhoto({
            imageDataUri: uri,
            index: batch + batchIdx,
            skillLevel,
          }),
        );
      const batchResults = await Promise.all(batchPromises);
      assessments.push(...batchResults);
    }

    // Step 2: Meta-analysis pass (text-only, uses assessment data)
    const metaResult = await analyzePortfolioMeta({
      assessments,
      skillLevel,
      photoCount: photos.length,
    });

    const fullAnalysis: PortfolioAnalysis = {
      photoAssessments: assessments,
      ...metaResult,
    };

    // Persist to Appwrite
    const doc = await databases.createDocument(DATABASE_ID, COLLECTION_PORTFOLIO_ANALYSES, ID.unique(), {
      userId,
      photoCount: photos.length,
      analysisJson: JSON.stringify(fullAnalysis),
      analysisDate: new Date().toISOString(),
    });

    return NextResponse.json({
      id: doc.$id,
      analysis: fullAnalysis,
    });
  } catch (error) {
    console.error('Portfolio analysis failed:', error);
    return NextResponse.json({ error: 'Failed to analyze portfolio' }, { status: 500 });
  }
}
