import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const code = "import { createServiceClient } from '@fotoai/db/service';\nexport const make = createServiceClient;\n";

async function restricted(filePath: string): Promise<boolean> {
  const [result] = await new ESLint({ cwd: repoRoot }).lintText(code, { filePath: repoRoot + filePath });
  return result!.messages.some((m) => m.ruleId === 'no-restricted-imports');
}

test('importing @fotoai/db/service outside privileged/ fails lint', async () => {
  expect(await restricted('packages/core/src/challenges.ts')).toBe(true);
  expect(await restricted('apps/web/app/api/v2/route.ts')).toBe(true);
}, 30_000); // first ESLint start can take >5 s while the whole workspace tests in parallel

test('importing @fotoai/db/service inside privileged/ passes lint', async () => {
  expect(await restricted('packages/core/src/privileged/xp.ts')).toBe(false);
}, 30_000);
