// Owner-scope tests against the repository + photo service using the fake
// Supabase client (which emulates RLS and the Storage insert policy).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiForbiddenError, FotoaiNotFoundError, FotoaiValidationError } from '../../lib/fotoai/errors.ts';
import { ALICE, BOB, TOKEN_ALICE, TOKEN_BOB } from './helpers/fake-supabase.ts';
import { createTestDeps, type TestDeps } from './helpers/deps.ts';

const aliceScope = { userId: ALICE, accessToken: TOKEN_ALICE };
const bobScope = { userId: BOB, accessToken: TOKEN_BOB };

let deps: TestDeps;
let aliceChallenge: Record<string, any>;
let bobChallenge: Record<string, any>;

beforeEach(() => {
  deps = createTestDeps();
  aliceChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: ALICE, challenge_type: 'AFTER_WORK', challenge_text: 'Shoot shadows', status: 'pending',
    issued_date: '2026-09-01T10:00:00Z', completed_date: null,
  });
  bobChallenge = deps.client.seed('fotoai_daily_challenges', {
    user_id: BOB, challenge_type: 'LUNCH_BREAK', challenge_text: 'Shoot reflections', status: 'pending',
    issued_date: '2026-09-02T10:00:00Z', completed_date: null,
  });
});

test('owner success: alice lists and reads only her own challenges', async () => {
  const list = await deps.repo.listChallenges(aliceScope);
  assert.deepEqual(list.map((c) => c.id), [aliceChallenge.id]);
  const one = await deps.repo.getChallenge(aliceScope, aliceChallenge.id);
  assert.equal(one.challenge_text, 'Shoot shadows');
});

test('cross-user denial: alice cannot read, update, or submit to bob\'s challenge (404)', async () => {
  await assert.rejects(deps.repo.getChallenge(aliceScope, bobChallenge.id), FotoaiNotFoundError);
  await assert.rejects(deps.repo.updateChallengeStatus(aliceScope, bobChallenge.id, 'completed'), FotoaiNotFoundError);
  await assert.rejects(deps.repo.createSubmission(aliceScope, { challengeId: bobChallenge.id }), FotoaiNotFoundError);
  // Bob's row is unchanged.
  assert.equal(deps.client.tables.get('fotoai_daily_challenges')!.find((r) => r.id === bobChallenge.id)!.status, 'pending');
  assert.equal((deps.client.tables.get('fotoai_challenge_submissions') ?? []).length, 0);
});

test('owner success: submission is created with the session user id, never an input id', async () => {
  const created = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id, notes: 'done', rating: 4 });
  assert.equal(created.user_id, ALICE);
  assert.equal(created.challenge_id, aliceChallenge.id);
  assert.equal(created.rating, 4);
  const mine = await deps.repo.listSubmissions(aliceScope);
  assert.equal(mine.length, 1);
  const bobs = await deps.repo.listSubmissions(bobScope);
  assert.equal(bobs.length, 0);
});

test('forged scope: a scope whose userId does not match the token is refused by RLS emulation', async () => {
  // Someone passes bob's id but alice's token: the fake enforces the with-check policy.
  const forged = { userId: BOB, accessToken: TOKEN_ALICE };
  await assert.rejects(deps.repo.getOrCreateProgress(forged), FotoaiForbiddenError);
});

test('cross-user denial: bob cannot read or delete alice\'s submission; row survives', async () => {
  const created = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  await assert.rejects(deps.repo.getSubmission(bobScope, created.id), FotoaiNotFoundError);
  await assert.rejects(deps.repo.deleteSubmission(bobScope, created.id), FotoaiNotFoundError);
  await assert.rejects(deps.repo.updateSubmission(bobScope, created.id, { feedback: 'hacked' }), FotoaiNotFoundError);
  const still = await deps.repo.getSubmission(aliceScope, created.id);
  assert.equal(still.feedback, undefined);
});

test('photo: owner upload lands under the owner prefix and can be signed by the owner only', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  const stored = await deps.photos.storeSubmissionPhoto(aliceScope, sub.id, {
    name: 'shot.jpg', type: 'image/jpeg', size: 3, bytes: async () => new Uint8Array([1, 2, 3]),
  });
  assert.ok(stored.objectKey.startsWith(`${ALICE}/submissions/${sub.id}/`), stored.objectKey);
  assert.equal(deps.client.objects.get(stored.objectKey)?.owner, ALICE);

  await deps.repo.updateSubmission(aliceScope, sub.id, { photo_object_key: stored.objectKey, photo_mime: stored.mime, photo_bytes: stored.bytes });

  const signed = await deps.photos.signSubmissionPhoto(aliceScope, sub.id, 60);
  assert.ok(signed.url.includes(stored.objectKey));
  assert.equal(signed.expiresIn, 60);
  assert.equal(deps.client.serviceCalls.filter((c) => c.op === 'sign').length, 1);

  // Bob: 404 and NO service-role sign call.
  await assert.rejects(deps.photos.signSubmissionPhoto(bobScope, sub.id, 60), FotoaiNotFoundError);
  assert.equal(deps.client.serviceCalls.filter((c) => c.op === 'sign').length, 1);
});

