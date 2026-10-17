// POST /api/fotoai/locations  {query, location?}  -> {locations: [...], summary}
//
// Ported from the POST in app/api/locations/route.ts. Changes: a FotoAI
// session is required (the legacy route let anyone trigger LLM calls), the
// input is bounded, the call is rate limited per user, and the LLM is called
// through deps.services.ai.callLLM. The curated GET stays in the legacy route.

import { FotoaiUpstreamError, FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { reserveLlmCall } from '../rate-limit.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

export const MAX_LOCATION_QUERY_LENGTH = 500;
export const MAX_BASE_LOCATION_LENGTH = 120;
const DEFAULT_BASE_LOCATION = 'Melbourne, Australia';

function systemPrompt(location: string): string {
  return `You are a photography location scout specializing in finding real, specific photography spots.

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
}

function boundedText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new FotoaiValidationError(`${field} is required`);
  if (value.trim().length > max) throw new FotoaiValidationError(`${field} must be at most ${max} characters`);
  return value.trim();
}

export function createLocationHandlers(provider: DepsProvider) {
  return {
    scout: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const unexpected = Object.keys(body).find((k) => k !== 'query' && k !== 'location');
      if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);
      const query = boundedText(body.query, 'query', MAX_LOCATION_QUERY_LENGTH);
      const location = body.location === undefined || body.location === null || body.location === ''
        ? DEFAULT_BASE_LOCATION
        : boundedText(body.location, 'location', MAX_BASE_LOCATION_LENGTH);

      await reserveLlmCall(deps.client, principal, 'locations');
      let result: unknown;
      try {
        const reply = await deps.services.ai.callLLM(
          [
            { role: 'system', content: systemPrompt(location) },
            { role: 'user', content: `Find photography locations for: ${query}` },
          ],
          { model: 'gpt-4.1-mini', temperature: 0.7, max_tokens: 2000, json_mode: true },
        );
        result = JSON.parse(typeof reply?.content === 'string' ? reply.content : '');
      } catch (err) {
        throw new FotoaiUpstreamError(0, `Location scout failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new FotoaiUpstreamError(0, 'Location scout returned no JSON object');
      }
      return json(result);
    }),
  };
}
