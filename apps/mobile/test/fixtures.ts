// Contract-shaped answers for screen tests.

import { findBody, findLens } from '@fotoai/core';
import type { ChallengeDto, LightTimesDto, LoadoutDto, Preferences, ProgressResponse, RollDto, ShootPlanDto, SpotDto, WeatherDto } from '@fotoai/contracts';

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

export const PLAN_ID = '11111111-aaaa-4bbb-8ccc-000000000001';
export const STEP_1 = '11111111-aaaa-4bbb-8ccc-000000000011';
export const STEP_2 = '11111111-aaaa-4bbb-8ccc-000000000012';

/** A plan at Federation Square (Melbourne, UTC+11 on 24 Oct 2026) with two steps. */
export const plan = (over: Partial<ShootPlanDto> = {}): ShootPlanDto => ({
  id: PLAN_ID,
  placeSource: 'google',
  placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ',
  spotId: null,
  date: '2026-10-24',
  timezone: 'Australia/Melbourne',
  title: 'Golden hour at Federation Square',
  summary: 'Low sun on the sandstone, then the city lights.',
  loadout: { body: 'Nikon FM2', lens: '50mm f/1.8', film: 'Kodak Portra 400' },
  notes: ['Bring a cloth for the lens.'],
  status: 'active',
  createdAt: '2026-10-24T05:00:00.000Z',
  updatedAt: '2026-10-24T05:00:00.000Z',
  placeName: 'Federation Square',
  placeUnavailable: false,
  steps: [
    { id: STEP_1, position: 1, title: 'Warm light on the facade', instruction: 'Shoot the facade from the river side.', tip: 'Meter for the highlights.', startsAt: '2026-10-24T18:40:00+11:00', settings: { mode: 'A', aperture: 8, iso: 400 }, status: 'todo', updatedAt: '2026-10-24T05:00:00.000Z' },
    { id: STEP_2, position: 2, title: 'Blue hour skyline', instruction: 'Use a rail as a tripod.', tip: null, startsAt: '2026-10-24T19:50:00+11:00', settings: { mode: 'M', aperture: 2.8, shutterSeconds: 0.25, iso: 400 }, status: 'todo', updatedAt: '2026-10-24T05:00:00.000Z' },
  ],
  ...over,
});

export const ROLL_ID = '22222222-aaaa-4bbb-8ccc-000000000001';
export const BODY_ID = '33333333-aaaa-4bbb-8ccc-000000000001';
export const LENS_ID = '33333333-aaaa-4bbb-8ccc-000000000002';

export const roll = (over: Partial<RollDto> = {}): RollDto => ({
  id: ROLL_ID,
  stockId: 'kodak-portra-400',
  stockName: 'Kodak Portra 400',
  boxIso: 400,
  ratedIso: 400,
  exposures: 36,
  bodyGearId: BODY_ID,
  status: 'loaded',
  loadedAt: '2026-10-24T04:00:00.000Z',
  finishedAt: null,
  notes: null,
  framesLogged: 13,
  framesLeft: 23,
  createdAt: '2026-10-24T04:00:00.000Z',
  updatedAt: '2026-10-24T04:00:00.000Z',
  ...over,
});

/** A film loadout: a Nikon FM2 with a 50 mm lens and Portra 400 in it. */
export const filmLoadout = (over: Partial<LoadoutDto> = {}): LoadoutDto => ({
  body: {
    id: BODY_ID,
    kind: 'body',
    catalogId: 'nikon-fm2',
    name: 'Nikon FM2',
    capability: {
      id: 'nikon-fm2', make: 'Nikon', model: 'FM2', type: 'film', mount: 'nikon-f', modes: ['M'],
      shutter: { slowestSeconds: 1, fastestSeconds: 1 / 4000, bulb: true }, flashSyncSeconds: 1 / 250, iso: { min: 12, max: 6400 },
      metering: 'center-weighted', fixedLensId: null, sources: [],
    },
  },
  lensGearId: LENS_ID,
  lens: { id: 'nikon-50mm-f1-8', make: 'Nikon', model: 'AI-S 50mm f/1.8', mount: 'nikon-f', focalMm: { min: 50, max: 50 }, maxAperture: { wide: 1.8, tele: 1.8 }, minAperture: 22, sources: [] },
  film: { stock: 'Kodak Portra 400', boxIso: 400 },
  ...over,
});

/** A film loadout with a built-in lens and aperture priority only: the Yashica Electro 35 GL. */
export const electroLoadout = (): LoadoutDto => {
  const body = findBody('yashica-electro-35-gl')!;
  return {
    body: { id: BODY_ID, kind: 'body', catalogId: body.id, name: 'Yashica Electro 35 GL', capability: body },
    lensGearId: null,
    lens: findLens(body.fixedLensId!)!,
    film: { stock: 'Kodak Portra 400', boxIso: 400 },
  };
};
