
import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_ITINERARIES,
  COLLECTION_USER_PREFERENCES,
  COLLECTION_USER_GEAR,
  COLLECTION_AGENT_ACTIONS,
} from '@/lib/appwrite-collections';
import { generateItinerary } from '@/lib/llm';
import { getWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

/**
 * GET /api/itinerary - Get user's itineraries
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ITINERARIES,
      [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(10),
      ]
    );

    const itineraries = result.documents.map((doc) => ({ ...doc, id: doc.$id }));

    return NextResponse.json({ itineraries });
  } catch (error) {
    console.error('Failed to fetch itineraries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch itineraries' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/itinerary - Generate a new photography itinerary
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, location, duration } = body;

    if (!userId || !location) {
      return NextResponse.json(
        { error: 'User ID and location required' },
        { status: 400 }
      );
    }

    const { databases, users } = createAdminClient();

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

    // Fetch weather data
    const weather = await getWeather(location);

    // Prepare user profile
    const userProfile = {
      name: user.name,
      skillLevel: preferences.skillLevel,
      interests: preferences.photographyInterests,
      gear: (gear as any[]).map((g) => `${g.brand} ${g.model}`),
    };

    // Generate itinerary using LLM
    const itineraryData = await generateItinerary({
      location,
      userProfile,
      weather,
      duration: duration || '3-4 hours',
    });

    // Save itinerary to Appwrite
    const itineraryDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ITINERARIES,
      ID.unique(),
      {
        userId,
        location,
        title: itineraryData.title,
        description: itineraryData.description,
        spots: JSON.stringify(itineraryData.spots),
        suggestedTimes: itineraryData.suggestedTimes,
        weatherConditions: weather ? `${weather.condition}, ${weather.temperature}°F` : null,
        gearRecommendations: itineraryData.gearRecommendations,
        duration: duration || '3-4 hours',
        status: 'generated',
        generatedDate: new Date().toISOString(),
      }
    );

    // Log agent action
    await databases.createDocument(
      DATABASE_ID,
      COLLECTION_AGENT_ACTIONS,
      ID.unique(),
      {
        userId,
        actionType: 'ITINERARY_GENERATED',
        details: JSON.stringify({
          itineraryId: itineraryDoc.$id,
          location,
          spotsCount: itineraryData.spots.length,
        }),
        success: true,
      }
    );

    return NextResponse.json({
      itinerary: {
        ...itineraryDoc,
        id: itineraryDoc.$id,
        spots: itineraryData.spots, // Return parsed spots
      },
      message: 'Itinerary generated successfully',
    });
  } catch (error) {
    console.error('Failed to generate itinerary:', error);
    return NextResponse.json(
      { error: 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}
