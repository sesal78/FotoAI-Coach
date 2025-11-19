
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

    const itineraries = await prisma.itinerary.findMany({
      where: { userId },
      orderBy: { generatedDate: 'desc' },
      take: 10,
    });

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

    // Fetch user profile
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

    // Fetch weather data
    const weather = await getWeather(location);

    // Prepare user profile
    const userProfile = {
      name: user.name,
      skillLevel: user.preferences.skillLevel,
      interests: user.preferences.photographyInterests,
      gear: user.gear.map(g => `${g.brand} ${g.model}`),
    };

    // Generate itinerary using LLM
    const itineraryData = await generateItinerary({
      location,
      userProfile,
      weather,
      duration: duration || '3-4 hours',
    });

    // Save itinerary to database
    const itinerary = await prisma.itinerary.create({
      data: {
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
        generatedDate: new Date(),
      },
    });

    // Log agent action
    await prisma.agentAction.create({
      data: {
        userId,
        actionType: 'ITINERARY_GENERATED',
        details: JSON.stringify({
          itineraryId: itinerary.id,
          location,
          spotsCount: itineraryData.spots.length,
        }),
        success: true,
      },
    });

    return NextResponse.json({
      itinerary: {
        ...itinerary,
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
