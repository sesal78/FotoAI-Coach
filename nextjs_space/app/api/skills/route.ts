import { NextRequest, NextResponse } from 'next/server';
import { getUserSkillTree } from '@/lib/xp';
import { createAdminClient } from '@/lib/appwrite-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/skills?userId=xxx
 * Returns the full skill tree state for a user including XP, status, and level.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();
    const tree = await getUserSkillTree(databases, userId);
    return NextResponse.json(tree);
  } catch (error) {
    console.error('Failed to fetch skill tree:', error);
    return NextResponse.json({ error: 'Failed to fetch skill tree' }, { status: 500 });
  }
}
