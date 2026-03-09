import { NextRequest, NextResponse } from 'next/server';
import { Client, Account } from 'node-appwrite';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Use a plain project-scoped client (no API key) so the returned session.secret
    // is a valid user session token compatible with setSession() in createSessionClient.
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!);
    const account = new Account(client);
    const session = await account.createEmailPasswordSession(email, password);
    console.log('[login] Session created for', session.userId, '— secret length:', session.secret?.length);

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
