
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { verifyCronRequest } from '@/lib/cron-auth';
import {
  DATABASE_ID,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { getWeather, analyzeWeatherForPhotography } from '@/lib/weather';
import { sendWeatherAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/weather-monitor - Monitor weather and send alerts
 * This endpoint is called by cron jobs every 3 hours
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const { databases, users } = createAdminClient();

    // Get all users from Appwrite Auth
    const allUsers = await users.list();
    const userList = allUsers.users;

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

        if (!preferences || !preferences.adaptToWeather) {
          continue;
        }

        const location =
          preferences.currentLocation || preferences.homeLocation || 'San Francisco, CA';
        const weather = await getWeather(location as string);

        if (!weather) {
          continue;
        }

        const analysis = analyzeWeatherForPhotography(weather);

        // Send alert for exceptional photography conditions
        if (analysis.score >= 80) {
          const alertMessage = `${weather.condition} conditions with ${weather.temperature}°F - ${analysis.recommendation}`;
          const suggestion = `Great time for ${analysis.suggestedStyles.slice(0, 3).join(', ')} photography!`;

          const emailSent = await sendWeatherAlert(user.email, user.name, {
            condition: weather.condition,
            message: alertMessage,
            suggestion,
          });

          // Log agent action
          await databases.createDocument(
            DATABASE_ID,
            COLLECTION_AGENT_ACTIONS,
            ID.unique(),
            {
              userId: user.$id,
              actionType: 'WEATHER_ALERT',
              details: JSON.stringify({
                location,
                weather: {
                  condition: weather.condition,
                  temperature: weather.temperature,
                },
                score: analysis.score,
                emailSent,
              }),
              success: true,
            }
          );

          results.push({
            userId: user.$id,
            status: 'alert_sent',
            score: analysis.score,
            emailSent,
          });
        } else {
          results.push({
            userId: user.$id,
            status: 'no_alert',
            score: analysis.score,
          });
        }
      } catch (userError) {
        console.error(`Weather monitor failed for user ${user.$id}:`, userError);
        results.push({
          userId: user.$id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Weather monitoring completed',
      results,
    });
  } catch (error) {
    console.error('Weather monitor cron failed:', error);
    return NextResponse.json(
      { error: 'Weather monitoring failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduled/weather-monitor - Trigger via cron (GET request)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
