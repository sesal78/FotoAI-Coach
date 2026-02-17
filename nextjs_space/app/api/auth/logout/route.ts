import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { account } = await createSessionClient(request);
    await account.deleteSession('current');
  } catch {
    // Session may already be invalid — continue to clear the cookie
  }

  const cookieStore = await cookies();
  cookieStore.delete(`a_session_${process.env.APPWRITE_PROJECT_ID}`);

  return NextResponse.json({ success: true });
}
