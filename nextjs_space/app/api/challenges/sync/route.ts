import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
} from '@/lib/appwrite-collections';

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
    console.log('Received challenge sync request:', body);

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

    // Convert recommendedGear to array if it's a string
    const gearArray = Array.isArray(recommendedGear)
      ? recommendedGear
      : recommendedGear
      ? [recommendedGear]
      : [];

    const { databases } = createAdminClient();

    // Check if user has a pending challenge (findFirst equivalent)
    const existingResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      [
        Query.equal('userId', userId.toString()),
        Query.equal('status', 'pending'),
        Query.limit(1),
      ]
    );

    if (existingResult.documents.length > 0) {
      const existingChallenge = existingResult.documents[0];
      console.log('User already has a pending challenge, updating it');

      // Update existing challenge
      const updatedDoc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_DAILY_CHALLENGES,
        existingChallenge.$id,
        {
          challengeText,
          category: category || existingChallenge.category,
          difficulty: difficulty || existingChallenge.difficulty,
          duration: duration || existingChallenge.duration,
          location: location || existingChallenge.location,
          recommendedGear:
            gearArray.length > 0 ? gearArray : existingChallenge.recommendedGear,
          tips: tips || existingChallenge.tips,
          weatherConditions: weatherConditions || existingChallenge.weatherConditions,
        }
      );

      console.log('Challenge updated:', updatedDoc.$id);

      return NextResponse.json({
        success: true,
        challenge: { ...updatedDoc, id: updatedDoc.$id },
        updated: true,
      });
    }

    // Create new challenge with all required fields
    const newDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      ID.unique(),
      {
        userId: userId.toString(),
        challengeText,
        challengeType: 'CHATBOT_GENERATED',
        category: category || 'General',
        difficulty: difficulty || 'Intermediate',
        duration: duration || '30 mins',
        location: location || null,
        recommendedGear: gearArray,
        tips: tips || null,
        weatherConditions: weatherConditions || null,
        issuedDate: new Date().toISOString(),
        status: 'pending',
      }
    );

    console.log('New challenge created:', newDoc.$id);

    return NextResponse.json({
      success: true,
      challenge: { ...newDoc, id: newDoc.$id },
      created: true,
    });
  } catch (error) {
    console.error('Challenge sync failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync challenge',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
    const { databases } = createAdminClient();

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_DAILY_CHALLENGES,
      [
        Query.equal('userId', userId),
        Query.equal('status', 'pending'),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ]
    );

    const challenge = result.documents[0] ?? null;

    return NextResponse.json({
      hasChallenge: !!challenge,
      challenge: challenge ? { ...challenge, id: challenge.$id } : null,
    });
  } catch (error) {
    console.error('Failed to check sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
