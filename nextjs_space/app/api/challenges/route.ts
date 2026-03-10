
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_CHALLENGE_SUBMISSIONS,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { generateChallenge } from '@/lib/llm';
import { getWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

/**
 * GET /api/challenges - Get user's challenges
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status'); // pending, completed, all
    const limit = parseInt(searchParams.get('limit') || '10');
    const latest = searchParams.get('latest');

    const { databases } = createAdminClient();

    // Fetch latest challenge for share buttons (no auth required)
    if (latest === 'true') {
      const result = await databases.listDocuments(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, [
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ]);

      const latestChallenge = result.documents[0] ?? null;
      if (latestChallenge) {
        return NextResponse.json({ challenge: { ...latestChallenge, id: latestChallenge.$id } });
      }
      return NextResponse.json({ challenge: null });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const filters: string[] = [
      Query.equal('userId', userId),
      Query.orderDesc('issuedDate'),
      Query.limit(limit),
    ];

    if (status && status !== 'all') {
      filters.push(Query.equal('status', status));
    }

    const challengesResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      filters
    );

    // Fetch submissions for each challenge
    const challenges = await Promise.all(
      challengesResult.documents.map(async (challenge) => {
        const submissionsResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_CHALLENGE_SUBMISSIONS,
          [Query.equal('challengeId', challenge.$id)]
        );
        return {
          ...challenge,
          id: challenge.$id,
          submissions: submissionsResult.documents.map((s) => ({ ...s, id: s.$id })),
        };
      })
    );

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/challenges - Generate a new challenge
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, challengeType, forceGenerate = false } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { databases, users } = createAdminClient();

    // Check if user already has a pending challenge for today
    if (!forceGenerate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingResult = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_DAILY_CHALLENGES,
        [
          Query.equal('userId', userId),
          Query.equal('status', 'pending'),
          Query.notEqual('challengeType', 'CHATBOT_GENERATED'),
          Query.greaterThanEqual('issuedDate', today.toISOString()),
          Query.limit(1),
        ]
      );

      if (existingResult.documents.length > 0) {
        const existingChallenge = { ...existingResult.documents[0], id: existingResult.documents[0].$id };
        return NextResponse.json({
          challenge: existingChallenge,
          message: 'Challenge already exists for today',
        });
      }
    }

    // Fetch user from Appwrite Auth
    let user;
    try {
      user = await users.get(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user preferences
    const prefsResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_PREFERENCES,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    const preferences = prefsResult.documents[0] ?? null;

    if (!preferences) {
      return NextResponse.json({ error: 'User preferences not found' }, { status: 404 });
    }

    // Get user gear
    const gearResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_GEAR,
      [Query.equal('userId', userId)]
    );
    const gear = gearResult.documents;

    // Get recent challenges to avoid repetition
    const recentResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(5),
      ]
    );
    const recentChallenges = recentResult.documents;

    // Fetch weather data
    const location = preferences.currentLocation || preferences.homeLocation || 'Melbourne, Australia';
    const weather = await getWeather(location);

    // Prepare user profile for challenge generation
    const userProfile = {
      name: user.name,
      skillLevel: preferences.skillLevel,
      interests: preferences.photographyInterests,
      gear: (gear as any[]).map((g) => `${g.brand} ${g.model}`),
    };

    // Generate challenge using LLM
    const challengeData = await generateChallenge({
      userProfile,
      challengeType: challengeType || 'WEEKEND_DEEP_DIVE',
      location,
      weather: weather
        ? {
            condition: weather.condition,
            temperature: weather.temperature,
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          }
        : undefined,
      recentChallenges: (recentChallenges as any[]).map((c) => c.challengeText),
    });

    // Save challenge to Appwrite
    const challengeDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      ID.unique(),
      {
        userId,
        challengeType: challengeType || 'WEEKEND_DEEP_DIVE',
        challengeText: challengeData.challengeText,
        difficulty: challengeData.difficulty,
        category: challengeData.category,
        duration: challengeData.duration,
        weatherConditions: weather ? `${weather.condition}, ${weather.temperature}°F` : null,
        location,
        recommendedGear: challengeData.recommendedGear,
        tips: challengeData.tips,
        issuedDate: new Date().toISOString(),
        status: 'pending',
        // Story-Driven fields
        ...(challengeData.shotList && { shotList: challengeData.shotList }),
        ...(challengeData.narrativeContext && { narrativeContext: challengeData.narrativeContext }),
        ...(challengeData.editingDirection && { editingDirection: challengeData.editingDirection }),
        // Technical Mastery fields
        ...(challengeData.masteryArea && { masteryArea: challengeData.masteryArea }),
        ...(challengeData.technicalLevel && { technicalLevel: challengeData.technicalLevel }),
        ...(challengeData.successCriteria && { successCriteria: challengeData.successCriteria }),
        ...(challengeData.whatToLookFor && { whatToLookFor: challengeData.whatToLookFor }),
      }
    );

    // Upsert user progress (check first, then create or update)
    const progressResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USER_PROGRESS,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (progressResult.documents.length > 0) {
      const progressDoc = progressResult.documents[0];
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_USER_PROGRESS,
        progressDoc.$id,
        {
          totalChallengesIssued: (progressDoc.totalChallengesIssued || 0) + 1,
        }
      );
    } else {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_USER_PROGRESS,
        ID.unique(),
        {
          userId,
          totalChallengesIssued: 1,
          totalChallengesCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        }
      );
    }

    // Log agent action
    await databases.createDocument(
      DATABASE_ID,
      COLLECTION_AGENT_ACTIONS,
      ID.unique(),
      {
        userId,
        actionType: 'CHALLENGE_SENT',
        details: JSON.stringify({
          challengeId: challengeDoc.$id,
          challengeType: challengeDoc.challengeType,
          category: challengeDoc.category,
        }),
        success: true,
      }
    );

    const challenge = { ...challengeDoc, id: challengeDoc.$id };

    return NextResponse.json({
      challenge,
      message: 'Challenge generated successfully',
    });
  } catch (error) {
    console.error('Failed to generate challenge:', error);
    return NextResponse.json(
      { error: 'Failed to generate challenge' },
      { status: 500 }
    );
  }
}
