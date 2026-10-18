import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { comparableSnapshot } from './support/drizzle-snapshot.ts';

const committed = readFileSync(fileURLToPath(new URL('../drizzle/meta/0000_snapshot.json', import.meta.url)), 'utf8');
const TABLE = 'public.fotoai_challenge_submissions';

/** The same snapshot as a fresh database would emit it: other ids, constraints in another order. */
function reordered(json: string): string {
  const snap = JSON.parse(json);
  snap.id = 'another-id';
  snap.prevId = 'another-prev';
  for (const table of Object.values(snap.tables) as Array<Record<string, Record<string, unknown>>>) {
    for (const key of ['foreignKeys', 'checkConstraints', 'uniqueConstraints', 'indexes'] as const) {
      table[key] = Object.fromEntries(Object.entries(table[key]!).reverse());
    }
  }
  return JSON.stringify(snap, null, 2);
}

test('ignores constraint order and snapshot ids (they differ between databases)', () => {
  expect(comparableSnapshot(reordered(committed))).toEqual(comparableSnapshot(committed));
});

test('still detects a real schema difference', () => {
  const snap = JSON.parse(committed);
  delete snap.tables[TABLE].checkConstraints.fotoai_challenge_submissions_feedback_status_check;
  expect(comparableSnapshot(JSON.stringify(snap))).not.toEqual(comparableSnapshot(committed));
});

test('applies the pull fix-up, so a raw pull compares equal to the committed baseline', () => {
  const raw = JSON.parse(committed);
  raw.tables[TABLE].policies = { p: { name: 'p', as: 'PERMISSIVE', for: 'SELECT', to: ['authenticated'] } };
  expect(comparableSnapshot(JSON.stringify(raw))).toEqual(comparableSnapshot(committed));
});
