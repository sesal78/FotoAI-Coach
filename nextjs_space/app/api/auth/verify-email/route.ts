import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';

export async function POST(request: NextRequest) {
  try {
    const { userId, secret } = await request.json();

    if (!userId || !secret) {
      return NextResponse.json({ error: 'userId and secret are required' }, { status: 400 });
    }

    const { account } = await createSessionClient(request);
    await account.updateVerification(userId, secret);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 400 });
  }
}
