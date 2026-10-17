// Chatbot challenge sync (ported from app/api/challenges/sync/route.ts).
//
//   GET  /api/fotoai/challenges/sync   {hasChallenge, challenge|null}  newest own pending challenge
//   POST /api/fotoai/challenges/sync   {challengeText, category?, difficulty?, duration?, location?,
//                                       recommendedGear?, tips?, weatherConditions?}
//
// Upsert rule (unchanged): if the caller has a pending CHATBOT_GENERATED
// challenge it is updated (missing fields keep their stored values), otherwise
// a new CHATBOT_GENERATED challenge is created. Dashboard-generated challenges
// are never overwritten. Like the legacy route, sync does not change progress
// counters. Owner comes from the session only.

import { toChallengeDto } from '../challenge-generation.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { CHATBOT_CHALLENGE_TYPE, createGenerationRepo } from '../repo-generation.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

const LIMITS: Record<string, number> = {
  challengeText: 4000,
  category: 60,
  difficulty: 60,
  duration: 60,
  location: 200,
  tips: 4000,
  weatherConditions: 200,
};
const ALLOWED = new Set([...Object.keys(LIMITS), 'recommendedGear']);

function optionalText(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new FotoaiValidationError(`${field} must be a string`);
  if (value.length > LIMITS[field]) throw new FotoaiValidationError(`${field} must be at most ${LIMITS[field]} characters`);
  return value.trim() || null;
}

/** Array, single string, or nothing -> bounded string array. */
export function gearArray(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 20) throw new FotoaiValidationError('recommendedGear must have at most 20 items');
  return list.map((item) => {
    if (typeof item !== 'string' || item.length > 200) {
      throw new FotoaiValidationError('Each recommendedGear item must be a string of at most 200 characters');
    }
    return item.trim();
  }).filter(Boolean);
}

export function createChallengeSyncHandlers(provider: DepsProvider) {
  return {
    status: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const challenge = await createGenerationRepo(deps.client).latestPending(principal);
      return json({ hasChallenge: Boolean(challenge), challenge: challenge ? toChallengeDto(challenge) : null });
    }),

    sync: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const unexpected = Object.keys(body).find((k) => !ALLOWED.has(k));
      if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);

      const challengeText = optionalText(body, 'challengeText');
      if (!challengeText) throw new FotoaiValidationError('Missing required field: challengeText');
      const category = optionalText(body, 'category');
      const difficulty = optionalText(body, 'difficulty');
      const duration = optionalText(body, 'duration');
      const location = optionalText(body, 'location');
      const tips = optionalText(body, 'tips');
      const weatherConditions = optionalText(body, 'weatherConditions');
      const gear = gearArray(body.recommendedGear);

      const repo = createGenerationRepo(deps.client);
      const existing = await repo.findPendingChatbot(principal);
      if (existing) {
        const updated = await repo.updateChallenge(principal, existing.id, {
          challenge_text: challengeText,
          category: category || existing.category,
          difficulty: difficulty || existing.difficulty,
          duration: duration || existing.duration,
          location: location || existing.location,
          recommended_gear: gear.length > 0 ? gear : existing.recommended_gear,
          tips: tips || existing.tips,
          weather_conditions: weatherConditions || existing.weather_conditions,
        });
        return json({ success: true, challenge: toChallengeDto(updated), updated: true });
      }

      const created = await repo.insertChallenge(principal, {
        challenge_text: challengeText,
        challenge_type: CHATBOT_CHALLENGE_TYPE,
        category: category || 'General',
        difficulty: difficulty || 'Intermediate',
        duration: duration || '30 mins',
        location,
        recommended_gear: gear,
        tips,
        weather_conditions: weatherConditions,
        issued_date: new Date().toISOString(),
        status: 'pending',
      });
      return json({ success: true, challenge: toChallengeDto(created), created: true }, { status: 201 });
    }),
  };
}
