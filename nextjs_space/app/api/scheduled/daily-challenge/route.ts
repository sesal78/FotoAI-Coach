
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateChallenge } from '@/lib/llm';
import { getWeather } from '@/lib/weather';
import { sendChallengeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled/daily-challenge - Generate and send daily challenges
 * This endpoint is called by cron jobs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, challengeType } = body;

    // If userId is provided, generate for specific user
    // Otherwise, generate for all active users
    const users = userId
      ? [await prisma.user.findUnique({
          where: { id: userId },
          include: { preferences: true, gear: true },
        })]
      : await prisma.user.findMany({
          include: { preferences: true, gear: true },
        });

    const results = [];

    for (const user of users) {
      if (!user || !user.preferences) {
        continue;
      }

      try {
        // Check if user already has a pending challenge for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingChallenge = await prisma.dailyChallenge.findFirst({
          where: {
            userId: user.id,
            issuedDate: { gte: today },
            status: 'pending',
          },
        });

        if (existingChallenge) {
          results.push({
            userId: user.id,
            status: 'skipped',
            reason: 'Challenge already exists for today',
          });
          continue;
        }

        // Determine challenge type based on day and time
        const currentChallengeType = challengeType || determineChallengeType(user.preferences);

        // Get recent challenges to avoid repetition
        const recentChallenges = await prisma.dailyChallenge.findMany({
          where: { userId: user.id },
          orderBy: { issuedDate: 'desc' },
          take: 5,
          select: { challengeText: true },
        });

        // Fetch weather data
        const location = user.preferences.currentLocation || user.preferences.homeLocation || 'San Francisco, CA';
        const weather = await getWeather(location);

        // Prepare user profile
        const userProfile = {
          name: user.name,
          skillLevel: user.preferences.skillLevel,
          interests: user.preferences.photographyInterests,
          gear: user.gear.map(g => `${g.brand} ${g.model}`),
        };

        // Generate challenge
        const challengeData = await generateChallenge({
          userProfile,
          challengeType: currentChallengeType,
          location,
          weather: weather ? {
            condition: weather.condition,
            temperature: weather.temperature,
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          } : undefined,
          recentChallenges: recentChallenges.map(c => c.challengeText),
        });

        // Save challenge to database
        const challenge = await prisma.dailyChallenge.create({
          data: {
            userId: user.id,
            challengeType: currentChallengeType,
            challengeText: challengeData.challengeText,
            difficulty: challengeData.difficulty,
            category: challengeData.category,
            duration: challengeData.duration,
            weatherConditions: weather ? `${weather.condition}, ${weather.temperature}°F` : null,
            location,
            recommendedGear: challengeData.recommendedGear,
            tips: challengeData.tips,
            issuedDate: new Date(),
            status: 'pending',
          },
        });

        // Update progress
        await prisma.userProgress.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            totalChallengesIssued: 1,
          },
          update: {
            totalChallengesIssued: { increment: 1 },
          },
        });

        // Send email notification
        const emailSent = await sendChallengeEmail(user.email, user.name, challengeData);

        // Log agent action
        await prisma.agentAction.create({
          data: {
            userId: user.id,
            actionType: 'CHALLENGE_SENT',
            details: JSON.stringify({
              challengeId: challenge.id,
              challengeType: currentChallengeType,
              category: challenge.category,
              emailSent,
            }),
            success: true,
          },
        });

        results.push({
          userId: user.id,
          status: 'success',
          challengeId: challenge.id,
          emailSent,
        });
      } catch (userError) {
        console.error(`Failed to generate challenge for user ${user.id}:`, userError);
        results.push({
          userId: user.id,
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
function determineChallengeType(preferences: any): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();

  // Saturday - Weekend deep dive
  if (dayOfWeek === 6) {
    return 'WEEKEND_DEEP_DIVE';
  }

  // Sunday - Secondary weekend day
  if (dayOfWeek === 0 && preferences.secondaryPhotoDays.includes('Sunday')) {
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
