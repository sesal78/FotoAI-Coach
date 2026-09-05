// Static checks of the FotoAI SQL migrations.
//
// These tests do NOT run SQL. No Postgres is available to this build and the
// task forbids Docker and remote access. They prove structural properties:
//   * collision-first: every file aborts with FOTOAI_COLLISION before its first
//     CREATE/INSERT, and the guard covers every name the file creates;
//   * naming: every created object starts with fotoai_ (bucket: fotoai-submissions);
//   * forbidden statements are absent;
//   * the object-key pattern is byte-identical in SQL and TypeScript.
// A real collision run (expected exit code != 0) must be done later on a
// disposable Postgres; see supabase/README.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUBMISSION_OBJECT_KEY_PATTERN } from '../../lib/fotoai/object-keys.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', '..', 'supabase', 'migrations', 'fotoai');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

function load(name: string): string {
  return readFileSync(join(DIR, name), 'utf8');
}

/** Strips -- comments and SQL string literals so keyword scans are not fooled. */
function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:[^']|'')*'/g, "''");
}

function createdNames(sql: string): Array<{ kind: string; name: string }> {
  const clean = stripCommentsAndStrings(sql);
  const out: Array<{ kind: string; name: string }> = [];
  const re = /\bcreate\s+(unique\s+index|index|table|type|function|policy)\s+([a-z0-9_.]+)/gi;
  for (const m of clean.matchAll(re)) {
    const kind = m[1].toLowerCase().replace(/\s+/g, ' ');
    const name = m[2].replace(/^public\./, '');
    out.push({ kind, name });
  }
  return out;
}

test('migrations: exactly three ordered files exist', () => {
  assert.deepEqual(FILES, ['0001_fotoai_schema.sql', '0002_fotoai_rls.sql', '0003_fotoai_storage.sql']);
});