test('photo: signed URL TTL is clamped to the maximum', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  const key = `${ALICE}/submissions/${sub.id}/cccccccc-0000-4000-8000-000000000009.png`;
  await deps.repo.updateSubmission(aliceScope, sub.id, { photo_object_key: key });
  const signed = await deps.photos.signSubmissionPhoto(aliceScope, sub.id, 999999);
  assert.equal(signed.expiresIn, 300);
});

test('photo: bob cannot upload to alice\'s submission (404 before any upload)', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  await assert.rejects(deps.photos.storeSubmissionPhoto(bobScope, sub.id, {
    name: 'shot.jpg', type: 'image/jpeg', size: 1, bytes: async () => new Uint8Array([1]),
  }), FotoaiNotFoundError);
  assert.equal(deps.client.objects.size, 0);
});

test('photo: a tampered row whose key points at another user is refused (403) and never signed', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  // Simulate a corrupted/forged row: alice's row, bob's key. (The DB check
  // constraint blocks this in Postgres; the server refuses it independently.)
  const row = deps.client.tables.get('fotoai_challenge_submissions')!.find((r) => r.id === sub.id)!;
  row.photo_object_key = `${BOB}/submissions/${sub.id}/cccccccc-0000-4000-8000-000000000009.jpg`;

  await assert.rejects(deps.photos.signSubmissionPhoto(aliceScope, sub.id), FotoaiForbiddenError);
  assert.equal(deps.client.serviceCalls.length, 0);

  // Same for deletion cleanup.
  await assert.rejects(deps.photos.removeOwnedObject(aliceScope, row.photo_object_key), FotoaiForbiddenError);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('photo: a malformed stored key (public URL) is refused (400) and never signed', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  const row = deps.client.tables.get('fotoai_challenge_submissions')!.find((r) => r.id === sub.id)!;
  row.photo_object_key = 'https://appwrite.example/storage/buckets/b/files/f/view?project=p';
  await assert.rejects(deps.photos.signSubmissionPhoto(aliceScope, sub.id), FotoaiValidationError);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('photo: rejects wrong mime, bad extension, oversize, and size mismatch before upload', async () => {
  const sub = await deps.repo.createSubmission(aliceScope, { challengeId: aliceChallenge.id });
  const bytes = async () => new Uint8Array([1]);
  await assert.rejects(deps.photos.storeSubmissionPhoto(aliceScope, sub.id, { name: 'x.jpg', type: 'text/html', size: 1, bytes }), FotoaiValidationError);
  await assert.rejects(deps.photos.storeSubmissionPhoto(aliceScope, sub.id, { name: 'x.svg', type: 'image/jpeg', size: 1, bytes }), FotoaiValidationError);
  await assert.rejects(deps.photos.storeSubmissionPhoto(aliceScope, sub.id, { name: 'x.jpg', type: 'image/jpeg', size: 51 * 1024 * 1024, bytes }), FotoaiValidationError);
  await assert.rejects(deps.photos.storeSubmissionPhoto(aliceScope, sub.id, { name: 'x.jpg', type: 'image/jpeg', size: 5, bytes }), FotoaiValidationError);
  assert.equal(deps.client.objects.size, 0);
});

test('progress: completion updates only the owner row and streak rules apply', async () => {
  const p0 = await deps.repo.getOrCreateProgress(aliceScope);
  assert.equal(p0.user_id, ALICE);
  const now = new Date('2026-09-03T12:00:00Z');
  const p1 = await deps.repo.recordCompletion(aliceScope, aliceChallenge as any, now);
  assert.equal(p1.total_challenges_completed, 1);
  assert.equal(p1.current_streak, 1);
  assert.equal(p1.after_work_completed, 1);
  const p2 = await deps.repo.recordCompletion(aliceScope, aliceChallenge as any, new Date('2026-09-04T12:00:00Z'));
  assert.equal(p2.current_streak, 2);
  assert.equal(p2.longest_streak, 2);
  const bobProgress = await deps.repo.listSubmissions(bobScope);
  assert.equal(bobProgress.length, 0);
  assert.equal((deps.client.tables.get('fotoai_user_progress') ?? []).filter((r) => r.user_id === BOB).length, 0);
});

test('repository: ids must be UUIDs (400) before any query is issued', async () => {
  await assert.rejects(deps.repo.getChallenge(aliceScope, 'abc'), FotoaiValidationError);
  await assert.rejects(deps.repo.getSubmission(aliceScope, "1 or 1=1"), FotoaiValidationError);
  await assert.rejects(deps.repo.listChallenges(aliceScope, { status: 'drop' as any }), FotoaiValidationError);
});
