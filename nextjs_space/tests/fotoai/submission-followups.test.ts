// Follow-ups after POST /api/fotoai/submissions: XP, AI feedback, auto-critique.
// The handler gets a collecting scheduler so the background work can be awaited.

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createSubmissionHandlers } from '../../lib/fotoai/handlers/submissions.ts';
import { backgroundScheduler, FALLBACK_FEEDBACK, type SubmissionFollowupResult } from '../../lib/fotoai/submission-followups.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, request, type TestDeps } from './helpers/deps.ts';

const T_SUBS = 'fotoai_challenge_submissions';
const T_CRITIQUES = 'fotoai_photo_critiques';
const T_XP = 'fotoai_xp_events';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const CRITIQUE = {
  technicalScore: 90, compositionScore: 85, creativeScore: 40, overallScore: 72,
  technicalFeedback: 'Sharp.', compositionFeedback: 'Balanced.', creativeFeedback: 'Plain.',
  strengths: ['focus'], improvements: ['story'], suggestedSettings: 'f/8',
};

let deps: TestDeps;
let subs: ReturnType<typeof createSubmissionHandlers>;
let followups: Array<Promise<unknown>>;
let aliceChallenge: Record<string, any>;
let bobChallenge: Record<string, any>;

beforeEach(() => {
  deps = createTestDeps();
  followups = [];
  subs = createSubmissionHandlers(() => deps, { scheduleFollowups: (task) => { followups.push(task()); } });
  aliceChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: ALICE, challenge_type: 'AFTER_WORK', challenge_text: 'Shoot reflections', difficulty: 'hard', category: 'street',
    status: 'pending', issued_date: '2026-10-01T10:00:00Z',
  });
  bobChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: BOB, challenge_type: 'AFTER_WORK', challenge_text: 'Bob task', status: 'pending', issued_date: '2026-10-01T10:00:00Z',
  });
});

interface TestFile { name: string; type: string; bytes: Uint8Array }

function multipart(fields: Record<string, string | TestFile>): { body: Uint8Array; headers: Record<string, string> } {
  const boundary = 'fotoai-followup-test-boundary';
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    } else {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.name}"\r\nContent-Type: ${v.type}\r\n\r\n`));
      chunks.push(v.bytes);
      chunks.push(enc.encode('\r\n'));
    }
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { body.set(c, off); off += c.byteLength; }
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(total) } };
}

function submit(fields: Record<string, string | TestFile>, token = TOKEN_ALICE) {
  return subs.create(request('/api/fotoai/submissions', { method: 'POST', cookie: cookieFor(token), ...multipart(fields) }));
}

async function settle(): Promise<SubmissionFollowupResult[]> {
  return Promise.all(followups.splice(0)) as Promise<SubmissionFollowupResult[]>;
}

function rows(table: string): Array<Record<string, any>> {
  return deps.client.tables.get(table) ?? [];
}

test('followups: feedback is generated with legacy context and stored on the owner\'s submission only', async () => {
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'advanced' });
  const bobSub = deps.client.seed(T_SUBS, { user_id: BOB, challenge_id: bobChallenge.id, notes: '', feedback: null, feedback_status: 'pending', submitted_at: '2026-10-01T00:00:00Z' });
  deps.fakes.generateFeedback = () => '  Lovely reflections.  ';

  const res = await submit({ challengeId: aliceChallenge.id, notes: 'puddles' });
  assert.equal(res.status, 201);
  const payload = await res.json();
  assert.equal(payload.submission.feedback_status, 'pending', 'response does not wait for feedback (legacy timing)');
  assert.match(payload.message, /Feedback is being generated/);

  const [result] = await settle();
  assert.equal(result.feedback, 'generated');
  const mine = rows(T_SUBS).find((r) => r.id === payload.submission.id)!;
  assert.equal(mine.user_id, ALICE);
  assert.equal(mine.feedback, 'Lovely reflections.');
  assert.equal(mine.feedback_status, 'ready');
  assert.equal(bobSub.feedback, null);
  assert.equal(bobSub.feedback_status, 'pending');

  const fb = deps.calls.filter((c) => c.name === 'generateFeedback');
  assert.equal(fb.length, 1);
  assert.deepEqual(fb[0].args[0], { challengeText: 'Shoot reflections', userNotes: 'puddles', skillLevel: 'advanced' });
});

