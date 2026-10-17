// FotoAI itinerary handlers (ported from app/api/itinerary/route.ts).
//
//   GET  /api/fotoai/itineraries?limit=          {itineraries: [...]}  own itineraries, newest first
//   POST /api/fotoai/itineraries {location, duration?}
//                                                {itinerary, message}  generate + save own itinerary
//
// Identity: session only. Preferences and gear are the caller's own
// (owner-scoped selects). LLM failures are a 502; weather is best effort.

import { weatherFor } from '../challenge-generation.ts';
import { FotoaiNotFoundError, FotoaiUpstreamError, FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { createGenerationRepo } from '../repo-generation.ts';
import { createItinerariesRepo, type ItineraryRow } from '../repo-itineraries.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

const DEFAULT_DURATION = '3-4 hours';

export interface ItinerarySpot {
  name: string;
  location: string;
  bestTime: string;
  photoOpportunities: string[];
  tips: string;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clipList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .slice(0, maxItems).map((v) => v.trim().slice(0, maxLength));
}

/** Bounded, schema-safe spots list from the LLM (or a stored jsonb value). */
export function cleanSpots(value: unknown): ItinerarySpot[] {
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object' && !Array.isArray(s))
    .slice(0, 10)
    .map((s) => ({
      name: clip(s.name, 200),
      location: clip(s.location, 300),
      bestTime: clip(s.bestTime, 200),
      photoOpportunities: clipList(s.photoOpportunities, 10, 300),
      tips: clip(s.tips, 1000),
    }));
}

function toItineraryDto(row: ItineraryRow) {
  return {
    id: row.id,
    location: row.location,
    title: row.title ?? '',
    description: row.description ?? '',
    spots: cleanSpots(row.spots),
    suggestedTimes: Array.isArray(row.suggested_times) ? row.suggested_times : [],
    weatherConditions: row.weather_conditions ?? null,
    gearRecommendations: Array.isArray(row.gear_recommendations) ? row.gear_recommendations : [],
    duration: row.duration ?? null,
    status: row.status,
    generatedDate: row.generated_date,
    scheduledDate: row.scheduled_date ?? null,
    completedDate: row.completed_date ?? null,
  };
}

function requiredText(body: Record<string, unknown>, field: string, max: number): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) throw new FotoaiValidationError(`${field} is required`);
  if (value.trim().length > max) throw new FotoaiValidationError(`${field} must be at most ${max} characters`);
  return value.trim();
}

export function createItineraryHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const rows = await createItinerariesRepo(deps.client).list(
        principal, params.has('limit') ? Number(params.get('limit')) : undefined,
      );
      return json({ itineraries: rows.map(toItineraryDto) });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const unexpected = Object.keys(body).find((k) => k !== 'location' && k !== 'duration');
      if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);
      const location = requiredText(body, 'location', 120);
      const duration = body.duration === undefined || body.duration === null || body.duration === ''
        ? DEFAULT_DURATION
        : requiredText(body, 'duration', 40);

      const generation = createGenerationRepo(deps.client);
      const preferences = await generation.getPreferences(principal);
      if (!preferences) throw new FotoaiNotFoundError('User preferences not found');
      const gear = await generation.listGearNames(principal);
      const weather = await weatherFor(deps.services, location, deps.log);

      let generated: Awaited<ReturnType<typeof deps.services.ai.generateItinerary>>;
      try {
        generated = await deps.services.ai.generateItinerary({
          location,
          userProfile: {
            name: principal.name || 'Photographer',
            skillLevel: preferences.skillLevel,
            interests: preferences.photographyInterests,
            gear,
          },
          weather,
          duration,
        });
      } catch (err) {
        throw new FotoaiUpstreamError(0, `Itinerary generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      const spots = cleanSpots(generated?.spots);
      const row = await createItinerariesRepo(deps.client).insert(principal, {
        location,
        title: clip(generated?.title, 200) || `Photo tour of ${location}`,
        description: clip(generated?.description, 4000),
        spots,
        suggested_times: clipList(generated?.suggestedTimes, 20, 200),
        weather_conditions: weather ? `${weather.condition}, ${weather.temperature}°F` : null,
        gear_recommendations: clipList(generated?.gearRecommendations, 20, 200),
        duration,
        status: 'generated',
        generated_date: new Date().toISOString(),
      });

      await deps.repo.logAgentAction(principal, 'ITINERARY_GENERATED', {
        itineraryId: row.id,
        location,
        spotsCount: spots.length,
      });

      return json({ itinerary: toItineraryDto(row), message: 'Itinerary generated successfully' }, { status: 201 });
    }),
  };
}
