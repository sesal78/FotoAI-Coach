import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-server';
import { ID } from 'node-appwrite';
import { cookies } from 'next/headers';
import {
  DATABASE_ID,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_PROGRESS,
} from '@/lib/appwrite-collections';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const { account, databases } = createAdminClient();

    // Create Appwrite user
    const user = await account.create(ID.unique(), email, password, name);

    // Create a session immediately so the user is logged in after registration
    const session = await account.createEmailPasswordSession(email, password);

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

    const cookieStore = await cookies();
    cookieStore.set(`a_session_${process.env.APPWRITE_PROJECT_ID}`, session.secret, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(session.expire),
    });

    return NextResponse.json({ success: true, userId: user.$id });
  } catch (error: any) {
    const message = error?.message || 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
