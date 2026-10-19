import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Undo scripts are the rollback path for production migrations: they must say how to run
// atomically, say what data they discard, and stop BEFORE changing anything when unsafe.
const undoDir = fileURLToPath(new URL('../../../supabase/undo/', import.meta.url));
const read = (name: string) => readFileSync(undoDir + name, 'utf8').replace(/\r\n/g, '\n');
const firstIndex = (text: string, pattern: RegExp) => text.search(pattern);

test('every undo script names the atomic psql invocation and what it discards', () => {
  for (const file of readdirSync(undoDir).filter((f) => f.endsWith('.undo.sql'))) {
    const text = read(file);
    expect(text, file).toMatch(/psql -1 -v ON_ERROR_STOP=1/);
    expect(text, file).toMatch(/^-- Discards: /m);
  }
});

test('the challenge-source undo refuses to start while superseded rows exist', () => {
  const text = read('20261018100001_challenge_source.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*superseded/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the plan_step undo refuses to start while plan_step XP events exist', () => {
  const text = read('20261018100002_xp_plan_step.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*plan_step/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the places undo refuses to start while any saved spot exists', () => {
  const text = read('20261019100002_places.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*spot/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the shoot-plans undo refuses to start while any plan exists', () => {
  const text = read('20261019100003_shoot_plans.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*plan/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the film-rolls undo refuses to start while any roll exists', () => {
  const text = read('20261019100004_film_rolls.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*roll/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the photos undo refuses to start while any photo exists', () => {
  const text = read('20261019100005_photos.undo.sql');
  const guard = firstIndex(text, /raise exception[^;]*photo/i);
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(firstIndex(text, /\bdrop\b/i));
});

test('the coach undo refuses while coach messages or photo checks exist', () => {
  const text = read('20261019100006_coach_and_photo_checks.undo.sql');
  const drop = firstIndex(text, /\bdrop\b/i);
  const messages = firstIndex(text, /raise exception[^;]*coach message/i);
  const checks = firstIndex(text, /raise exception[^;]*photo check/i);
  expect(messages).toBeGreaterThan(-1);
  expect(checks).toBeGreaterThan(-1);
  expect(Math.max(messages, checks)).toBeLessThan(drop);
});
