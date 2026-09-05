import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FotoaiForbiddenError, FotoaiValidationError } from '../../lib/fotoai/errors.ts';
import {
  SUBMISSION_OBJECT_KEY_PATTERN,
  assertOwnedObjectKey,
  buildSubmissionObjectKey,
  isUuid,
  requireUuid,
} from '../../lib/fotoai/object-keys.ts';
import { ALICE, BOB } from './helpers/fake-supabase.ts';

const SUBMISSION = 'aaaaaaaa-0000-4000-8000-000000000001';
// An owner id that contains letters, so upper-casing it actually changes it.
const CAROL = 'cafecafe-0000-4000-8000-00000000c0de';
const fixedRandom = () => 'cccccccc-0000-4000-8000-000000000009';

test('object-key: builds an owner-prefixed key with a lowercase extension', () => {
  const key = buildSubmissionObjectKey(ALICE, SUBMISSION, 'Holiday Photo.JPG', fixedRandom);
  assert.equal(key, `${ALICE}/submissions/${SUBMISSION}/cccccccc-0000-4000-8000-000000000009.jpg`);
  assert.doesNotThrow(() => assertOwnedObjectKey(key, ALICE));
});

test('object-key: refuses unsupported extensions and missing extensions', () => {
  assert.throws(() => buildSubmissionObjectKey(ALICE, SUBMISSION, 'evil.exe', fixedRandom), FotoaiValidationError);
  assert.throws(() => buildSubmissionObjectKey(ALICE, SUBMISSION, 'noext', fixedRandom), FotoaiValidationError);
  assert.throws(() => buildSubmissionObjectKey(ALICE, SUBMISSION, 'photo.jpg.html', fixedRandom), FotoaiValidationError);
});

test('object-key: refuses non-UUID owner or submission ids', () => {
  assert.throws(() => buildSubmissionObjectKey('alice', SUBMISSION, 'a.jpg', fixedRandom), FotoaiValidationError);
  assert.throws(() => buildSubmissionObjectKey(ALICE, '../../etc', 'a.jpg', fixedRandom), FotoaiValidationError);
});

test('object-key: a well-formed key owned by another user is FORBIDDEN (403)', () => {
  const bobsKey = `${BOB}/submissions/${SUBMISSION}/${fixedRandom()}.png`;
  assert.throws(() => assertOwnedObjectKey(bobsKey, ALICE), FotoaiForbiddenError);
  assert.doesNotThrow(() => assertOwnedObjectKey(bobsKey, BOB));
});

test('object-key: malformed keys are rejected with 400 (never signed)', () => {
  const bad = [
    `../${ALICE}/submissions/${SUBMISSION}/x.jpg`,
    `/${ALICE}/submissions/${SUBMISSION}/x.jpg`,
    `${ALICE}//submissions/${SUBMISSION}/x.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/../x.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/./x.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/x.jpg/extra`,
    `${ALICE}/submissions/x.jpg`,
    `${ALICE}\\submissions\\${SUBMISSION}\\x.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/x y.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/x.JPG`,
    `${CAROL.toUpperCase()}/submissions/${SUBMISSION}/x.jpg`,
    `${ALICE}/other/${SUBMISSION}/x.jpg`,
    `${ALICE}/submissions/${SUBMISSION}/${'a'.repeat(300)}.jpg`,
    '',
    `${ALICE}/submissions/${SUBMISSION}/x.jpg\n`,
    `${ALICE}/submissions/${SUBMISSION}/x.jpg?token=1`,
    `https://host/storage/v1/object/public/fotoai-submissions/${ALICE}/submissions/${SUBMISSION}/x.jpg`,
  ];
  for (const key of bad) {
    assert.throws(() => assertOwnedObjectKey(key, ALICE), FotoaiValidationError, `expected 400 for ${JSON.stringify(key)}`);
  }
  // Upper-case owner prefix is malformed even for the owner (keys are lowercase only).
  assert.throws(() => assertOwnedObjectKey(`${CAROL.toUpperCase()}/submissions/${SUBMISSION}/x.jpg`, CAROL), FotoaiValidationError);
  assert.doesNotThrow(() => assertOwnedObjectKey(`${CAROL}/submissions/${SUBMISSION}/x.jpg`, CAROL));
  assert.throws(() => assertOwnedObjectKey(null, ALICE), FotoaiValidationError);
  assert.throws(() => assertOwnedObjectKey(42, ALICE), FotoaiValidationError);
});

test('object-key: owner id itself must be a UUID', () => {
  assert.throws(() => assertOwnedObjectKey(`${ALICE}/submissions/${SUBMISSION}/x.jpg`, 'not-a-uuid'), FotoaiValidationError);
});

test('object-key: shared pattern is anchored and lowercase only', () => {
  assert.ok(SUBMISSION_OBJECT_KEY_PATTERN.startsWith('^'));
  assert.ok(SUBMISSION_OBJECT_KEY_PATTERN.endsWith('$'));
  assert.ok(!/[A-Z]/.test(SUBMISSION_OBJECT_KEY_PATTERN.replace(/\\\./g, '')), 'no uppercase in pattern');
});

test('uuid helpers: normalise and reject', () => {
  assert.equal(isUuid(CAROL), true);
  assert.equal(isUuid(CAROL.toUpperCase()), false);
  assert.equal(requireUuid(` ${CAROL.toUpperCase()} `, 'id'), CAROL);
  assert.throws(() => requireUuid(undefined, 'id'), FotoaiValidationError);
  assert.throws(() => requireUuid("' or 1=1 --", 'id'), FotoaiValidationError);
});
