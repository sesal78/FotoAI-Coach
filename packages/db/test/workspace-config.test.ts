import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

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

describe('apps/mobile (phase 3)', () => {
  const read = (path: string) => JSON.parse(readFileSync(repoRoot + path, 'utf8'));

  test('apps/mobile is a workspace project named @fotoai/mobile', () => {
    expect(read('apps/mobile/package.json').name).toBe('@fotoai/mobile');
    const ids = (JSON.parse(turboDry(['typecheck', 'test'])).tasks as Array<{ taskId: string }>).map((t) => t.taskId);
    expect(ids).toEqual(expect.arrayContaining(['@fotoai/mobile#typecheck', '@fotoai/mobile#test']));
  }, 60_000);

  test('its tsconfig extends the base and is strict', () => {
    const tsconfig = read('apps/mobile/tsconfig.json');
    expect([tsconfig.extends].flat()).toEqual(expect.arrayContaining(['../../tsconfig.base.json']));
    const base = read('tsconfig.base.json');
    expect(tsconfig.compilerOptions?.strict ?? base.compilerOptions?.strict).toBe(true);
  });

  test('its Expo SDK packages are pinned (no ^ or ~ on expo*)', () => {
    const pkg = read('apps/mobile/package.json');
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    const expo = Object.entries(deps).filter(([name]) => name === 'expo' || name.startsWith('expo-') || name === 'react-native');
    expect(expo.length).toBeGreaterThan(3);
    for (const [name, version] of expo) expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
