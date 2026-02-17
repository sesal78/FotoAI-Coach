import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { account } = createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set(`a_session_${process.env.APPWRITE_PROJECT_ID}`, session.secret, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(session.expire),
    });

    return NextResponse.json({ success: true, userId: session.userId });
  } catch (error: any) {
    const message = error?.message || 'Invalid credentials';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
