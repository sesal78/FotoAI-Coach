
// Weather API utilities using OpenWeatherMap
export interface WeatherData {
  condition: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  clouds: number;
  visibility: number;
  sunrise: number;
  sunset: number;
  description: string;
  icon: string;
}

export interface PhotoWeatherAnalysis {
  isGoodForPhotography: boolean;
  score: number; // 0-100
  recommendation: string;
  bestTimeToShoot?: string;
  suggestedStyles: string[];
  alerts?: string[];
}

/**
 * Fetch current weather data for a location
 */
export async function getWeather(location: string): Promise<WeatherData | null> {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.error('OpenWeatherMap API key not configured');
      return null;
    }

    // Geocode the location first
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
    const geoResponse = await fetch(geoUrl);
    
    if (!geoResponse.ok) {
      throw new Error(`Geocoding failed: ${geoResponse.status}`);
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData || geoData.length === 0) {
      console.error('Location not found:', location);
      return null;
    }

    const { lat, lon } = geoData[0];

    // Fetch weather data
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API failed: ${weatherResponse.status}`);
    }
    
    const data = await weatherResponse.json();

    return {
      condition: data.weather[0].main,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      clouds: data.clouds.all,
      visibility: data.visibility,
      sunrise: data.sys.sunrise,
      sunset: data.sys.sunset,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    };
  } catch (error) {
    console.error('Weather fetch failed:', error);
    return null;
  }
}

/**
 * Analyze weather conditions for photography
 */
export function analyzeWeatherForPhotography(weather: WeatherData): PhotoWeatherAnalysis {
  let score = 50; // Base score
  const suggestedStyles: string[] = [];
  const alerts: string[] = [];
  let recommendation = '';

  // Temperature comfort (optimal: 60-75°F)
  if (weather.temperature >= 60 && weather.temperature <= 75) {
    score += 10;
  } else if (weather.temperature < 32 || weather.temperature > 95) {
    score -= 10;
    alerts.push(`Extreme temperature: ${weather.temperature}°F`);
  }

  // Cloud coverage analysis
  if (weather.clouds >= 50 && weather.clouds <= 80) {
    score += 15;
    recommendation = 'Overcast conditions create soft, diffused light - perfect for portraits and reducing harsh shadows.';
    suggestedStyles.push('portrait', 'street');
  } else if (weather.clouds < 20) {
    score += 10;
    recommendation = 'Clear skies provide strong directional light. Great for dramatic shadows and architectural photography.';
    suggestedStyles.push('architecture', 'landscape');
  } else if (weather.clouds > 90) {
    score -= 5;
    recommendation = 'Heavy cloud cover creates flat lighting. Consider moody compositions or wait for breaks in the clouds.';
    suggestedStyles.push('moody', 'minimalist');
  }

  // Weather condition bonuses
  switch (weather.condition.toLowerCase()) {
    case 'clear':
      score += 15;
      suggestedStyles.push('landscape', 'architecture', 'golden hour');
      break;
    case 'clouds':
      score += 10;
      suggestedStyles.push('portrait', 'street');
      break;
    case 'rain':
      score += 20; // Rain can create amazing photo opportunities!
      recommendation = 'Rain creates reflections, textures, and mood. Protect your gear and capture the wet streets!';
      suggestedStyles.push('street', 'reflections', 'urban');
      alerts.push('Protect your camera from water!');
      break;
    case 'drizzle':
      score += 15;
      suggestedStyles.push('moody', 'urban', 'abstract');
      break;
    case 'snow':
      score += 20;
      recommendation = 'Snow photography offers unique opportunities! Watch your exposure and protect your gear.';
      suggestedStyles.push('landscape', 'minimalist', 'winter');
      alerts.push('Cold affects battery life - keep extras warm!');
      break;
    case 'mist':
    case 'fog':
      score += 25; // Fog is a photographer's dream!
      recommendation = 'Fog creates ethereal, atmospheric conditions - perfect for minimalist and moody photography!';
      suggestedStyles.push('minimalist', 'moody', 'landscape');
      break;
    case 'thunderstorm':
      score -= 20;
      alerts.push('Severe weather - safety first!');
      break;
  }

  // Visibility
  if (weather.visibility < 1000) {
    score -= 10;
    alerts.push('Low visibility conditions');
  }

  // Wind conditions
  if (weather.windSpeed > 20) {
    score -= 5;
    alerts.push('High winds - use faster shutter speeds');
  }

  // Golden hour detection (within 1 hour of sunrise/sunset)
  const now = Math.floor(Date.now() / 1000);
  const goldenHourMorning = weather.sunrise - 3600;
  const goldenHourEvening = weather.sunset - 3600;
  
  if ((now >= goldenHourMorning && now <= weather.sunrise + 3600) ||
      (now >= goldenHourEvening && now <= weather.sunset + 3600)) {
    score += 20;
    alerts.push('Golden hour conditions!');
    suggestedStyles.push('golden hour', 'portrait', 'landscape');
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  return {
    isGoodForPhotography: score >= 60,
    score,
    recommendation: recommendation || 'Moderate conditions for photography. Focus on your creative vision!',
    suggestedStyles: [...new Set(suggestedStyles)], // Remove duplicates
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}

/**
 * Get best photography times for today
 */
export async function getGoldenHourTimes(location: string): Promise<{
  sunrise: string;
  sunset: string;
  goldenHourMorning: { start: string; end: string };
  goldenHourEvening: { start: string; end: string };
  blueHourMorning: { start: string; end: string };
  blueHourEvening: { start: string; end: string };
} | null> {
  try {
    const weather = await getWeather(location);
    if (!weather) return null;

    const formatTime = (timestamp: number) => {
      return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    const sunrise = weather.sunrise;
    const sunset = weather.sunset;

    return {
      sunrise: formatTime(sunrise),
      sunset: formatTime(sunset),
      goldenHourMorning: {
        start: formatTime(sunrise - 3600), // 1 hour before
        end: formatTime(sunrise + 3600), // 1 hour after
      },
      goldenHourEvening: {
        start: formatTime(sunset - 3600), // 1 hour before
        end: formatTime(sunset + 3600), // 1 hour after
      },
      blueHourMorning: {
        start: formatTime(sunrise - 1800), // 30 min before
        end: formatTime(sunrise + 600), // 10 min after
      },
      blueHourEvening: {
        start: formatTime(sunset - 600), // 10 min before
        end: formatTime(sunset + 1800), // 30 min after
      },
    };
  } catch (error) {
    console.error('Failed to calculate golden hour times:', error);
    return null;
  }
}
