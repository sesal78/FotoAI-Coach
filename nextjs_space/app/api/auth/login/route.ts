import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';
import { createEmailSession } from '@/lib/appwrite-session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { userId, secret } = await createEmailSession(email, password);
    console.log('[login] Session created for', userId, '— secret length:', secret.length);

    const response = NextResponse.json({ success: true, userId });
    response.cookies.set(SESSION_COOKIE, secret, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error: any) {
    const message = error?.message || 'Invalid credentials';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
