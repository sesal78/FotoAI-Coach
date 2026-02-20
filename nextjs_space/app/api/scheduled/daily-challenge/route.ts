
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { verifyCronRequest } from '@/lib/cron-auth';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  COLLECTION_USER_PROGRESS,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { generateChallenge } from '@/lib/llm';
import { getWeather } from '@/lib/weather';
import { sendChallengeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/daily-challenge - Generate and send daily challenges
 * This endpoint is called by cron jobs
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { userId, challengeType } = body;

    const { databases, users } = createAdminClient();

    // If userId is provided, generate for specific user; otherwise all users
    let userList: Array<{ $id: string; email: string; name: string }>;

    if (userId) {
      const singleUser = await users.get(userId);
      userList = [singleUser];
    } else {
      const allUsers = await users.list();
      userList = allUsers.users;
    }

    const results = [];

    for (const user of userList) {
      try {
        // Get user preferences
        const prefsResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USER_PREFERENCES,
          [Query.equal('userId', user.$id), Query.limit(1)]
        );
        const preferences = prefsResult.documents[0] ?? null;

        if (!preferences) {
          // No preferences configured — skip user
          continue;
        }

        // Check if user already has a pending challenge for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_DAILY_CHALLENGES,
          [
            Query.equal('userId', user.$id),
            Query.greaterThanEqual('issuedDate', today.toISOString()),
            Query.equal('status', 'pending'),
            Query.limit(1),
          ]
        );

        if (existingResult.documents.length > 0) {
          results.push({
            userId: user.$id,
            status: 'skipped',
            reason: 'Challenge already exists for today',
          });
          continue;
        }

        // Determine challenge type based on day and time
        const currentChallengeType = challengeType || determineChallengeType(preferences);

        // Get recent challenges to avoid repetition
        const recentResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_DAILY_CHALLENGES,
          [
            Query.equal('userId', user.$id),
            Query.orderDesc('$createdAt'),
            Query.limit(5),
          ]
        );
        const recentChallenges = recentResult.documents;

        // Get user gear
        const gearResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USER_GEAR,
          [Query.equal('userId', user.$id)]
        );
        const gear = gearResult.documents;

        // Fetch weather data
        const location =
          preferences.currentLocation || preferences.homeLocation || 'San Francisco, CA';
        const weather = await getWeather(location);

        // Prepare user profile
        const userProfile = {
          name: user.name,
          skillLevel: preferences.skillLevel,
          interests: preferences.photographyInterests,
          gear: (gear as any[]).map((g) => `${g.brand} ${g.model}`),
        };

        // Generate challenge
        const challengeData = await generateChallenge({
          userProfile,
          challengeType: currentChallengeType,
          location,
          weather: weather
            ? {
                condition: weather.condition,
                temperature: weather.temperature,
                time: new Date().toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                }),
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
            userId: user.$id,
            challengeType: currentChallengeType,
            challengeText: challengeData.challengeText,
            difficulty: challengeData.difficulty,
            category: challengeData.category,
            duration: challengeData.duration,
            weatherConditions: weather
              ? `${weather.condition}, ${weather.temperature}°F`
              : null,
            location,
            recommendedGear: challengeData.recommendedGear,
            tips: challengeData.tips,
            issuedDate: new Date().toISOString(),
            status: 'pending',
          }
        );

        // Upsert progress
        const progressResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USER_PROGRESS,
          [Query.equal('userId', user.$id), Query.limit(1)]
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
              userId: user.$id,
              totalChallengesIssued: 1,
              totalChallengesCompleted: 0,
              currentStreak: 0,
              longestStreak: 0,
            }
          );
        }

        // Send email notification
        const emailSent = await sendChallengeEmail(user.email, user.name, challengeData);

        // Log agent action
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_AGENT_ACTIONS,
          ID.unique(),
          {
            userId: user.$id,
            actionType: 'CHALLENGE_SENT',
            details: JSON.stringify({
              challengeId: challengeDoc.$id,
              challengeType: currentChallengeType,
              category: challengeDoc.category,
              emailSent,
            }),
            success: true,
          }
        );

        results.push({
          userId: user.$id,
          status: 'success',
          challengeId: challengeDoc.$id,
          emailSent,
        });
      } catch (userError) {
        console.error(`Failed to generate challenge for user ${user.$id}:`, userError);
        results.push({
          userId: user.$id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Daily challenge generation completed',
      results,
    });
  } catch (error) {
    console.error('Daily challenge cron failed:', error);
    return NextResponse.json(
      { error: 'Daily challenge generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduled/daily-challenge - Trigger via cron (GET request)
 */
export async function GET(request: NextRequest) {
  // Support GET requests from cron jobs
  return POST(request);
}

/**
 * Determine which type of challenge to generate based on day/time
 */
function determineChallengeType(preferences: Record<string, unknown>): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();

  // Saturday - Weekend deep dive
  if (dayOfWeek === 6) {
    return 'WEEKEND_DEEP_DIVE';
  }

  // Sunday - Secondary weekend day
  if (
    dayOfWeek === 0 &&
    Array.isArray(preferences.secondaryPhotoDays) &&
    (preferences.secondaryPhotoDays as string[]).includes('Sunday')
  ) {
    return 'WEEKEND_DEEP_DIVE';
  }

  // Weekday lunch time (11 AM - 1 PM)
  if (hour >= 11 && hour < 13 && preferences.lunchBreakPhotography) {
    return 'LUNCH_MICRO';
  }

  // After work (5 PM - 7 PM)
  if (hour >= 17 && hour < 19 && preferences.eveningPhotography) {
    return 'AFTER_WORK';
  }

  // Work from home flexibility
  if (preferences.wfhFlexibility) {
    return 'WORK_FROM_HOME';
  }

  // Default to lunch micro
  return 'LUNCH_MICRO';
}
