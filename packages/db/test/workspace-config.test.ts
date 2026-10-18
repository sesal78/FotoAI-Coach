import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Workspace-level config that the @fotoai/db tests and scripts depend on.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('turbo hashes the root files that package tasks read, so a cached pass cannot hide an edit', () => {
  const dry = execFileSync('pnpm', ['exec', 'turbo', 'run', 'test', '--dry=json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
  const files = Object.keys(JSON.parse(dry).globalCacheInputs.files as Record<string, string>);
  expect(files).toEqual(
    expect.arrayContaining([
      'eslint.config.mjs',
      'tsconfig.base.json',
      'supabase/migrations/20261017000001_fotoai_schema.sql',
      'nextjs_space/supabase/migrations/fotoai/0001_fotoai_schema.sql',
    ]),
  );
}, 60_000);

test('Node floor allows running scripts/fix-pull.ts without flags (type stripping is default from 22.18)', () => {
  const pkg = JSON.parse(readFileSync(repoRoot + 'package.json', 'utf8'));
  expect(pkg.engines.node).toBe('>=22.18');
});
