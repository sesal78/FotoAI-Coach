import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Workspace-level config that the @fotoai/db tests and scripts depend on.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function turboDry(tasks: string[]): string {
  return execFileSync('pnpm', ['exec', 'turbo', 'run', ...tasks, '--dry=json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
}

test('turbo hashes the root files that package tasks read, so a cached pass cannot hide an edit', () => {
  const files = Object.keys(JSON.parse(turboDry(['test'])).globalCacheInputs.files as Record<string, string>);
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

test("turbo runs the legacy app's typecheck and test tasks", () => {
  const ids = (JSON.parse(turboDry(['typecheck', 'test'])).tasks as Array<{ taskId: string }>).map((t) => t.taskId);
  expect(ids).toEqual(expect.arrayContaining(['@fotoai/legacy-web#typecheck', '@fotoai/legacy-web#test']));
}, 60_000);
