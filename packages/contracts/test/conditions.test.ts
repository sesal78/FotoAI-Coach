import { expect, test } from 'vitest';

import { LightTimesDto, WeatherDto } from '../src/index.ts';

const reading = { time: '2026-10-18T14:00:00+11:00', temperatureC: 18, cloudPct: 40, precipitationMm: 0, condition: 'clear' };
const weather = {
  source: 'open-meteo',
  attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
  fetchedAt: '2026-10-18T14:20:00+11:00',
  timezone: 'Australia/Melbourne',
  current: { ...reading, windKph: 12, humidityPct: 60 },
  hourly: [reading],
};

test('weather needs an attribution and zoned times', () => {
  expect(WeatherDto.parse(weather)).toMatchObject({ source: 'open-meteo' });
  const noAttribution: Record<string, unknown> = { ...weather };
  delete noAttribution.attribution;
  expect(WeatherDto.safeParse(noAttribution).success).toBe(false);
  expect(WeatherDto.safeParse({ ...weather, fetchedAt: '2026-10-18T03:20:00Z' }).success).toBe(false);
});

test('light windows are a start and an end, or null', () => {
  const light = {
    date: '2026-06-21', timezone: 'Europe/Oslo', sunrise: null, sunset: null, solarNoon: '2026-06-21T13:15:00+02:00',
    goldenMorning: null, goldenEvening: null, blueMorning: null, blueEvening: null, moonrise: null, moonset: null,
    moonIllumination: 0.3, sunAlwaysUp: true, sunAlwaysDown: false,
  };
  expect(LightTimesDto.parse(light)).toMatchObject({ sunAlwaysUp: true });
  expect(LightTimesDto.safeParse({ ...light, goldenEvening: { start: '2026-06-21T22:00:00+02:00' } }).success).toBe(false);
});
