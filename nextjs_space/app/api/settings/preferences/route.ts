import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { DATABASE_ID, COLLECTION_USER_PREFERENCES } from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
      Query.equal('userId', userId), Query.limit(1),
    ]);
    return NextResponse.json({ preferences: result.documents[0] ?? null });
  } catch (error) {
    console.error('Failed to fetch preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, skillLevel, photographyInterests, homeLocation, currentLocation } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_PREFERENCES, [
      Query.equal('userId', userId), Query.limit(1),
    ]);

    if (result.documents.length === 0) {
      return NextResponse.json({ error: 'Preferences not found' }, { status: 404 });
    }

    const doc = result.documents[0];
    const updateData: Record<string, unknown> = {};
    if (skillLevel) updateData.skillLevel = skillLevel;
    if (photographyInterests) updateData.photographyInterests = photographyInterests;
    if (homeLocation !== undefined) updateData.homeLocation = homeLocation || null;
    if (currentLocation !== undefined) updateData.currentLocation = currentLocation || null;

    const updated = await databases.updateDocument(DATABASE_ID, COLLECTION_USER_PREFERENCES, doc.$id, updateData);
    return NextResponse.json({ preferences: updated });
  } catch (error) {
    console.error('Failed to update preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
