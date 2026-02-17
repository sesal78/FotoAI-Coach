import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { account } = await createSessionClient(request);
    await account.deleteSession('current');
  } catch {
    // Session may already be invalid — continue to clear the cookie
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
