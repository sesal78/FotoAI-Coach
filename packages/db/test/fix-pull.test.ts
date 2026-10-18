import { expect, test } from 'vitest';

import { fixPulledRelations, fixPulledSchema, fixPulledSnapshot } from '../scripts/fix-pull.ts';

test("repairs drizzle-kit's broken empty-string default", () => {
  expect(fixPulledSchema("\tnotes: text().default(').notNull(),\n")).toBe("\tnotes: text().default('').notNull(),\n");
});

test("turns a text[] default of [\"\"] into the real '{}' empty array", () => {
  expect(fixPulledSchema('\tshotList: text("shot_list").array().default([""]).notNull(),\n')).toBe(
    '\tshotList: text("shot_list").array().default([]).notNull(),\n',
  );
});

test('leaves correct defaults alone', () => {
  const ok = "\tstatus: text().default('pending').notNull(),\n\tspots: jsonb().default([]).notNull(),\n\tdetails: jsonb().default({}).notNull(),\n";
  expect(fixPulledSchema(ok)).toBe(ok);
});

test('is idempotent', () => {
  const once = fixPulledSchema("\ta: text().default(').notNull(),\n\tb: text().array().default([\"\"]).notNull(),\n");
  expect(fixPulledSchema(once)).toBe(once);
});

const HEAD = 'import { pgTable, uuid } from "drizzle-orm/pg-core"\nimport { sql } from "drizzle-orm"\n\nexport const t = pgTable("t", { id: uuid() })\n';

test('declares auth.users for foreign keys without exporting it as a table to create', () => {
  const fixed = fixPulledSchema(HEAD);
  expect(fixed).toContain('import { authUsers } from "drizzle-orm/supabase"');
  expect(fixed).toContain('const users = authUsers');
  expect(fixed).not.toMatch(/export const \w+ = authUsers/);
  expect(fixed.indexOf('const users = authUsers')).toBeLessThan(fixed.indexOf('export const t ='));
  expect(fixPulledSchema(fixed)).toBe(fixed);
});

// String.raw keeps every backslash exactly as it appears in the file.
test('keeps backslashes inside sql templates (a CHECK regex must not lose its escapes)', () => {
  const pulled = String.raw`	check("c", sql${'`'}(key ~ '^[a-z]+\.(jpg|png)$'::text)${'`'}),`;
  const expected = String.raw`	check("c", sql${'`'}(key ~ '^[a-z]+\\.(jpg|png)$'::text)${'`'}),`;
  expect(fixPulledSchema(pulled)).toBe(expected);
  expect(fixPulledSchema(expected)).toBe(expected);
});

test("the pull snapshot records text[] default '{}' as the empty array", () => {
  const snap = String.raw`"default": "'{\"\"}'"`;
  const expected = String.raw`"default": "'{}'"`;
  expect(fixPulledSnapshot(snap)).toBe(expected);
  expect(fixPulledSnapshot(expected)).toBe(expected);
});

test('relations import the schema with an explicit .ts extension and take auth.users from drizzle-orm', () => {
  const pulled = 'import { relations } from "drizzle-orm/relations";\nimport { usersInAuth, fotoaiUserGear } from "./schema";\n';
  const fixed = fixPulledRelations(pulled);
  expect(fixed).toBe(
    'import { relations } from "drizzle-orm/relations";\nimport { authUsers as usersInAuth } from "drizzle-orm/supabase";\nimport { fotoaiUserGear } from "./schema.ts";\n',
  );
  expect(fixPulledRelations(fixed)).toBe(fixed);
});