for (const file of FILES) {
  const sql = load(file);
  const clean = stripCommentsAndStrings(sql);
  const lower = clean.toLowerCase();

  test(`migrations: ${file} is one transaction`, () => {
    assert.match(clean.trim(), /^begin;/i, 'must start with begin;');
    assert.match(clean.trim(), /commit;$/i, 'must end with commit;');
    assert.equal((lower.match(/\bbegin;/g) ?? []).length, 1);
    assert.equal((lower.match(/\bcommit;/g) ?? []).length, 1);
  });

  test(`migrations: ${file} is collision-first (guard raises before the first create/insert)`, () => {
    const guardStart = lower.indexOf('do $fotoai_guard$');
    const guardEnd = lower.indexOf('$fotoai_guard$;', guardStart + 1);
    assert.ok(guardStart > 0, 'guard block present');
    assert.ok(guardEnd > guardStart, 'guard block closed');
    // String literals are blanked in `clean`, so read the raise text from the raw file.
    const rawGuard = sql.slice(sql.indexOf('do $fotoai_guard$'), sql.indexOf('$fotoai_guard$;'));
    assert.match(rawGuard, /raise exception 'FOTOAI_COLLISION/i, 'guard raises FOTOAI_COLLISION');
    assert.match(rawGuard, /using errcode/i, 'guard sets a SQLSTATE');

    const firstChange = Math.min(
      ...['create ', 'insert ', 'alter ', 'grant ', 'revoke ', 'notify ']
        .map((kw) => { const i = lower.indexOf(kw, 0); return i === -1 ? Number.POSITIVE_INFINITY : i; }),
    );
    // Guard text may contain the word "create" inside strings; strings were
    // blanked, so any remaining keyword must come after the guard.
    assert.ok(firstChange > guardEnd, `first change (${firstChange}) must follow the guard (${guardEnd})`);
  });

  test(`migrations: ${file} contains no forbidden statements`, () => {
    const forbidden: Array<[string, RegExp]> = [
      ['DROP', /\bdrop\b/i],
      // DDL "create/alter ... if not exists" (plpgsql "if not exists (select" in the guard is fine)
      ['IF NOT EXISTS', /\b(create|alter)\s+[a-z ]*?\bif\s+not\s+exists\b/i],
      ['CREATE OR REPLACE', /\bcreate\s+or\s+replace\b/i],
      ['GRANT ALL', /\bgrant\s+all\b/i],
      ['GRANT ... TO public', /\bgrant\b[^;]*\bto\s+public\b/i],
      ['ALTER DEFAULT PRIVILEGES', /\balter\s+default\s+privileges\b/i],
      ['CREATE/ALTER ROLE', /\b(create|alter)\s+role\b/i],
      ['CREATE SCHEMA', /\bcreate\s+schema\b/i],
      ['CREATE EXTENSION', /\bcreate\s+extension\b/i],
      ['TRUNCATE', /\btruncate\b/i],
      ['DELETE FROM', /\bdelete\s+from\b/i],
      ['UPDATE ... SET (outside on conflict)', /(^|[^t]\s)update\s+(public\.|storage\.)?[a-z_]+\s+set\b/i],
      ['ON CONFLICT DO UPDATE on shared tables', /insert\s+into\s+storage\.[^;]*on\s+conflict/i],
      ['SECURITY DEFINER', /\bsecurity\s+definer\b/i],
      ['ALTER SYSTEM / SET (global)', /\balter\s+system\b/i],
      ['CREATE TRIGGER', /\bcreate\s+trigger\b/i],
    ];
    for (const [label, re] of forbidden) {
      assert.ok(!re.test(clean), `${file} must not contain ${label}`);
    }
  });

  test(`migrations: ${file} creates only fotoai_ names`, () => {
    const names = createdNames(sql);
    assert.ok(names.length > 0 || file === '0003_fotoai_storage.sql');
    for (const { kind, name } of names) {
      assert.match(name, /^fotoai_[a-z0-9_]+$/, `${kind} ${name} must be prefixed fotoai_`);
    }
  });

  test(`migrations: ${file} only alters, grants on, or revokes from fotoai_ objects`, () => {
    for (const m of clean.matchAll(/\balter\s+table\s+(?:public\.)?([a-z0-9_.]+)/gi)) {
      assert.match(m[1], /^fotoai_/, `alter table ${m[1]}`);
    }
    for (const m of clean.matchAll(/\b(grant|revoke)\b[^;]*?\bon\s+(?:table\s+|function\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      assert.match(m[2], /^fotoai_/, `${m[1]} on ${m[2]}`);
    }
    for (const m of clean.matchAll(/\bcreate\s+policy\s+[a-z0-9_]+\s+on\s+([a-z0-9_.]+)/gi)) {
      assert.ok(/^(public\.)?fotoai_/.test(m[1]) || m[1] === 'storage.objects', `policy on ${m[1]}`);
    }
  });
}

test('migrations: 0001 guard scans the whole fotoai_ prefix (covers every created name)', () => {
  const sql = load('0001_fotoai_schema.sql');
  const guard = sql.slice(sql.indexOf('do $fotoai_guard$'), sql.indexOf('$fotoai_guard$;'));
  // Relations (tables + indexes), types, and functions are each scanned by prefix.
  assert.match(guard, /pg_class[\s\S]*relname like 'fotoai\\_%'/);
  assert.match(guard, /pg_type[\s\S]*typname like 'fotoai\\_%'/);
  assert.match(guard, /pg_proc[\s\S]*proname like 'fotoai\\_%'/);
  const kinds = new Set(createdNames(sql).map((n) => n.kind.replace('unique ', '')));
  assert.deepEqual([...kinds].sort(), ['function', 'index', 'table', 'type']);
});

test('migrations: 0001 creates the 14 mapped tables with user_id -> auth.users cascade', () => {
  const sql = load('0001_fotoai_schema.sql');
  const tables = createdNames(sql).filter((n) => n.kind === 'table').map((n) => n.name);
  assert.deepEqual(tables, [
    'fotoai_user_preferences', 'fotoai_user_gear', 'fotoai_daily_challenges',
    'fotoai_challenge_submissions', 'fotoai_itineraries', 'fotoai_user_progress',
    'fotoai_agent_actions', 'fotoai_photo_critiques', 'fotoai_reverse_analyses',
    'fotoai_editing_recipes', 'fotoai_weekly_reports', 'fotoai_portfolio_analyses',
    'fotoai_user_skills', 'fotoai_xp_events',
  ]);
  const refs = (sql.match(/user_id uuid not null (unique )?references auth\.users \(id\) on delete cascade/g) ?? []).length;
  assert.equal(refs, 14, 'every table references auth.users(id) on delete cascade');
  assert.match(sql, /photo_object_key text/);
  assert.ok(!/photo_url|photoUrl/.test(sql), 'no URL column; keys only');
});

test('migrations: 0001 commits secure-by-default (revoke + RLS for every table in the same transaction)', () => {
  const sql = load('0001_fotoai_schema.sql');
  const tables = createdNames(sql).filter((n) => n.kind === 'table').map((n) => n.name);
  assert.equal(tables.length, 14);
  const commitAt = sql.lastIndexOf('commit;');
  for (const table of tables) {
    const revoke = new RegExp(`revoke all privileges on table public\\.${table}\\s+from anon, authenticated;`);
    const enable = new RegExp(`alter table public\\.${table}\\s+enable row level security;`);
    assert.match(sql, revoke, `${table}: browser privileges must be revoked in 0001`);
    assert.match(sql, enable, `${table}: RLS must be enabled in 0001`);
    assert.ok(sql.search(revoke) < commitAt && sql.search(enable) < commitAt, `${table}: protection precedes commit`);
  }
  assert.equal((sql.match(/enable row level security;/g) ?? []).length, 14);
  assert.equal((sql.match(/revoke all privileges on table public\.fotoai_[a-z_]+\s+from anon, authenticated;/g) ?? []).length, 14);
  assert.match(sql, /revoke execute on function public\.fotoai_award_skill_xp[^;]*from public, anon, authenticated;/);
  // No policy and no grant in 0001: after it commits, browser roles are deny-all.
  assert.equal(createdNames(sql).filter((n) => n.kind === 'policy').length, 0);
  assert.ok(!/\bgrant\b/i.test(stripCommentsAndStrings(sql)), '0001 must not grant anything');
});

test('migrations: 0002 guard requires 0001 fully in place (RLS on, no browser privileges) and refuses existing fotoai_ policies', () => {
  const sql = load('0002_fotoai_rls.sql');
  const guard = sql.slice(sql.indexOf('do $fotoai_guard$'), sql.indexOf('$fotoai_guard$;'));
  assert.match(guard, /FOTOAI_PRECONDITION: apply 0001 first/);
  assert.match(guard, /FOTOAI_PRECONDITION: row level security is not enabled/);
  assert.match(guard, /has_table_privilege\('anon'/);
  assert.match(guard, /has_table_privilege\('authenticated'/);
  assert.match(guard, /pg_policies[\s\S]*policyname like 'fotoai\\_%'/);
  assert.match(guard, /FOTOAI_COLLISION: fotoai_ policies already exist/);

  // 0002 only adds grants and policies; protection itself lives in 0001.
  assert.equal((sql.match(/enable row level security;/g) ?? []).length, 0);
  assert.equal((sql.match(/revoke all privileges/g) ?? []).length, 0);
  const policies = createdNames(sql).filter((n) => n.kind === 'policy');
  assert.ok(policies.length >= 40, `expected >= 40 policies, got ${policies.length}`);
  for (const statement of sql.match(/create policy[\s\S]*?;/g) ?? []) {
    assert.match(statement, /to authenticated/, `policy must target authenticated only: ${statement}`);
    assert.match(statement, /auth\.uid\(\)/, `policy predicate must use auth.uid(): ${statement}`);
    assert.ok(!/\bto (public|anon)\b/.test(statement), `policy must not target public/anon: ${statement}`);
  }
  // No write policy on derived XP tables.
  assert.ok(!/fotoai_user_skills_(insert|update|delete)/.test(sql));
  assert.ok(!/fotoai_xp_events_(insert|update|delete)/.test(sql));
  assert.match(sql, /grant select\s+on table public\.fotoai_user_skills\s+to authenticated;/);
  assert.match(sql, /grant select\s+on table public\.fotoai_xp_events\s+to authenticated;/);
  // XP function: service_role granted here (browser roles were revoked in 0001).
  assert.match(sql, /grant execute on function public\.fotoai_award_skill_xp[^;]*to service_role;/);
  assert.ok(!/grant execute[^;]*to (anon|authenticated|public)\b/.test(sql));
});

test('migrations: 0003 creates only the fotoai-submissions bucket (private) and one insert policy', () => {
  const sql = load('0003_fotoai_storage.sql');
  const guard = sql.slice(sql.indexOf('do $fotoai_guard$'), sql.indexOf('$fotoai_guard$;'));
  assert.match(guard, /storage\.buckets b where b\.id = 'fotoai-submissions' or b\.name = 'fotoai-submissions'/);
  assert.match(guard, /pg_policies[\s\S]*tablename = 'objects' and p\.policyname like 'fotoai\\_%'/);

  const bucketInserts = sql.match(/insert into storage\.buckets[\s\S]*?\);/g) ?? [];
  assert.equal(bucketInserts.length, 1);
  assert.match(bucketInserts[0], /'fotoai-submissions',\s*'fotoai-submissions',\s*false/);
  const buckets = [...sql.matchAll(/'(fotoai-[a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(buckets)], ['fotoai-submissions']);

  const policies = createdNames(sql).filter((n) => n.kind === 'policy').map((n) => n.name);
  assert.deepEqual(policies, ['fotoai_submissions_insert']);
  assert.ok(!/for (select|update|delete)/i.test(sql), 'no browser read/update/delete policy on storage');
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
});

test('migrations: the object-key pattern is identical in SQL (0001, 0003) and TypeScript', () => {
  const ts = SUBMISSION_OBJECT_KEY_PATTERN;
  // In SQL the regex lives inside a single-quoted literal; the only difference
  // is that TypeScript escapes the dot as "\\." in source and SQL uses "\.".
  const sqlForm = ts.replace('\\\\.', '\\.');
  assert.ok(load('0001_fotoai_schema.sql').includes(`~ '${sqlForm}'`), '0001 check constraint pattern differs');
  assert.ok(load('0003_fotoai_storage.sql').includes(`~ '${sqlForm}'`), '0003 storage policy pattern differs');
});
