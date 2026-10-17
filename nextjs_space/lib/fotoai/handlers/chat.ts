// POST /api/fotoai/chat  {messages: [{role: 'user'|'assistant', content}]}
//   -> {message, challenge|null}
//
// Ported from app/api/chat/route.ts. Changes: a session is required (the
// legacy route allowed anonymous chat), the LLM is called through
// deps.services.ai.callLLM, and the messages array is bounded. When the reply
// contains a <CHALLENGE_DATA> block, the challenge is saved for the session
// user through the owner-scoped repo with the legacy upsert rule: a pending
// CHATBOT_GENERATED challenge is overwritten, otherwise a new one is created
// and the issued counters are bumped. A bad block never fails the chat.

import { toChallengeDto } from '../challenge-generation.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { reserveLlmCall } from '../rate-limit.ts';
import { CHATBOT_CHALLENGE_TYPE, createGenerationRepo } from '../repo-generation.ts';
import type { ChallengeRow, OwnerScope } from '../repository.ts';
import { gearArray } from './challenge-sync.ts';
import { type DepsProvider, type FotoaiDeps, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

export const CHAT_SYSTEM_PROMPT = `You are Foto, an expert AI photography coach. You help photographers of all skill levels with:
- Personalised daily photography challenges
- Photo tour itineraries for any location
- Gear advice, technique tips, composition guidance
- Creative prompts and project ideas
- Post-processing and editing advice

Be warm, encouraging, and specific. Tailor your advice to the photographer's gear and skill level if they share it.

IMPORTANT — When you generate a photography challenge for the user, you MUST include a machine-readable block at the very end of your response, in this exact format (no extra text around it):

<CHALLENGE_DATA>
{"challengeText":"<full challenge description>","category":"<STREET|LANDSCAPE|PORTRAIT|ARCHITECTURE|NATURE|ABSTRACT|DOCUMENTARY>","difficulty":"<BEGINNER|INTERMEDIATE|ADVANCED>","duration":"<e.g. 30-45 minutes>","location":"<suggested location or null>","tips":"<1-2 practical tips>","recommendedGear":["<item1>","<item2>"]}
</CHALLENGE_DATA>

Do not include the CHALLENGE_DATA block unless you are actually generating a challenge. For general conversation, tips, itineraries, or other requests, omit it entirely.`;

export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_CHAT_TOTAL_LENGTH = 40000;
/**
 * JSON body cap for chat. Worst case for the limits above: 40,000 characters
 * that JSON escapes as \u00XX (6 bytes each) = 240,000 bytes, plus up to 40
 * message envelopes. 256 KiB covers that; the default 64 KiB would not.
 */
export const MAX_CHAT_BODY_BYTES = 256 * 1024;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function parseChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw new FotoaiValidationError('messages required');
  if (value.length > MAX_CHAT_MESSAGES) {
    throw new FotoaiValidationError(`messages must have at most ${MAX_CHAT_MESSAGES} items`);
  }
  let total = 0;
  const messages = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new FotoaiValidationError('Each message must be an object');
    }
    const { role, content } = item as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') {
      throw new FotoaiValidationError('Each message role must be "user" or "assistant"');
    }
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new FotoaiValidationError(`Each message content must be 1 to ${MAX_CHAT_MESSAGE_LENGTH} characters`);
    }
    total += content.length;
    return { role, content } as ChatMessage;
  });
  if (total > MAX_CHAT_TOTAL_LENGTH) {
    throw new FotoaiValidationError(`messages must total at most ${MAX_CHAT_TOTAL_LENGTH} characters`);
  }
  if (messages[messages.length - 1].role !== 'user') {
    throw new FotoaiValidationError('The last message must be from the user');
  }
  return messages;
}

const CHALLENGE_BLOCK = /<CHALLENGE_DATA>\s*([\s\S]*?)\s*<\/CHALLENGE_DATA>/i;
const CHALLENGE_BLOCK_ALL = /<CHALLENGE_DATA>\s*[\s\S]*?\s*<\/CHALLENGE_DATA>/gi;

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

async function saveChatChallenge(deps: FotoaiDeps, scope: OwnerScope, raw: string): Promise<ChallengeRow | null> {
  try {
    // Strip markdown code fences the model sometimes adds (```json ... ```).
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    const challengeText = text(parsed?.challengeText, 4000);
    if (!challengeText) throw new Error('CHALLENGE_DATA has no challengeText');
    let gear: string[] = [];
    try { gear = gearArray(parsed.recommendedGear); } catch { gear = []; }
    const fields = {
      challenge_text: challengeText,
      category: text(parsed.category, 60) || 'GENERAL',
      difficulty: text(parsed.difficulty, 60) || 'INTERMEDIATE',
      duration: text(parsed.duration, 60) || '1-2 hours',
      location: text(parsed.location, 200),
      tips: text(parsed.tips, 4000),
      recommended_gear: gear,
      challenge_type: CHATBOT_CHALLENGE_TYPE,
      issued_date: new Date().toISOString(),
    };

    // Every chat challenge is a new row: earlier ones stay pending in history and can be continued.
    const repo = createGenerationRepo(deps.client);
    const same = await repo.findPendingChatbotByText(scope, challengeText);
    if (same) return same; // the coach repeated an open challenge
    const created = await repo.insertChallenge(scope, { ...fields, weather_conditions: null, status: 'pending' });
    try {
      await repo.incrementIssued(scope, CHATBOT_CHALLENGE_TYPE);
    } catch (err) {
      // The challenge is saved; a counter failure must not hide it from the user.
      deps.log?.('warn', `Chat challenge saved but the issued counter was not updated: ${err instanceof Error ? err.message : String(err)}`);
    }
    return created;
  } catch (err) {
    deps.log?.('error', `Chat challenge was not saved: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export function createChatHandlers(provider: DepsProvider) {
  return {
    send: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request, MAX_CHAT_BODY_BYTES);
      assertNoBrowserIdentity(body);
      const unexpected = Object.keys(body).find((k) => k !== 'messages');
      if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);
      const messages = parseChatMessages(body.messages);
      await reserveLlmCall(deps.client, principal, 'chat');

      let rawContent: string;
      try {
        const reply = await deps.services.ai.callLLM(
          [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
          { model: 'gpt-4o-mini', temperature: 0.75, max_tokens: 2000 },
        );
        rawContent = typeof reply?.content === 'string' ? reply.content : '';
      } catch (err) {
        deps.log?.('error', `Chat LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
        return json(
          { error: 'The AI coach is unavailable right now. Please try again in a moment.', code: 'upstream' },
          { status: 502 },
        );
      }

      const match = rawContent.match(CHALLENGE_BLOCK);
      const saved = match ? await saveChatChallenge(deps, principal, match[1]) : null;
      const message = rawContent.replace(CHALLENGE_BLOCK_ALL, '').trim();

      if (match && !saved) {
        // The coach offered a challenge but it was not stored: say so instead of claiming it was saved.
        return json({ message, challenge: null, challengeSaveFailed: true });
      }
      return json({ message, challenge: saved ? toChallengeDto(saved) : null });
    }),
  };
}
