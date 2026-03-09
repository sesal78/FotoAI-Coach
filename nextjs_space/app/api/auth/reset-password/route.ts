import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';

export async function POST(request: NextRequest) {
  try {
    const { userId, secret, password } = await request.json();

    if (!userId || !secret || !password) {
      return NextResponse.json(
        { error: 'userId, secret, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const { account } = createAdminClient();
    await account.updateRecovery(userId, secret, password);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    const message = error?.message?.includes('expired')
      ? 'Reset link has expired. Please request a new one.'
      : 'Failed to reset password. Please try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
