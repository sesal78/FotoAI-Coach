
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const whereClause: any = { userId };
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const challenges = await prisma.dailyChallenge.findMany({
      where: whereClause,
      orderBy: { issuedDate: 'desc' },
      take: limit,
      include: {
        submissions: true,
      },
    });

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

    // Check if user already has a pending challenge for today
    if (!forceGenerate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingChallenge = await prisma.dailyChallenge.findFirst({
        where: {
          userId,
          issuedDate: {
            gte: today,
          },
          status: 'pending',
        },
      });

      if (existingChallenge) {
        return NextResponse.json({
          challenge: existingChallenge,
          message: 'Challenge already exists for today',
        });
      }
    }

    // Fetch user profile and preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        gear: true,
      },
    });

    if (!user || !user.preferences) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get recent challenges to avoid repetition
    const recentChallenges = await prisma.dailyChallenge.findMany({
      where: { userId },
      orderBy: { issuedDate: 'desc' },
      take: 5,
      select: { challengeText: true },
    });

    // Fetch weather data
    const location = user.preferences.currentLocation || user.preferences.homeLocation || 'San Francisco, CA';
    const weather = await getWeather(location);

    // Prepare user profile for challenge generation
    const userProfile = {
      name: user.name,
      skillLevel: user.preferences.skillLevel,
      interests: user.preferences.photographyInterests,
      gear: user.gear.map((g: { brand: string; model: string }) => `${g.brand} ${g.model}`),
    };

    // Generate challenge using LLM
    const challengeData = await generateChallenge({
      userProfile,
      challengeType: challengeType || 'WEEKEND_DEEP_DIVE',
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
        issuedDate: new Date(),
        status: 'pending',
      },
    });

    // Update user progress
    await prisma.userProgress.upsert({
      where: { userId },
      create: {
        userId,
        totalChallengesIssued: 1,
      },
      update: {
        totalChallengesIssued: { increment: 1 },
      },
    });

    // Log agent action
    await prisma.agentAction.create({
      data: {
        userId,
        actionType: 'CHALLENGE_SENT',
        details: JSON.stringify({
          challengeId: challenge.id,
          challengeType: challenge.challengeType,
          category: challenge.category,
        }),
        success: true,
      },
    });

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
