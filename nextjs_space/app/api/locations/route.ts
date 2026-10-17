import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The LLM location scout moved to POST /api/fotoai/locations (session required).

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
