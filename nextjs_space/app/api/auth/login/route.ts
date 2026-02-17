import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { account } = createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    const response = NextResponse.json({ success: true, userId: session.userId });
    response.cookies.set(SESSION_COOKIE, session.secret, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (error: any) {
    const message = error?.message || 'Invalid credentials';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
