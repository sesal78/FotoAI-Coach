import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';

export async function GET(request: Request) {
  try {
    const { account } = await createSessionClient(request);
    const user = await account.get();

    return NextResponse.json({
      id: user.$id,
      email: user.email,
      name: user.name,
    });
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
