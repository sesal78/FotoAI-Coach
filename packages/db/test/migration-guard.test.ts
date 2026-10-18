import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { migrationViolations } from './support/migration-rules.ts';

const migrationsDir = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
const BASELINE_LAST = '20261017000003';

function rootMigrationsAfter(version: string): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql') && name.slice(0, 14) > version)
    .sort();
}

test('new root migrations only add, or replace a CHECK in place', () => {
  for (const file of rootMigrationsAfter(BASELINE_LAST)) {
    expect(migrationViolations(readFileSync(migrationsDir + file, 'utf8')), file).toEqual([]);
  }
});

test('flags destructive statements', () => {
  expect(migrationViolations('alter table t drop column c;')).toHaveLength(1);
  expect(migrationViolations('drop table t;')).toHaveLength(1);
  expect(migrationViolations('drop function public.f(uuid);')).toHaveLength(1);
  expect(migrationViolations('truncate t;')).toHaveLength(1);
  expect(migrationViolations('delete from public.t;')).toHaveLength(1);
  expect(migrationViolations('alter table t drop constraint t_c_check;')).toEqual([
    'DROP CONSTRAINT t_c_check without ADD CONSTRAINT t_c_check',
  ]);
  expect(
    migrationViolations('alter table t drop constraint t_c_check;\nalter table t add constraint t_c_check check (c > 0);'),
  ).toEqual([]);
});

test('allows additive statements and in-place function replacement', () => {
  const ok = [
    "alter table t add column c text not null default 'x';",
    "update public.t set c = 'y' where kind = 'z';",
    'create or replace function public.f() returns int language sql as $$ select 1 $$;',
    'delete from public.t where id = 1;',
  ].join('\n');
  expect(migrationViolations(ok)).toEqual([]);
});

test('ignores SQL comments', () => {
  expect(migrationViolations('-- drop table t;\n/* truncate t; */\nselect 1;')).toEqual([]);
});
