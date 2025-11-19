
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeather, analyzeWeatherForPhotography } from '@/lib/weather';
import { sendWeatherAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/weather-monitor - Monitor weather and send alerts
 * This endpoint is called by cron jobs every 3 hours
 */
export async function POST(request: NextRequest) {
  try {
    // Get all active users
    const users = await prisma.user.findMany({
      include: { preferences: true },
    });

    const results = [];

    for (const user of users) {
      if (!user.preferences || !user.preferences.adaptToWeather) {
        continue;
      }

      try {
        const location = user.preferences.currentLocation || user.preferences.homeLocation || 'San Francisco, CA';
        const weather = await getWeather(location);

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
          await prisma.agentAction.create({
            data: {
              userId: user.id,
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
            },
          });

          results.push({
            userId: user.id,
            status: 'alert_sent',
            score: analysis.score,
            emailSent,
          });
        } else {
          results.push({
            userId: user.id,
            status: 'no_alert',
            score: analysis.score,
          });
        }
      } catch (userError) {
        console.error(`Weather monitor failed for user ${user.id}:`, userError);
        results.push({
          userId: user.id,
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
