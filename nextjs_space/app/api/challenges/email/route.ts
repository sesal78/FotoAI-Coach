import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite-server';
import { sendChallengeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Require authenticated user
  let user;
  try {
    const { account } = await createSessionClient(request);
    user = await account.get();
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { challengeText, category, difficulty, duration, tips, recommendedGear } = body;

    if (!challengeText) {
      return NextResponse.json({ error: 'Challenge text is required' }, { status: 400 });
    }

    const sent = await sendChallengeEmail(user.email, user.name || 'Photographer', {
      challengeText,
      difficulty: difficulty || 'intermediate',
      category: category || 'general',
      duration: duration || '30 mins',
      tips: tips || '',
      recommendedGear: Array.isArray(recommendedGear) ? recommendedGear : [],
    });

    if (sent) {
      return NextResponse.json({ success: true, message: 'Challenge emailed successfully' });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email. Check server email configuration.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email challenge failed:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
