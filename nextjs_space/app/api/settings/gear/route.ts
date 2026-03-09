import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { DATABASE_ID, COLLECTION_USER_GEAR } from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_GEAR, [
      Query.equal('userId', userId), Query.limit(50),
    ]);
    const gear = result.documents.map((d) => ({
      id: d.$id, category: d.category, brand: d.brand, model: d.model,
    }));
    return NextResponse.json({ gear });
  } catch (error) {
    console.error('Failed to fetch gear:', error);
    return NextResponse.json({ error: 'Failed to fetch gear' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, category, brand, model } = await request.json();
    if (!userId || !brand || !model) {
      return NextResponse.json({ error: 'userId, brand, and model required' }, { status: 400 });
    }

    const { databases } = createAdminClient();
    const doc = await databases.createDocument(DATABASE_ID, COLLECTION_USER_GEAR, ID.unique(), {
      userId, category: category || 'camera', brand, model,
    });

    return NextResponse.json({
      gear: { id: doc.$id, category: doc.category, brand: doc.brand, model: doc.model },
    });
  } catch (error) {
    console.error('Failed to add gear:', error);
    return NextResponse.json({ error: 'Failed to add gear' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const gearId = request.nextUrl.searchParams.get('gearId');
  if (!gearId) return NextResponse.json({ error: 'gearId required' }, { status: 400 });

  try {
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTION_USER_GEAR, gearId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete gear:', error);
    return NextResponse.json({ error: 'Failed to delete gear' }, { status: 500 });
  }
}
