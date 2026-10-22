// Weather now at the place, in the user's units, with its source's attribution.

import type { Units, WeatherDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

const CONDITION: Record<WeatherDto['current']['condition'], string> = {
  clear: 'Clear',
  partly_cloudy: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  thunder: 'Thunder',
  unknown: 'Unknown',
};

export const temperature = (c: number, units: Units) => (units === 'imperial' ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`);
export const windSpeed = (kph: number, units: Units) => (units === 'imperial' ? `${Math.round(kph / 1.609)} mph` : `${Math.round(kph)} km/h`);

export function WeatherCard({ weather, units }: { weather: WeatherDto | null; units: Units }) {
  if (!weather) {
    return (
      <View className="rounded-lg bg-surface p-4">
        <Text className="text-text-muted">Weather unavailable</Text>
      </View>
    );
  }
  const c = weather.current;
  return (
    <View className="gap-1 rounded-lg bg-surface p-4">
      <Text className="text-lg text-text">{`${CONDITION[c.condition]}, ${temperature(c.temperatureC, units)}`}</Text>
      <Text className="text-text-muted">{`${c.cloudPct}% cloud · wind ${windSpeed(c.windKph, units)}`}</Text>
      <Text className="text-xs text-text-muted">{weather.attribution}</Text>
    </View>
  );
}
