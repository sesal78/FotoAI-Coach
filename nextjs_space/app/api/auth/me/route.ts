import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { account } = await createSessionClient(request);
    const user = await account.get();

    return NextResponse.json(
      { id: user.$id, email: user.email, name: user.name },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('[/api/auth/me]', err.message || err);
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
