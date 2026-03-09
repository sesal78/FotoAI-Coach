import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';
import { ID, Client, Account } from 'node-appwrite';
import {
  DATABASE_ID,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_PROGRESS,
} from '@/lib/appwrite-collections';
import { SESSION_COOKIE } from '@/lib/session';
import { createEmailSession } from '@/lib/appwrite-session';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const { account, databases } = createAdminClient();

    // Create Appwrite user
    const user = await account.create(ID.unique(), email, password, name);

    // Create session via REST API (SDK no longer returns secret in Appwrite 1.8+)
    const { secret } = await createEmailSession(email, password);

    // Initialise default preferences and progress documents
    await Promise.all([
      databases.createDocument(DATABASE_ID, COLLECTION_USER_PREFERENCES, ID.unique(), {
        userId: user.$id,
        skillLevel: 'intermediate',
        photographyInterests: ['street', 'portrait', 'architecture'],
        avoidsStyles: [],
        workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        workStartTime: '09:00',
        workEndTime: '17:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        primaryPhotoDay: 'Saturday',
        secondaryPhotoDays: ['Sunday'],
        lunchBreakPhotography: true,
        eveningPhotography: true,
        wfhFlexibility: true,
        adaptToWeather: true,
        adaptToCalendar: true,
      }),
      databases.createDocument(DATABASE_ID, COLLECTION_USER_PROGRESS, ID.unique(), {
        userId: user.$id,
        totalChallengesIssued: 0,
        totalChallengesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        saturdayChallengesCompleted: 0,
        saturdayChallengesIssued: 0,
        lunchBreakCompleted: 0,
        lunchBreakIssued: 0,
        afterWorkCompleted: 0,
        afterWorkIssued: 0,
        wfhCompleted: 0,
        wfhIssued: 0,
        favoriteSubjects: [],
        improvementAreas: [],
      }),
    ]);

    // Send email verification
    try {
      const verifyClient = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT!)
        .setProject(process.env.APPWRITE_PROJECT_ID!)
        .setSession(secret);
      const verifyAccount = new Account(verifyClient);
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
      await verifyAccount.createVerification(`${appUrl}/verify-email/confirm`);
    } catch (verifyErr) {
      console.warn('[register] Failed to send verification email:', verifyErr);
    }

    const response = NextResponse.json({ success: true, userId: user.$id });
    response.cookies.set(SESSION_COOKIE, secret, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error: any) {
    const message = error?.message || 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
