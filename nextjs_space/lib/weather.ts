
// Weather API utilities using Open-Meteo (free, no API key)
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

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One retry on a timeout or network error: Open-Meteo is occasionally slow. HTTP errors are not retried. */
async function fetchWithRetry(fetchImpl: FetchLike, url: string): Promise<Response> {
  try {
    return await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    return fetchImpl(url, { signal: AbortSignal.timeout(10000) });
  }
}

// WMO weather codes (Open-Meteo) -> the condition names analyzeWeatherForPhotography expects.
function conditionFromWmo(code: number): { condition: string; description: string } {
  if (code === 0) return { condition: 'Clear', description: 'clear sky' };
  if (code === 1) return { condition: 'Clear', description: 'mainly clear' };
  if (code === 2) return { condition: 'Clouds', description: 'partly cloudy' };
  if (code === 3) return { condition: 'Clouds', description: 'overcast' };
  if (code === 45 || code === 48) return { condition: 'Fog', description: 'fog' };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', description: 'drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { condition: 'Rain', description: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: 'Snow', description: 'snow' };
  if (code >= 95) return { condition: 'Thunderstorm', description: 'thunderstorm' };
  return { condition: 'Clouds', description: 'unknown' };
}

/**
 * Fetch current weather data for a location (Open-Meteo: free, no API key).
 * `location` is free text such as "Melbourne, Australia". Units stay imperial
 * (°F, mph) because the photo analysis and prompts expect them.
 */
export async function getWeather(location: string, fetchImpl: FetchLike = fetch): Promise<WeatherData | null> {
  try {
    const [rawName, ...rest] = location.split(',').map((part) => part.trim()).filter(Boolean);
    if (!rawName) return null;
    const hint = rest.join(' ').toLowerCase();

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawName)}&count=10&language=en&format=json`;
    const geoResponse = await fetchWithRetry(fetchImpl, geoUrl);
    if (!geoResponse.ok) throw new Error(`Geocoding failed: ${geoResponse.status}`);
    const geoData = (await geoResponse.json()) as { results?: Array<Record<string, unknown>> };
    const results = geoData.results ?? [];
    if (results.length === 0) {
      console.error('Location not found:', location);
      return null;
    }
    // Prefer a result whose country or region matches the text after the comma.
    // Country/region names match as phrases; 2-letter country codes only as whole words ("us" is inside "australia").
    const hintWords = new Set(hint.split(/[^a-z]+/).filter(Boolean));
    const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');
    const place = (hint && results.find((r) =>
      [lower(r.country), lower(r.admin1)].some((v) => v.length > 2 && hint.includes(v)) || hintWords.has(lower(r.country_code)),
    )) || results[0];

    const weatherUrl = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${place.latitude}&longitude=${place.longitude}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,cloud_cover,weather_code,visibility'
      + '&daily=sunrise,sunset&forecast_days=1&timezone=auto&timeformat=unixtime'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph';
    const weatherResponse = await fetchWithRetry(fetchImpl, weatherUrl);
    if (!weatherResponse.ok) throw new Error(`Weather API failed: ${weatherResponse.status}`);
    const data = (await weatherResponse.json()) as {
      current: Record<string, number>;
      daily: { sunrise: number[]; sunset: number[] };
    };
    const { condition, description } = conditionFromWmo(data.current.weather_code);

    return {
      condition,
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m),
      clouds: data.current.cloud_cover,
      visibility: data.current.visibility,
      sunrise: data.daily.sunrise[0],
      sunset: data.daily.sunset[0],
      description,
      icon: '',
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
