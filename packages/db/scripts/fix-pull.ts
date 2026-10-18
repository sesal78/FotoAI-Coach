// Repairs known drizzle-kit pull problems so the pulled schema compiles, states the real
// defaults and checks, and `drizzle-kit generate` finds no changes against the baseline.
// The baseline drift test runs the same functions, so the committed files stay exact.
//   text  default ''   is emitted as  .default(')        (invalid TypeScript)
//   text[] default '{}' is emitted as .default([""])     (one empty string, not an empty array)
//                       and stored in the snapshot as '{""}'
//   backslashes in sql`...` templates are not escaped     (a CHECK regex loses its \.)
//   auth.users is referenced (foreign keys, relations) but not emitted (schemaFilter: public)
//   relations.ts imports "./schema" without the extension NodeNext requires
// Usage: node scripts/fix-pull.ts <dir>   (rewrites <dir>/schema.ts, relations.ts, meta/0000_snapshot.json)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SQL_IMPORT = 'import { sql } from "drizzle-orm"\n';
const AUTH_USERS =
  'import { authUsers } from "drizzle-orm/supabase"\n\n' +
  '// auth.users belongs to Supabase Auth; pull leaves it out (schemaFilter: public).\n' +
  '// Not exported, so drizzle-kit generate never tries to create it.\n' +
  'const users = authUsers\n';

/** Doubles each lone backslash inside sql`...` bodies; pairs already doubled stay as they are. */
function escapeSqlTemplates(text: string): string {
  return text.replace(/sql`([^`]*)`/g, (_match, body: string) => 'sql`' + body.replace(/\\\\|\\/g, (s) => (s.length === 2 ? s : '\\\\')) + '`');
}

export function fixPulledSchema(text: string): string {
  let fixed = text.replace(/\.default\('\)/g, ".default('')").replace(/\.array\(\)\.default\(\[""\]\)/g, '.array().default([])');
  fixed = escapeSqlTemplates(fixed);
  if (!fixed.includes(AUTH_USERS)) fixed = fixed.replace(SQL_IMPORT, SQL_IMPORT + AUTH_USERS);
  return fixed;
}

export function fixPulledRelations(text: string): string {
  return text.replace(/^import \{ ([^}]*) \} from "\.\/schema";$/m, (_line, names: string) => {
    const rest = names
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name && name !== 'usersInAuth');
    return 'import { authUsers as usersInAuth } from "drizzle-orm/supabase";\n' + `import { ${rest.join(', ')} } from "./schema.ts";`;
  });
}

export function fixPulledSnapshot(text: string): string {
  return text.split(String.raw`"'{\"\"}'"`).join(`"'{}'"`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node scripts/fix-pull.ts <dir>');
  const rewrite = (file: string, fix: (text: string) => string) => {
    const path = join(dir, file);
    if (existsSync(path)) writeFileSync(path, fix(readFileSync(path, 'utf8')));
  };
  rewrite('schema.ts', fixPulledSchema);
  rewrite('relations.ts', fixPulledRelations);
  rewrite(join('meta', '0000_snapshot.json'), fixPulledSnapshot);
}
