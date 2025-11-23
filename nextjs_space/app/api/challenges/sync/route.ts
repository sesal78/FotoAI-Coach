
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/challenges/sync
 * Syncs challenges from the chatbot to the dashboard database
 * 
 * Expected body:
 * {
 *   userId: string,
 *   challengeText: string,
 *   category?: string,
 *   difficulty?: string,
 *   duration?: string,
 *   location?: string,
 *   recommendedGear?: string[],
 *   tips?: string,
 *   weatherConditions?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 Received challenge sync request:', body);

    const {
      userId,
      challengeText,
      category,
      difficulty,
      duration,
      location,
      recommendedGear,
      tips,
      weatherConditions,
    } = body;

    // Validate required fields
    if (!userId || !challengeText) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, challengeText' },
        { status: 400 }
      );
    }

    // Check if user has pending challenges
    const existingChallenge = await prisma.dailyChallenge.findFirst({
      where: {
        userId: userId.toString(),
        status: 'pending',
      },
    });

    if (existingChallenge) {
      console.log('⚠️ User already has a pending challenge, updating it');
      
      // Update existing challenge
      const updatedChallenge = await prisma.dailyChallenge.update({
        where: { id: existingChallenge.id },
        data: {
          challengeText,
          category: category || existingChallenge.category,
          difficulty: difficulty || existingChallenge.difficulty,
          duration: duration || existingChallenge.duration,
          location: location || existingChallenge.location,
          recommendedGear: recommendedGear || existingChallenge.recommendedGear,
          tips: tips || existingChallenge.tips,
          weatherConditions: weatherConditions || existingChallenge.weatherConditions,
        },
      });

      console.log('✅ Challenge updated:', updatedChallenge.id);
      
      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
        updated: true,
      });
    }

    // Create new challenge
    const challenge = await prisma.dailyChallenge.create({
      data: {
        userId: userId.toString(),
        challengeText,
        category: category || 'General',
        difficulty: difficulty || 'Intermediate',
        duration: duration || '30 mins',
        location: location || null,
        recommendedGear: recommendedGear || [],
        tips: tips || null,
        weatherConditions: weatherConditions || null,
        status: 'pending',
      },
    });

    console.log('✅ New challenge created:', challenge.id);

    return NextResponse.json({
      success: true,
      challenge,
      created: true,
    });

  } catch (error) {
    console.error('❌ Challenge sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to sync challenge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const challenge = await prisma.dailyChallenge.findFirst({
      where: {
        userId: userId,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      hasChallenge: !!challenge,
      challenge: challenge || null,
    });

  } catch (error) {
    console.error('Failed to check sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