test('followups: empty model output falls back to the legacy text', async () => {
  deps.fakes.generateFeedback = () => '';
  const res = await submit({ challengeId: aliceChallenge.id });
  const id = (await res.json()).submission.id;
  await settle();
  const row = rows(T_SUBS).find((r) => r.id === id)!;
  assert.equal(row.feedback, FALLBACK_FEEDBACK);
  assert.equal(row.feedback_status, 'ready');
  const args = deps.calls.find((c) => c.name === 'generateFeedback')!.args[0] as Record<string, unknown>;
  assert.equal(args.userNotes, undefined, 'empty notes are not sent (legacy)');
  assert.equal(args.skillLevel, 'intermediate', 'default skill level without preferences');
});

test('followups: with a photo a critique is created and linked to the submission; critique XP awarded once', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  deps.fakes.critiquePhoto = () => ({ ...CRITIQUE });

  const res = await submit({ challengeId: aliceChallenge.id, photo: { name: 'shot.jpg', type: 'image/jpeg', bytes: JPEG } });
  assert.equal(res.status, 201);
  const payload = await res.json();
  assert.match(payload.message, /photo critique are being generated/);
  const sub = payload.submission;

  const [result] = await settle();
  const critiques = rows(T_CRITIQUES);
  assert.equal(critiques.length, 1);
  assert.equal(critiques[0].id, result.critiqueId);
  assert.equal(critiques[0].user_id, ALICE);
  assert.equal(critiques[0].submission_id, sub.id);
  assert.equal(critiques[0].photo_object_key, sub.photo_object_key);

  const vision = deps.calls.filter((c) => c.name === 'critiquePhoto');
  assert.equal(vision.length, 1);
  const arg = vision[0].args[0] as Record<string, unknown>;
  assert.ok(String(arg.imageDataUri).includes(sub.photo_object_key), 'signed URL of the own submission photo');
  assert.equal(arg.challengeText, 'Shoot reflections');

  // Only the owner's key was signed.
  const signed = deps.client.serviceCalls.filter((c) => c.op === 'sign').flatMap((c) => c.keys);
  assert.deepEqual(signed, [sub.photo_object_key]);

  // Critique XP comes only from createCritique: every critique_bonus event points at the critique, no duplicates.
  const bonus = rows(T_XP).filter((e) => e.source_kind === 'critique_bonus');
  assert.ok(bonus.length > 0);
  assert.ok(bonus.every((e) => e.source_id === result.critiqueId && e.user_id === ALICE));
  assert.equal(new Set(bonus.map((e) => e.skill_id)).size, bonus.length);
});

test('followups: without a photo no critique is attempted', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  deps.fakes.critiquePhoto = () => ({ ...CRITIQUE });
  await submit({ challengeId: aliceChallenge.id });
  const [result] = await settle();
  assert.equal(result.critiqueId, null);
  assert.equal(rows(T_CRITIQUES).length, 0);
  assert.equal(deps.calls.filter((c) => c.name === 'critiquePhoto').length, 0);
  assert.equal(deps.client.serviceCalls.filter((c) => c.op === 'sign').length, 0);
});

test('followups: RAW photo skips the critique with a warning, submission kept', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  deps.fakes.critiquePhoto = () => ({ ...CRITIQUE });
  const res = await submit({ challengeId: aliceChallenge.id, photo: { name: 'shot.cr2', type: 'image/x-canon-cr2', bytes: new Uint8Array([1, 2, 3]) } });
  assert.equal(res.status, 201);
  const [result] = await settle();
  assert.equal(result.critiqueId, null);
  assert.equal(rows(T_CRITIQUES).length, 0);
  assert.equal(deps.calls.filter((c) => c.name === 'critiquePhoto').length, 0);
  assert.ok(deps.logs.some((l) => l.level === 'warn' && /Auto-critique skipped/.test(l.message)));
});

test('followups: XP events use the challenge id and the submission id as sources (legacy defaults applied)', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  const res = await submit({ challengeId: aliceChallenge.id });
  const sub = (await res.json()).submission;
  const [result] = await settle();

  const events = rows(T_XP);
  const challengeEvents = events.filter((e) => e.source_kind === 'challenge_complete');
  const submissionEvents = events.filter((e) => e.source_kind === 'submission');
  assert.ok(challengeEvents.length > 0);
  assert.ok(submissionEvents.length > 0);
  assert.ok(challengeEvents.every((e) => e.source_id === aliceChallenge.id && e.user_id === ALICE));
  assert.ok(submissionEvents.every((e) => e.source_id === sub.id && e.user_id === ALICE));
  assert.equal(result.xp.length, events.length);

  // Bob's challenge has no category/difficulty: legacy defaults ('street', 'medium') still award XP.
  deps.fakes.generateFeedback = () => 'ok';
  const bobRes = await submit({ challengeId: bobChallenge.id }, TOKEN_BOB);
  assert.equal(bobRes.status, 201);
  await settle();
  assert.ok(rows(T_XP).some((e) => e.user_id === BOB && e.source_kind === 'challenge_complete' && e.source_id === bobChallenge.id));
});

