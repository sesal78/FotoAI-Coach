import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';

import { fixPulledRelations, fixPulledSchema } from '../scripts/fix-pull.ts';
import { resolveDatabaseUrl } from './support/local-db.ts';

const pkgRoot = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('refuses a non-local database URL and fails instead of skipping when required', () => {
  expect(() => resolveDatabaseUrl({ FOTOAI_TEST_DATABASE_URL: 'postgresql://u:p@db.techiesandbox.com:5432/postgres' })).toThrow(/local/);
  expect(() => resolveDatabaseUrl({ FOTOAI_REQUIRE_DB_TESTS: '1' })).toThrow(/FOTOAI_TEST_DATABASE_URL/);
  expect(resolveDatabaseUrl({})).toBeNull();
});

const databaseUrl = resolveDatabaseUrl(process.env);

describe.skipIf(!databaseUrl)('drizzle baseline', () => {
  const out = mkdtempSync(join(tmpdir(), 'drizzle-pull-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  test('drizzle pull output matches the committed baseline', () => {
    execFileSync('pnpm', ['exec', 'drizzle-kit', 'pull', '--config', 'drizzle.config.ts'], {
      cwd: pkgRoot,
      env: { ...process.env, DRIZZLE_OUT: out },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    expect(fixPulledSchema(read(join(out, 'schema.ts')))).toBe(read(join(pkgRoot, 'src/schema/schema.ts')));
    expect(fixPulledRelations(read(join(out, 'relations.ts')))).toBe(read(join(pkgRoot, 'src/schema/relations.ts')));
  }, 120_000);

  test('drizzle-kit generate finds no changes against the committed baseline', () => {
    // drizzle-kit generate mishandles absolute out paths on Windows and exits 0 on errors,
    // so use a relative scratch folder and require its own "no changes" message.
    const rel = `.drizzle-check-${process.pid}-${Date.now()}`;
    const copy = join(pkgRoot, rel);
    try {
      cpSync(join(pkgRoot, 'drizzle'), copy, { recursive: true });
      const before = readdirSync(copy).sort();
      const output = execFileSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--config', 'drizzle.config.ts', '--name', 'drift-check'], {
        cwd: pkgRoot,
        env: { ...process.env, DRIZZLE_OUT: `./${rel}` },
        encoding: 'utf8',
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });
      expect(output).toMatch(/No schema changes/i);
      expect(readdirSync(copy).sort()).toEqual(before);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  }, 120_000);
});
