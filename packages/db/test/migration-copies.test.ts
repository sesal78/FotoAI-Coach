import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Until nextjs_space/ is retired, the root supabase/migrations copies must stay identical
// to the migrations the live app was deployed with.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const PAIRS: Array<[string, string]> = [
  ['supabase/migrations/20261017000001_fotoai_schema.sql', 'nextjs_space/supabase/migrations/fotoai/0001_fotoai_schema.sql'],
  ['supabase/migrations/20261017000002_fotoai_rls.sql', 'nextjs_space/supabase/migrations/fotoai/0002_fotoai_rls.sql'],
  ['supabase/migrations/20261017000003_fotoai_storage.sql', 'nextjs_space/supabase/migrations/fotoai/0003_fotoai_storage.sql'],
];

const read = (path: string) => readFileSync(repoRoot + path, 'utf8');
const norm = (text: string) => text.replace(/\r\n/g, '\n');

test('root migration copies match nextjs_space byte-for-byte after newline normalisation', () => {
  for (const [root, legacy] of PAIRS) expect(norm(read(root)), root).toBe(norm(read(legacy)));
});
