import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/locations - Scout photography locations using web search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, location = 'Melbourne, Australia' } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    console.log('📍 Location Scout Request:', { query, location });

    // Use LLM with web search context to find real locations
    const systemPrompt = `You are a photography location scout specializing in finding real, specific photography spots.

User's base location: ${location}

When recommending locations, you MUST provide:
1. **Exact location names** - Real places that exist
2. **Addresses or landmarks** - How to find them
3. **Best times** - Specific hours for optimal lighting
4. **What to shoot** - Specific subjects and compositions
5. **Access info** - Parking, public transport, entry fees
6. **Crowd levels** - When it's quietest
7. **Permits** - Any photography restrictions

Respond in JSON format:
{
  "locations": [
    {
      "name": "Location Name",
      "address": "Full address or landmark",
      "distance": "Distance from base location",
      "bestTimes": ["Sunrise 6-7am", "Golden hour 5-6pm"],
      "whatToShoot": ["Subject 1", "Subject 2"],
      "access": "How to get there",
      "crowdLevel": "Low/Medium/High at different times",
      "permits": "Any restrictions",
      "tips": "Pro photography tips for this spot"
    }
  ],
  "summary": "Brief overview of the recommendations"
}

Provide 3-5 real, specific locations. Be accurate - these must be real places.`;

    const response = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Find photography locations for: ${query}` },
      ],
      {
        model: 'gpt-4.1-mini',
        temperature: 0.7,
        max_tokens: 2000,
        json_mode: true,
      }
    );

    const result = JSON.parse(response.content);
    console.log('📍 Location Scout Result:', result.locations?.length, 'locations found');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Location scout error:', error);
    return NextResponse.json(
      { error: 'Failed to scout locations' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/locations - Get saved/popular locations
 */
export async function GET(request: NextRequest) {
  // Return some curated Melbourne photography spots
  const curatedSpots = {
    locations: [
      {
        name: "Hosier Lane",
        address: "Hosier Lane, Melbourne CBD",
        category: "street-art",
        bestTimes: ["Early morning 6-8am", "Blue hour"],
        whatToShoot: ["Street art murals", "Portraits against graffiti", "Urban textures"],
        tips: "Visit weekday mornings to avoid crowds. Murals change frequently."
      },
      {
        name: "Princes Pier",
        address: "Port Melbourne",
        category: "landscape",
        bestTimes: ["Sunrise", "Blue hour"],
        whatToShoot: ["Long exposure water", "City skyline", "Old pier structures"],
        tips: "Best for sunrise with city backdrop. Bring ND filters for long exposures."
      },
      {
        name: "Queen Victoria Market",
        address: "513 Elizabeth St, Melbourne",
        category: "market",
        bestTimes: ["Tuesday-Sunday mornings"],
        whatToShoot: ["Vendors and produce", "Street portraits", "Food details"],
        tips: "Saturday is busiest but most vibrant. Ask permission for portraits."
      },
      {
        name: "Brighton Beach Boxes",
        address: "Esplanade, Brighton",
        category: "landscape",
        bestTimes: ["Sunrise", "Golden hour"],
        whatToShoot: ["Colorful bathing boxes", "Beach scenes", "Minimalist compositions"],
        tips: "Arrive before sunrise for best light on boxes. Less crowded on weekdays."
      },
      {
        name: "Flinders Street Station",
        address: "Flinders St, Melbourne CBD",
        category: "architecture",
        bestTimes: ["Blue hour", "Night"],
        whatToShoot: ["Historic architecture", "Light trails", "Street scenes"],
        tips: "Position yourself across the road for classic shot. Long exposure for light trails."
      }
    ],
    summary: "Curated Melbourne photography locations covering street art, landscapes, markets, and architecture."
  };

  return NextResponse.json(curatedSpots);
}
