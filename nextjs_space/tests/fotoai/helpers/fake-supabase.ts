// In-memory stand-in for the Supabase client used by the FotoAI tests.
//
// It models the two rules the real stack enforces so tests can prove the
// application code relies on them correctly:
//   1. RLS: a request made with user X's token only sees/changes rows where
//      user_id = X, and inserts must carry user_id = X.
//   2. Storage insert policy: an upload key must start with the token owner's id.
// It also records every server-side (service role) call so tests can assert
// that signing/removal never happened for a denied request.

import { FotoaiAuthError, FotoaiForbiddenError } from '../../../lib/fotoai/errors.ts';
import type { VerifiedUser } from '../../../lib/fotoai/membership.ts';
import type { FotoaiSupabaseClient, PasswordSession } from '../../../lib/fotoai/supabase-http.ts';

export const ALICE = '11111111-1111-4111-8111-111111111111';
export const BOB = '22222222-2222-4222-8222-222222222222';
export const TOKEN_ALICE = 'tok-alice';
export const TOKEN_BOB = 'tok-bob';

type Row = Record<string, any>;

export interface FakeSupabase extends FotoaiSupabaseClient {
  tables: Map<string, Row[]>;
  objects: Map<string, { owner: string; bytes: number; contentType: string }>;
  serviceCalls: Array<{ op: 'sign' | 'remove'; keys: string[] }>;
  seed(table: string, row: Row): Row;
  reset(): void;
}

let idCounter = 0;
export function nextUuid(): string {
  idCounter += 1;
  const hex = idCounter.toString(16).padStart(12, '0');
  return `aaaaaaaa-0000-4000-8000-${hex}`;
}

function uidForToken(token: string): string {
  if (token === TOKEN_ALICE) return ALICE;
  if (token === TOKEN_BOB) return BOB;
  throw new FotoaiAuthError('fake: unknown token');
}

function parseFilter(value: string): { op: string; arg: string } {
  const dot = value.indexOf('.');
  return { op: value.slice(0, dot), arg: value.slice(dot + 1) };
}

function matches(row: Row, query: Record<string, string>): boolean {
  for (const [col, raw] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset'].includes(col)) continue;
    const { op, arg } = parseFilter(raw);
    if (op !== 'eq') throw new Error(`fake: unsupported operator ${op}`);
    if (String(row[col]) !== arg) return false;
  }
  return true;
}

export function createFakeSupabase(): FakeSupabase {
  const tables = new Map<string, Row[]>();
  const objects = new Map<string, { owner: string; bytes: number; contentType: string }>();
  const serviceCalls: FakeSupabase['serviceCalls'] = [];

  const rowsOf = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };

  // RLS emulation: visible rows are the token owner's rows that match the query.
  const visible = (table: string, query: Record<string, string>, token: string) => {
    const uid = uidForToken(token);
    let rows = rowsOf(table).filter((r) => r.user_id === uid && matches(r, query));
    if (query.order) {
      const [col, dir] = query.order.split('.');
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    if (query.limit) rows = rows.slice(0, Number(query.limit));
    return rows;
  };

  const fake: FakeSupabase = {
    tables,
    objects,
    serviceCalls,

    seed(table, row) {
      const full = { id: nextUuid(), ...row };
      rowsOf(table).push(full);
      return full;
    },

    reset() {
      tables.clear();
      objects.clear();
      serviceCalls.length = 0;
    },

    async getUser(token): Promise<VerifiedUser | null> {
      if (token === TOKEN_ALICE) return { id: ALICE, email: 'alice@test.invalid' };
      if (token === TOKEN_BOB) return { id: BOB, email: 'bob@test.invalid' };
      return null;
    },

    async signInWithPassword(email, password): Promise<PasswordSession> {
      if (email === 'alice@test.invalid' && password === 'correct-horse') {
        return { userId: ALICE, accessToken: TOKEN_ALICE, refreshToken: 'ref-alice', expiresIn: 3600 };
      }
      throw new FotoaiAuthError('Invalid credentials');
    },

    async signUp() {
      return { userId: null, session: null };
    },

    async signOut() {
      /* noop */
    },

    async restSelect(table, query, token) {
      return visible(table, query, token) as any[];
    },

    async restInsert(table, row, token) {
      const uid = uidForToken(token);
      if (row.user_id !== uid) {
        // RLS with-check violation: PostgREST answers 403 for authenticated.
        throw new FotoaiForbiddenError('fake RLS: new row violates row-level security policy');
      }
      const full = { id: nextUuid(), ...row };
      rowsOf(table).push(full);
      return full as any;
    },

    async restUpsert(table, row, onConflict, token) {
      const uid = uidForToken(token);
      if (row.user_id !== uid) {
        throw new FotoaiForbiddenError('fake RLS: new row violates row-level security policy');
      }
      const existing = rowsOf(table).find((candidate) => candidate[onConflict] === row[onConflict]);
      if (existing) {
        Object.assign(existing, row);
        return existing as any;
      }
      const full = { id: nextUuid(), ...row };
      rowsOf(table).push(full);
      return full as any;
    },

    async restUpdate(table, query, patch, token) {
      const uid = uidForToken(token);
      if ('user_id' in patch && patch.user_id !== uid) {
        throw new FotoaiForbiddenError('fake RLS: update violates row-level security policy');
      }
      const targets = visible(table, { ...query, limit: '' }, token);
      for (const row of targets) Object.assign(row, patch);
      return targets as any[];
    },

    async restDelete(table, query, token) {
      const targets = visible(table, { ...query, limit: '' }, token);
      const all = rowsOf(table);
      for (const row of targets) all.splice(all.indexOf(row), 1);
      return targets as any[];
    },

    async storageUpload(objectKey, bytes, contentType, token) {
      const uid = uidForToken(token);
      if (objectKey.split('/')[0] !== uid) {
        throw new FotoaiForbiddenError('fake storage RLS: key prefix is not the caller');
      }
      if (objects.has(objectKey)) throw new FotoaiForbiddenError('fake storage: duplicate key');
      objects.set(objectKey, { owner: uid, bytes: bytes.byteLength, contentType });
    },

    async storageCreateSignedUrl(objectKey, expiresIn) {
      serviceCalls.push({ op: 'sign', keys: [objectKey] });
      return `https://supabase.test.invalid/storage/v1/object/sign/fotoai-submissions/${objectKey}?token=fake&expires=${expiresIn}`;
    },

    async storageRemove(keys) {
      serviceCalls.push({ op: 'remove', keys });
      for (const k of keys) objects.delete(k);
    },
  };

  return fake;
}
