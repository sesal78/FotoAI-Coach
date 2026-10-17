// Browser client for FotoAI challenge generation, challenge email and chat.
//
// Identity is never sent. The server derives the owner from the HttpOnly
// FotoAI session cookie on every request.

import type { Challenge } from '../types.ts';
import { FotoaiClientError, type FotoaiFetch } from './client.ts';

export type FotoaiChallengeType =
  | 'WEEKEND_DEEP_DIVE' | 'LUNCH_BREAK' | 'AFTER_WORK' | 'WFH_MICRO' | 'STORY_DRIVEN' | 'TECHNICAL_MASTERY';

export interface FotoaiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EmailFotoaiChallengeInput {
  challengeText: string;
  category?: string;
  difficulty?: string;
  duration?: string;
  tips?: string;
  recommendedGear?: string[];
  location?: string;
  weatherConditions?: string;
}

/** The server accepts at most 40; send the most recent turns only. */
export const FOTOAI_CHAT_HISTORY_LIMIT = 20;

async function requestJson<T>(path: string, init: RequestInit = {}, fetcher: FotoaiFetch = fetch): Promise<T> {
  const response = await fetcher(path, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) {
    throw new FotoaiClientError(data.error || `FotoAI request failed (${response.status})`, response.status, data.code);
  }
  return data;
}

function postJson(value: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

export async function generateFotoaiChallenge(
  input: { challengeType: FotoaiChallengeType; forceGenerate?: boolean },
  fetcher: FotoaiFetch = fetch,
): Promise<{ challenge: Challenge; message: string }> {
  return requestJson('/api/fotoai/challenges/generate', postJson({
    challengeType: input.challengeType,
    forceGenerate: input.forceGenerate === true,
  }), fetcher);
}

export async function emailFotoaiChallenge(
  input: EmailFotoaiChallengeInput,
  fetcher: FotoaiFetch = fetch,
): Promise<{ success: boolean; message: string }> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') body[key] = value;
  }
  return requestJson('/api/fotoai/challenges/email', postJson(body), fetcher);
}

export async function sendFotoaiChat(
  messages: FotoaiChatMessage[],
  fetcher: FotoaiFetch = fetch,
): Promise<{ message: string; challenge: Challenge | null }> {
  const recent = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-FOTOAI_CHAT_HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content }));
  const result = await requestJson<{ message?: string; challenge?: Challenge | null }>(
    '/api/fotoai/chat', postJson({ messages: recent }), fetcher,
  );
  return { message: result.message ?? '', challenge: result.challenge ?? null };
}
