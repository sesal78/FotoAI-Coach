import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { catalogSql } from '../scripts/catalog-sql.ts';

const migration = fileURLToPath(new URL('../../../supabase/migrations/20261019100001_gear_catalog.sql', import.meta.url));
const norm = (text: string) => text.replace(/\r\n/g, '\n').trim();

test('the seed in the migration equals the SQL generated from catalog.ts', () => {
  const text = readFileSync(migration, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('-- BEGIN CATALOG SEED');
  const end = text.indexOf('-- END CATALOG SEED');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  expect(norm(text.slice(start + '-- BEGIN CATALOG SEED'.length, end))).toBe(norm(catalogSql()));
});

test('generated SQL escapes quotes and writes nulls for unsourced values', () => {
  const sql = catalogSql();
  expect(sql).toContain("'yashica-electro-35-gl', 'Yashica', 'Electro 35 GL', 'film', null, array['A']::text[], null, 0.002, null");
  expect(sql).not.toMatch(/undefined|NaN/);
});
