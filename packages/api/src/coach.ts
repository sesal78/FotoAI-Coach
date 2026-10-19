// v2 coach: one chat turn with the app context, the stored history and two tools, plus reading and
// clearing the history. The model only proposes; the server decides. A proposed challenge is
// saved as a pending chat challenge (never with a location); a proposed plan is kept only when
// it names a real Google place or one of the caller's own spots. Every read and write uses the
// caller's token, so RLS keeps each user to their own rows.

import { COACH_TOOLS, COACH_V1, type ChatToolCall, type ChatTurn, type CoachPromptInput } from '@fotoai/ai';
import { CoachInput, type CoachMessageDto, type CoachProposal } from '@fotoai/contracts';
import { framesLeft, getSkillById } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';
import { PLACE_ID } from '@fotoai/places';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { ownProgress, toV2Challenge } from './challenges.ts';
import { loadSavedLoadout } from './gear.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { placesConfigured, placesFor } from './places-client.ts';
import { fromAi, requireAi } from './plans.ts';
import { reserveCalls } from './rate-limit.ts';

type UserClient = ReturnType<typeof createUserClient>;
type ToolCall = ChatToolCall<typeof COACH_TOOLS>;

const T_MESSAGES = 'fotoai_coach_messages';
const T_CHALLENGES = 'fotoai_daily_challenges';
const CHATBOT_TYPE = 'CHATBOT_GENERATED';
const HISTORY_TURNS = 20;
const HISTORY_PAGE = 50;
const MAX_REPLY = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);
const orNull = (text: string) => text.trim() || null;

/** What the model may know: the screen, the gear, the weakest skills, and the caller's own plan or roll. */
async function loadContext(deps: V2Deps, principal: Principal, client: UserClient, context: CoachInput['context']): Promise<CoachPromptInput> {
  const [loadout, skills, plan, roll] = await Promise.all([
    loadSavedLoadout(deps, principal),
    client.from('fotoai_user_skills').select('skill_id, current_xp').eq('user_id', principal.userId).order('current_xp', { ascending: true }).limit(5),
    context.planId ? loadPlan(client, context.planId) : null,
    context.rollId ? loadRoll(client, context.rollId) : null,
  ]);
  if (skills.error) throw upstream('load your skills');
  const film = loadout?.film ? `, film ${loadout.film.stock}` : '';
  return {
    screen: context.screen,
    loadout: loadout ? `${loadout.body.name} + ${loadout.lens.make} ${loadout.lens.model}${film}` : null,
    weakSkills: skills.data.map((s) => getSkillById(s.skill_id)?.name).filter((n): n is string => Boolean(n)),
    plan,
    roll,
  };
}

async function loadPlan(client: UserClient, planId: string): Promise<CoachPromptInput['plan']> {
  const plan = await client.from('fotoai_shoot_plans').select('title').eq('id', planId).maybeSingle();
  if (plan.error) throw upstream('load the plan');
  if (!plan.data) return null; // not the caller's: say nothing about it
  const steps = await client.from('fotoai_plan_steps').select('title, status').eq('plan_id', planId).order('position').limit(12);
  if (steps.error) throw upstream('load the plan');
  return { title: plan.data.title, steps: steps.data };
}

async function loadRoll(client: UserClient, rollId: string): Promise<CoachPromptInput['roll']> {
  const roll = await client.from('fotoai_film_rolls').select('stock_name, exposures').eq('id', rollId).maybeSingle();
  if (roll.error) throw upstream('load the roll');
  if (!roll.data) return null;
  const frames = await client.from('fotoai_film_frames').select('id', { count: 'exact', head: true }).eq('roll_id', rollId);
  if (frames.error || frames.count === null) throw upstream('load the roll');
  return { stock: roll.data.stock_name, framesLeft: framesLeft({ exposures: roll.data.exposures, framesLogged: frames.count }) };
}

async function loadHistory(client: UserClient): Promise<ChatTurn[]> {
  const { data, error } = await client.from(T_MESSAGES).select('role, content').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(HISTORY_TURNS);
  if (error) throw upstream('load the chat history');
  return data.reverse().map((m) => ({ role: m.role as ChatTurn['role'], content: m.content }));
}

