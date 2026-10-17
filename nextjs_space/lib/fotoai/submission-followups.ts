// Follow-up work after POST /api/fotoai/submissions (port of the legacy
// app/api/submissions/route.ts fire-and-forget block):
//
//   - challenge XP + submission XP           (legacy: awardChallengeXP / awardSubmissionXP)
//   - AI text feedback -> feedback / ready   (legacy: generateFeedbackAsync)
//   - auto photo critique, linked by id      (legacy: generateCritiqueAsync; critique XP
//                                             is awarded inside createCritique)
//
// Legacy ran all of this in the background (not awaited) and only logged
// failures, so the response stays fast and the saved submission never fails
// because of it. The app runs `next start` (long-running Node in Docker),
// which keeps un-awaited promises alive. Every step uses the session
// principal and the owner-scoped repository / guarded services.
//
// Token expiry: follow-ups outlive the response, and the user's access token
// can expire during the LLM call. The feedback WRITES therefore use the
// service role bound to the session user (cron-data-access.ts
// bindServiceToUser: filters id AND user_id), so feedback_status never stays
// 'pending'. The auto-critique row is inserted the same way (bound insert:
// user_id is always the session user). Ownership was proven before the
// response with the user token (the submission was created by this request).
// Reads (submission, signed URL, preferences, gear) stay on the user token and
// run before the LLM call; critique XP goes through the guarded XP service.

import { createCritique, MAX_CHALLENGE_TEXT_LENGTH } from './critiques.ts';
import { bindServiceToUser } from './cron-data-access.ts';
import { isFotoaiError } from './errors.ts';
import { defaultLog, type FotoaiDeps } from './handlers/shared.ts';
import { critiqueInsertRow, type CritiqueRow, T_CRITIQUES } from './repo-critiques.ts';
import type { ChallengeRow, OwnerScope, SubmissionRow } from './repository.ts';
import type { XpAwardResult } from './xp.ts';

type LogFn = NonNullable<FotoaiDeps['log']>;

/** Runs a follow-up task without the caller awaiting it. Tests inject a collecting one. */
export type FollowupScheduler = (task: () => Promise<unknown>, log: LogFn) => void;

/** Default: start after the current tick, never await, never leave a rejection unhandled. */
export const backgroundScheduler: FollowupScheduler = (task, log) => {
  void Promise.resolve()
    .then(task)
    .catch((err: unknown) => {
      log('error', 'Submission follow-up crashed', { error: errorMessage(err) });
    });
};

export interface SubmissionFollowupInput {
  challenge: ChallengeRow;
  submission: SubmissionRow;
  notes: string;
}

export interface SubmissionFollowupResult {
  xp: XpAwardResult[];
  feedback: 'generated' | 'fallback';
  critiqueId: string | null;
}

/** Legacy fallback text when the model returns nothing. */
export const FALLBACK_FEEDBACK = 'Great work!';
const MAX_FEEDBACK_LENGTH = 5000;
const T_SUBMISSIONS = 'fotoai_challenge_submissions';

function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}

async function awardXp(deps: FotoaiDeps, principal: OwnerScope, input: SubmissionFollowupInput, log: LogFn): Promise<XpAwardResult[]> {
  const { challenge, submission } = input;
  const xp: XpAwardResult[] = [];
  try {
    // Legacy defaults: difficulty 'medium', category 'street'.
    xp.push(...await deps.xp.awardChallengeXP(principal, {
      id: challenge.id,
      challenge_type: challenge.challenge_type,
      difficulty: challenge.difficulty || 'medium',
      category: challenge.category || 'street',
    }));
  } catch (err) {
    log('error', 'XP award (challenge) failed', { challengeId: challenge.id, error: errorMessage(err) });
  }
  try {
    xp.push(...await deps.xp.awardSubmissionXP(principal, submission.id));
  } catch (err) {
    log('error', 'XP award (submission) failed', { submissionId: submission.id, error: errorMessage(err) });
  }
  return xp;
}

async function generateFeedback(deps: FotoaiDeps, principal: OwnerScope, input: SubmissionFollowupInput, log: LogFn): Promise<'generated' | 'fallback'> {
  const { challenge, submission, notes } = input;
  // Not the user token: it may expire before the write (see header).
  const writer = bindServiceToUser(deps.client, principal.userId);
  try {
    let skillLevel = 'intermediate';
    try {
      skillLevel = (await deps.repo.getPreferences(principal)).skillLevel || skillLevel;
    } catch (err) {
      log('warn', 'Could not load preferences for submission feedback', { error: errorMessage(err) });
    }
    const raw = await deps.services.ai.generateFeedback({
      challengeText: challenge.challenge_text,
      userNotes: notes || undefined,
      skillLevel,
    });
    const feedback = (typeof raw === 'string' ? raw.trim().slice(0, MAX_FEEDBACK_LENGTH) : '') || FALLBACK_FEEDBACK;
    await writer.updateById(T_SUBMISSIONS, submission.id, { feedback, feedback_status: 'ready' });
    return 'generated';
  } catch (err) {
    log('error', 'Async feedback failed for submission', { submissionId: submission.id, error: errorMessage(err) });
    // Legacy: mark ready without feedback so the page stops waiting.
    try {
      await writer.updateById(T_SUBMISSIONS, submission.id, { feedback_status: 'ready' });
    } catch (updateErr) {
      log('error', 'Failed to update fallback feedback status', { submissionId: submission.id, error: errorMessage(updateErr) });
    }
    return 'fallback';
  }
}

async function autoCritique(deps: FotoaiDeps, principal: OwnerScope, input: SubmissionFollowupInput, log: LogFn): Promise<string | null> {
  const { challenge, submission } = input;
  if (!submission.photo_object_key) return null;
  // Not the user token for the write: it may expire during the vision call.
  const writer = bindServiceToUser(deps.client, principal.userId);
  try {
    const { critique } = await createCritique(deps, principal, {
      submissionId: submission.id,
      challengeText: (challenge.challenge_text ?? '').slice(0, MAX_CHALLENGE_TEXT_LENGTH),
    }, {
      insertCritique: (row) => writer.insert<CritiqueRow>(T_CRITIQUES, critiqueInsertRow(principal, row)),
    });
    return critique.id;
  } catch (err) {
    // A 4xx here is the legacy "skipped" case (e.g. RAW photo): warn only.
    const skipped = isFotoaiError(err) && err.status < 500;
    log(skipped ? 'warn' : 'error', skipped ? 'Auto-critique skipped for submission' : 'Auto-critique failed for submission', {
      submissionId: submission.id,
      error: errorMessage(err),
    });
    return null;
  }
}

/**
 * Runs every follow-up for a freshly saved submission. Never rejects: each
 * step logs its own failure and the others still run.
 */
export async function runSubmissionFollowups(
  deps: FotoaiDeps,
  principal: OwnerScope,
  input: SubmissionFollowupInput,
): Promise<SubmissionFollowupResult> {
  const log = deps.log ?? defaultLog;
  const [xp, feedback, critiqueId] = await Promise.all([
    awardXp(deps, principal, input, log),
    generateFeedback(deps, principal, input, log),
    autoCritique(deps, principal, input, log),
  ]);
  return { xp, feedback, critiqueId };
}
