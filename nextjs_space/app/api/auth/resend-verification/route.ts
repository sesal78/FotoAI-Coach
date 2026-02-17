import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';

export async function POST(request: NextRequest) {
  try {
    const { account } = await createSessionClient(request);
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
    await account.createVerification(`${appUrl}/verify-email/confirm`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to resend verification email' }, { status: 400 });
  }
}
