// Shared pieces for the full Supabase port: feature photo keys, service-role
// upload/sign guards, XP awards through the SQL function, and the guarded
// service-role client calls.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiForbiddenError, FotoaiValidationError } from '../../lib/fotoai/errors.ts';
import {
  assertOwnedAnyPhotoKey,
  assertOwnedFeatureKey,
  buildFeatureObjectKey,
  buildSubmissionObjectKey,
} from '../../lib/fotoai/object-keys.ts';
import { createFotoaiSupabaseClient } from '../../lib/fotoai/supabase-http.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { TEST_ENV, createTestDeps, type TestDeps } from './helpers/deps.ts';

const ROW = 'aaaaaaaa-0000-4000-8000-0000000000aa';
const fixedRandom = () => 'cccccccc-0000-4000-8000-000000000009';
const alice = { userId: ALICE, accessToken: TOKEN_ALICE };

let deps: TestDeps;
beforeEach(() => { deps = createTestDeps(); });

test('feature key: owner-prefixed, kind and row in the path', () => {
  const key = buildFeatureObjectKey(ALICE, 'critiques', ROW, 'shot.PNG', fixedRandom);
  assert.equal(key, `${ALICE}/critiques/${ROW}/cccccccc-0000-4000-8000-000000000009.png`);
  assert.doesNotThrow(() => assertOwnedFeatureKey(key, ALICE));
  assert.throws(() => assertOwnedFeatureKey(key, BOB), FotoaiForbiddenError);
});

test('feature key: refuses unknown kinds, bad extensions and traversal', () => {
  assert.throws(() => buildFeatureObjectKey(ALICE, 'avatars' as any, ROW, 'a.jpg'), FotoaiValidationError);
  assert.throws(() => buildFeatureObjectKey(ALICE, 'reverse', ROW, 'a.exe'), FotoaiValidationError);
  assert.throws(() => assertOwnedFeatureKey(`${ALICE}/critiques/../x.jpg`, ALICE), FotoaiValidationError);
  assert.throws(() => assertOwnedFeatureKey(`${ALICE}/submissions/${ROW}/a.jpg`, ALICE), FotoaiValidationError);
});

test('any-photo key: accepts both key families for the owner only', () => {
  const sub = buildSubmissionObjectKey(ALICE, ROW, 'a.jpg', fixedRandom);
  const feat = buildFeatureObjectKey(ALICE, 'editing', ROW, 'a.jpg', fixedRandom);
  assert.doesNotThrow(() => assertOwnedAnyPhotoKey(sub, ALICE));
  assert.doesNotThrow(() => assertOwnedAnyPhotoKey(feat, ALICE));
  assert.throws(() => assertOwnedAnyPhotoKey(sub, BOB), FotoaiForbiddenError);
  assert.throws(() => assertOwnedAnyPhotoKey(feat, BOB), FotoaiForbiddenError);
});

test('storeFeaturePhoto: uploads under the session prefix with the service role', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const stored = await deps.photos.storeFeaturePhoto(alice, 'reverse', ROW,
    { name: 'a.jpg', type: 'image/jpeg', size: 3, bytes: async () => bytes }, fixedRandom);
  assert.ok(stored.objectKey.startsWith(`${ALICE}/reverse/${ROW}/`));
  assert.equal(deps.client.objects.get(stored.objectKey)?.owner, ALICE);
  assert.deepEqual(deps.client.serviceCalls.map((c) => c.op), ['upload']);
  assert.equal(stored.data, bytes);
});

test('storeFeaturePhoto: rejects a declared size that does not match', async () => {
  await assert.rejects(deps.photos.storeFeaturePhoto(alice, 'reverse', ROW,
    { name: 'a.jpg', type: 'image/jpeg', size: 4, bytes: async () => new Uint8Array([1]) }), FotoaiValidationError);
  assert.equal(deps.client.objects.size, 0);
});

test('signOwnedKey: never signs another user key', async () => {
  const bobKey = buildFeatureObjectKey(BOB, 'critiques', ROW, 'a.jpg', fixedRandom);
  await assert.rejects(deps.photos.signOwnedKey(alice, bobKey), FotoaiForbiddenError);
  assert.equal(deps.client.serviceCalls.length, 0);
  const own = buildFeatureObjectKey(ALICE, 'critiques', ROW, 'a.jpg', fixedRandom);
  assert.match(await deps.photos.signOwnedKey(alice, own), /sign/);
});

test('xp: submission award hits the three foundational skills once per source', async () => {
  const first = await deps.xp.awardSubmissionXP(alice, ROW);
  assert.deepEqual(first.map((r) => r.skillId).sort(), ['exposure_triangle', 'raw_editing', 'rule_of_thirds']);
  const again = await deps.xp.awardSubmissionXP(alice, ROW);
  assert.equal(again.length, 0, 'same source must not award twice');
  const events = deps.client.tables.get('fotoai_xp_events')!;
  assert.equal(events.length, 3);
  assert.ok(events.every((e) => e.user_id === ALICE && e.source_kind === 'submission'));
});

test('xp: locked skills get nothing; skill tree reports totals', async () => {
  await deps.xp.awardCritiqueXP(alice, { technical: 90, composition: 10, creative: 10 }, ROW);
  const awarded = new Set(deps.client.tables.get('fotoai_user_skills')!.map((r) => r.skill_id));
  // iso_management etc. need prerequisites, so only unlocked technical skills move.
  assert.ok(awarded.has('exposure_triangle'));
  const tree = await deps.xp.getSkillTree(alice);
  assert.equal(tree.totalXP, deps.client.tables.get('fotoai_user_skills')!.reduce((n, r) => n + r.current_xp, 0));
  assert.ok(tree.skills.length > 10);
  assert.ok(tree.skills.some((s) => s.status === 'locked'));
});

test('xp: rejects a non-uuid source id before calling the function', async () => {
  await assert.rejects(deps.xp.awardSubmissionXP(alice, 'not-a-uuid'), FotoaiValidationError);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('service client: refuses unknown functions and unfiltered updates', async () => {
  const seen: string[] = [];
  const client = createFotoaiSupabaseClient(TEST_ENV, async (url) => { seen.push(url); return new Response('[]'); });
  await assert.rejects(client.serviceRpc('drop_everything' as any, {}), FotoaiValidationError);
  await assert.rejects(client.serviceUpdate('fotoai_user_progress', {}, { current_streak: 0 }), FotoaiValidationError);
  await assert.rejects(client.serviceSelect('auth_users' as any, {}), FotoaiValidationError);
  assert.equal(seen.length, 0);
});
