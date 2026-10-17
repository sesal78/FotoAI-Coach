// POST /api/fotoai/challenges/email
//   {challengeText, category?, difficulty?, duration?, tips?, recommendedGear?, location?, weatherConditions?}
//
// Emails a challenge to the session user's own address (principal.email).
// Ported from app/api/challenges/email/route.ts. The recipient never comes
// from the request. Fields are length-limited and angle brackets are removed
// because lib/email.ts places them into HTML unescaped.

import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

const LIMITS: Record<string, number> = {
  challengeText: 4000,
  category: 60,
  difficulty: 60,
  duration: 60,
  tips: 4000,
  location: 200,
  weatherConditions: 200,
};
const ALLOWED = new Set([...Object.keys(LIMITS), 'recommendedGear']);

function clean(value: string): string {
  return value.replace(/[<>]/g, '').trim();
}

function optionalText(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new FotoaiValidationError(`${field} must be a string`);
  if (value.length > LIMITS[field]) throw new FotoaiValidationError(`${field} must be at most ${LIMITS[field]} characters`);
  return clean(value) || undefined;
}

function gearList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new FotoaiValidationError('recommendedGear must be an array of at most 20 items');
  }
  return value.map((item) => {
    if (typeof item !== 'string' || item.length > 200) {
      throw new FotoaiValidationError('Each recommendedGear item must be a string of at most 200 characters');
    }
    return clean(item);
  }).filter(Boolean);
}

export function createChallengeEmailHandlers(provider: DepsProvider) {
  return {
    send: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const unexpected = Object.keys(body).find((k) => !ALLOWED.has(k));
      if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);

      const challengeText = optionalText(body, 'challengeText');
      if (!challengeText) throw new FotoaiValidationError('Challenge text is required');
      if (!principal.email) throw new FotoaiValidationError('Your account has no email address');

      optionalText(body, 'location'); // accepted for compatibility, validated, not emailed
      optionalText(body, 'weatherConditions');
      const challenge = {
        challengeText,
        difficulty: optionalText(body, 'difficulty') || 'intermediate',
        category: optionalText(body, 'category') || 'general',
        duration: optionalText(body, 'duration') || '30 mins',
        tips: optionalText(body, 'tips') || '',
        recommendedGear: gearList(body.recommendedGear),
      };

      let sent = false;
      try {
        sent = await deps.services.mail.sendChallengeEmail(principal.email, principal.name || 'Photographer', challenge);
      } catch (err) {
        deps.log?.('error', `Challenge email failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!sent) {
        return json({ error: 'Failed to send email. Check server email configuration.', code: 'email_failed' }, { status: 502 });
      }
      return json({ success: true, message: 'Challenge emailed successfully' });
    }),
  };
}
