// Contract-shaped answers for screen tests.

import type { ChallengeDto, LightTimesDto, Preferences, ProgressResponse, SpotDto, WeatherDto } from '@fotoai/contracts';

export const PREFS_NONE: Preferences = { theme: 'golden', units: 'metric', home: null };
export const PREFS_HOME: Preferences = { theme: 'golden', units: 'metric', home: { lat: -37.81, lng: 144.96, label: 'Fitzroy' } };

export const LIGHT: LightTimesDto = {
  date: '2026-10-20',
  timezone: 'Australia/Melbourne',
  sunrise: '2026-10-20T06:28:00+11:00',
  sunset: '2026-10-20T19:41:00+11:00',
  solarNoon: '2026-10-20T13:04:00+11:00',
  blueMorning: { start: '2026-10-20T05:50:00+11:00', end: '2026-10-20T06:10:00+11:00' },
  goldenMorning: { start: '2026-10-20T06:10:00+11:00', end: '2026-10-20T06:55:00+11:00' },
  goldenEvening: { start: '2026-10-20T19:05:00+11:00', end: '2026-10-20T19:58:00+11:00' },
  blueEvening: { start: '2026-10-20T19:58:00+11:00', end: '2026-10-20T20:20:00+11:00' },
  moonrise: null,
  moonset: null,
  moonIllumination: 0.4,
  sunAlwaysUp: false,
  sunAlwaysDown: false,
};

export const WEATHER: WeatherDto = {
  source: 'open-meteo',
  attribution: 'Weather data by Open-Meteo.com',
  fetchedAt: '2026-10-20T12:00:00+11:00',
  timezone: 'Australia/Melbourne',
  current: { time: '2026-10-20T12:00:00+11:00', temperatureC: 17, cloudPct: 40, precipitationMm: 0, condition: 'partly_cloudy', windKph: 12, humidityPct: 60 },
  hourly: [],
};

export const challenge = (over: Partial<ChallengeDto> = {}): ChallengeDto => ({
  id: '11111111-2222-4333-8444-555555555555',
  challengeType: 'AFTER_WORK',
  challengeText: 'Shoot five doorways in side light',
  category: 'architecture',
  difficulty: 'short',
  duration: '1-2 hours',
  tips: 'Walk slowly.',
  recommendedGear: ['Fujifilm X-T5'],
  status: 'pending',
  issuedDate: '2026-10-20T08:00:00+00:00',
  completedDate: null,
  shotList: [],
  source: 'dashboard',
  ...over,
});

export const spot = (over: Partial<SpotDto> = {}): SpotDto => ({
  id: '22222222-2222-4333-8444-555555555555',
  source: 'user',
  placeId: null,
  name: 'Pier at Williamstown',
  location: { lat: -37.86, lng: 144.9 },
  notes: null,
  favourite: true,
  createdAt: '2026-10-19T08:00:00+00:00',
  unavailable: false,
  ...over,
});

export const PROGRESS_FRESH: ProgressResponse = {
  xp: { total: 0, level: 1, levelStart: 0, nextLevelAt: 100, progress: 0 },
  streak: { current: 0, longest: 0, lastCompletionDate: null },
  challenges: { completed: 0, issued: 0 },
  skills: [],
};