/** Saves a proposed challenge as a new pending chat challenge, or reuses an open one with the same text. */
async function saveChallenge(deps: V2Deps, principal: Principal, client: UserClient, input: Extract<ToolCall, { name: 'proposeChallenge' }>['input']) {
  const challengeText = input.challengeText.trim();
  if (!challengeText) return null;
  const same = await client.from(T_CHALLENGES).select('*').eq('status', 'pending').eq('challenge_type', CHATBOT_TYPE).eq('challenge_text', challengeText).limit(1);
  if (same.error) throw upstream('save the challenge');
  if (same.data[0]) return same.data[0];

  const now = deps.now().toISOString();
  const { data, error } = await client
    .from(T_CHALLENGES)
    .insert({
      user_id: principal.userId,
      challenge_text: challengeText,
      challenge_type: CHATBOT_TYPE,
      source: 'chat',
      status: 'pending',
      category: orNull(input.category) ?? 'General',
      difficulty: orNull(input.difficulty) ?? 'Intermediate',
      duration: orNull(input.duration) ?? '30 mins',
      tips: orNull(input.tips),
      location: null,
      issued_date: now,
    })
    .select('*')
    .single();
  if (error || !data) throw upstream('save the challenge');

  // As the live chat does: count it as issued. The challenge is saved either way.
  try {
    const progress = await ownProgress(client, principal);
    const bump = await client
      .from('fotoai_user_progress')
      .update({ total_challenges_issued: (progress.total_challenges_issued || 0) + 1, last_challenge_date: now, updated_at: now })
      .eq('id', progress.id);
    if (bump.error) throw bump.error;
  } catch {
    console.warn('FotoAI v2 coach: challenge saved but the issued counter was not updated');
  }
  return data;
}

/** A plan proposal survives only for a real Google place or one of the caller's own spots. */
async function checkPlan(deps: V2Deps, principal: Principal, client: UserClient, input: Extract<ToolCall, { name: 'proposePlan' }>['input']): Promise<CoachProposal | null> {
  const date = input.date;
  if (Boolean(input.placeId) === Boolean(input.spotId)) return null;
  if (input.spotId) {
    if (!UUID.test(input.spotId)) return null;
    const spotId = input.spotId.toLowerCase();
    const { data, error } = await client.from('fotoai_places').select('id').eq('id', spotId).maybeSingle();
    if (error) throw upstream('check the spot');
    return data ? { kind: 'plan', spotId, date } : null;
  }
  const placeId = input.placeId!;
  if (!PLACE_ID.test(placeId) || !placesConfigured(deps)) return null;
  try {
    await reserveCalls(deps.env, principal, 'places', 1, deps.now());
    const place = await placesFor(deps).details(placeId, 'summary');
    return place ? { kind: 'plan', placeId: place.placeId, date } : null;
  } catch {
    return null; // over the Places limit or Google failed: drop the proposal, keep the reply
  }
}

/** The first tool call that the server accepts becomes the one proposal. */
async function firstProposal(deps: V2Deps, principal: Principal, client: UserClient, calls: ToolCall[]): Promise<CoachProposal | null> {
  for (const call of calls) {
    if (call.name === 'proposeChallenge') {
      const row = await saveChallenge(deps, principal, client, call.input);
      if (row) return { kind: 'challenge', challenge: toV2Challenge(row) };
    } else {
      const plan = await checkPlan(deps, principal, client, call.input);
      if (plan) return plan;
    }
  }
  return null;
}

export const coachReply: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = CoachInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid coach message: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ')}`);
  const input = parsed.data;
  requireAi(deps);
  await reserveCalls(deps.env, principal, 'coach', 1, deps.now());

  const client = createUserClient(deps.env, principal.accessToken);
  const [context, history] = await Promise.all([loadContext(deps, principal, client, input.context), loadHistory(client)]);
  let out;
  try {
    out = await deps.ai.chat(COACH_V1, context, { history, message: input.message, tools: COACH_TOOLS });
  } catch (err) {
    throw fromAi(err);
  }
  const proposal = await firstProposal(deps, principal, client, out.toolCalls);
  const reply = out.text.trim().slice(0, MAX_REPLY) || (proposal ? 'Here is my suggestion.' : 'Sorry, I have no answer to that right now.');

  const sent = deps.now();
  const { error } = await client.from(T_MESSAGES).insert([
    { user_id: principal.userId, role: 'user', content: input.message, context: input.context, created_at: sent.toISOString() },
    { user_id: principal.userId, role: 'assistant', content: reply, proposal, created_at: new Date(sent.getTime() + 1).toISOString() },
  ]);
  if (error) throw upstream('save the chat');
  return json({ reply, proposal });
};

export const getCoachHistory: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_MESSAGES)
    .select('id, role, content, proposal, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(HISTORY_PAGE);
  if (error) throw upstream('load the chat history');
  const messages: CoachMessageDto[] = data.reverse().map((m) => ({
    id: m.id,
    role: m.role as CoachMessageDto['role'],
    content: m.content,
    proposal: (m.proposal as CoachProposal | null) ?? null,
    createdAt: m.created_at,
  }));
  return json({ messages });
};

export const clearCoachHistory: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_MESSAGES).delete().eq('user_id', principal.userId).select('id');
  if (error) throw upstream('clear the chat history');
  return json({ success: true, deleted: data.length });
};
