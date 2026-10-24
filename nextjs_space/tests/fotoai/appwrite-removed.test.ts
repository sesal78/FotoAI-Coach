import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// P5: Appwrite is gone from the live web app. Supabase migrations keep the
// legacy_appwrite_id column (real data), so only that name is allowed.

const app = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_DIRS = ['app', 'lib', 'components', 'hooks', 'contexts', 'scripts'];
const SOURCE_FILES = ['middleware.ts', 'package.json', '.env.example', 'docker-compose.yml', '../.env.example'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sourceFiles(): string[] {
  return [
    ...SOURCE_DIRS.filter((d) => existsSync(join(app, d))).flatMap((d) => walk(join(app, d))),
    ...SOURCE_FILES.map((f) => join(app, f)).filter((f) => existsSync(f)),
  ];
}

test('appwrite removed: no source file, env example or package names Appwrite', () => {
  const hits = sourceFiles().filter((file) =>
    /appwrite/i.test(readFileSync(file, 'utf8').replace(/legacy_appwrite_id|legacyAppwriteId/g, '')),
  );
  assert.deepEqual(hits, []);
});

test('appwrite removed: the retired 410 routes and their helper are deleted', () => {
  assert.equal(existsSync(join(app, 'lib/retired-route.ts')), false);
  const stubs = walk(join(app, 'app')).filter((file) => /retiredRoute/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(stubs, []);
});