test('followups: LLM and XP failures leave the submission saved, logged, and the request successful', async () => {
  deps.fakes.generateFeedback = () => { throw new Error('llm down'); };
  deps.fakes.critiquePhoto = () => { throw new Error('vision down'); };
  deps.client.serviceRpc = async () => { throw new Error('rpc down'); };

  const res = await submit({ challengeId: aliceChallenge.id, notes: 'n', photo: { name: 'shot.jpg', type: 'image/jpeg', bytes: JPEG } });
  assert.equal(res.status, 201);
  const sub = (await res.json()).submission;

  const [result] = await settle(); // resolves: no step rejects
  assert.equal(result.feedback, 'fallback');
  assert.equal(result.critiqueId, null);
  assert.deepEqual(result.xp, []);

  const row = rows(T_SUBS).find((r) => r.id === sub.id)!;
  assert.ok(row, 'submission still saved');
  assert.equal(row.feedback ?? null, null);
  assert.equal(row.feedback_status, 'ready', 'legacy: marked ready so the page stops waiting');
  assert.equal(rows(T_CRITIQUES).length, 0);
  assert.equal(deps.client.objects.size, 1, 'submission photo kept');
  assert.equal(rows('fotoai_daily_challenges').find((c) => c.id === aliceChallenge.id)!.status, 'completed');

  const messages = deps.logs.filter((l) => l.level === 'error').map((l) => l.message);
  for (const expected of [/XP award \(challenge\)/, /XP award \(submission\)/, /Async feedback failed/, /Auto-critique failed/]) {
    assert.ok(messages.some((m) => expected.test(m)), `logged ${expected}`);
  }
});

test('followups: nothing runs for a submission to Bob\'s challenge (404), no service call for Bob\'s data', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  deps.fakes.critiquePhoto = () => ({ ...CRITIQUE });
  const res = await submit({ challengeId: bobChallenge.id, photo: { name: 'shot.jpg', type: 'image/jpeg', bytes: JPEG } });
  assert.equal(res.status, 404);
  assert.equal(followups.length, 0);
  await settle();
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.client.serviceCalls, []);
  assert.equal(rows(T_XP).length, 0);
  assert.equal(rows(T_CRITIQUES).length, 0);
});

test('followups: Alice\'s follow-ups touch only Alice\'s rows and keys', async () => {
  deps.fakes.generateFeedback = () => 'ok';
  deps.fakes.critiquePhoto = () => ({ ...CRITIQUE });
  const bobSub = deps.client.seed(T_SUBS, { user_id: BOB, challenge_id: bobChallenge.id, notes: '', feedback: null, feedback_status: 'pending', photo_object_key: `${BOB}/submissions/x/y.jpg`, submitted_at: '2026-10-01T00:00:00Z' });

  await submit({ challengeId: aliceChallenge.id, photo: { name: 'shot.jpg', type: 'image/jpeg', bytes: JPEG } });
  await settle();

  assert.ok(rows(T_XP).every((e) => e.user_id === ALICE));
  assert.ok(rows(T_CRITIQUES).every((c) => c.user_id === ALICE));
  const keys = deps.client.serviceCalls.filter((c) => c.op === 'sign').flatMap((c) => c.keys);
  assert.ok(keys.every((k) => k.startsWith(`${ALICE}/`)));
  assert.equal(bobSub.feedback_status, 'pending');
});

test('followups: default background scheduler logs a crashing task instead of an unhandled rejection', async () => {
  const logged: string[] = [];
  let unhandled = false;
  const onUnhandled = () => { unhandled = true; };
  process.on('unhandledRejection', onUnhandled);
  try {
    let ran = false;
    backgroundScheduler(async () => { ran = true; throw new Error('boom'); }, (_level, message) => { logged.push(message); });
    assert.equal(ran, false, 'not run synchronously');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ran, true);
    assert.deepEqual(logged, ['Submission follow-up crashed']);
    assert.equal(unhandled, false);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
