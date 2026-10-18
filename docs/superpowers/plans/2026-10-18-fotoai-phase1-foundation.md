# FotoAI Refactor Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm + Turborepo workspace with the first shared packages: env, contracts, and db (supabase-js clients, generated types, a Drizzle baseline). Add a root local-Supabase project and CI that tests the workspace against a real Postgres. The live app does not change.

**Architecture:**
- New code goes in `packages/*` as ESM TypeScript packages named `@fotoai/*`. Turborepo runs them.
- `nextjs_space/` (the live app) stays on npm with its own lockfile, outside the workspace. It is not edited. Dokploy builds it from `./nextjs_space` exactly as today.
- At runtime, data access uses supabase-js through PostgREST, so RLS applies with the user's token. Drizzle is used only for schema-as-code and for generating migrations, not for runtime queries. This is the planner's call. The live database is reached through PostgREST and has no direct Postgres access, and the spec requires RLS-aware access.
- `@supabase/ssr` (web cookie sessions, spec 5.2) is added in phase 4 together with `apps/web`, because phase 1 has no web app to use it. This is the planner's call.

**Tech Stack:**
- pnpm workspaces and Turborepo 2;
- TypeScript (strict);
- Vitest;
- `@t3-oss/env-core` and zod 3;
- `@supabase/supabase-js` 2;
- Drizzle ORM and drizzle-kit;
- Supabase CLI 2.118.0;
- GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-18-fotoai-refactor-design.md` (sections 3, 5.1, 5.2, 5.13, 6 and 10, phase 1). Phase map: `docs/superpowers/plans/2026-10-18-fotoai-refactor-index.md`.

## Global Constraints

- Node 22 (`"engines": { "node": ">=22.6" }`), the same as CI and the Dockerfile.
- pnpm: pin the latest stable 10.x exactly in the root `packageManager`. Turborepo 2.x.
- zod stays on major 3, the same major as `nextjs_space` (zod 3.23.8). Phase 2 imports `@fotoai/contracts` into the live app.
- **`nextjs_space/` must not change.** `git diff --stat origin/master -- nextjs_space` prints nothing at the end of every task.
- **Work only in a Sandbox worktree.** No installs or builds in `D:/Homebase/Topues Studio/Portfolio/FotoAI-Coach`:
  - the worktree is `git worktree add D:/Homebase/Sandbox/fotoai-coach-refactor -b feat/phase1-foundation docs/refactor-design`;
  - set the pnpm store with `npm_config_store_dir=D:/Homebase/Sandbox/pnpm-store`.
- **Secrets:**
  - never print, log, or commit keys;
  - tests read keys only from environment variables;
  - integration tests refuse any URL that is not `http://127.0.0.1:<port>` or `http://localhost:<port>`.
- **The local Supabase stack is the existing Docker project `fotoai-local`.** Start or stop it with `npx supabase@2.118.0 start` or `npx supabase@2.118.0 stop` from `D:/Homebase/Sandbox/fotoai-local-supabase`. Keys come from `npx supabase@2.118.0 status -o env`.
- **Commits:**
  - Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - one PR into `master` at the end;
  - nothing is committed straight to master.
- Package names: `@fotoai/env`, `@fotoai/contracts`, `@fotoai/db`. Each one has `"type": "module"`, its source in `src/`, its tests in `test/`, and the scripts `typecheck`, `lint`, and `test`.

## Review Focus

1. **Integration tests that skip silently in CI.** When the database variables are missing, a skip looks like a pass. With `FOTOAI_REQUIRE_DB_TESTS=1` set (CI sets it), a missing variable must fail the run. (Task 3, test `fails instead of skipping when FOTOAI_REQUIRE_DB_TESTS=1`.)
2. **Tests pointed at production.** A copied `.env` could aim the integration tests at `https://supabase.techiesandbox.com`. The guard must throw before any request is sent. (Task 3, test `refuses a non-local Supabase URL`.)
3. **Env errors that leak values.** A wrong `FOTOAI_SUPABASE_URL` that contains a key must not show up in the thrown message. The message names variables only. (Task 1, test `error message names variables but never values`.)
4. **Migration copies drifting from the live ones on Windows.** A CRLF checkout must not report a false mismatch, and a real edit must be caught. (Task 3, test `root migration copies match nextjs_space byte-for-byte after newline normalisation`.)
5. **Generated types or the Drizzle baseline drifting from the real schema.** CI regenerates both against the migrated local database and fails on any diff. (Task 4, test `drizzle pull output matches the committed baseline`; Task 5, CI step `types are up to date`.)

---

### Task 1: Workspace skeleton and `@fotoai/env`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `pnpm-lock.yaml` (generated)
- Create: `packages/env/package.json`, `packages/env/tsconfig.json`, `packages/env/vitest.config.ts`, `packages/env/src/server.ts`, `packages/env/src/index.ts`
- Modify: `.gitignore` (add `node_modules/`, `.turbo/`, `coverage/`, `dist/` at the root level), `.env.example` (root: add the FOTOAI section)
- Test: `packages/env/test/server.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createServerEnv(source?: Record<string, string | undefined>): ServerEnv` from `@fotoai/env`. The default `source` is `process.env`.
  - `interface ServerEnv { FOTOAI_SUPABASE_URL: string; FOTOAI_SUPABASE_ANON_KEY: string; FOTOAI_SUPABASE_SERVICE_ROLE_KEY: string; FOTOAI_COOKIE_SECURE: boolean; NODE_ENV: 'development' | 'test' | 'production' }`.
  - The root scripts `pnpm typecheck`, `pnpm lint` and `pnpm test`, which run `turbo run <task>`.

- [ ] **Step 1: Create the worktree and the skeleton.**
  - `pnpm-workspace.yaml` lists `apps/*`, `packages/*` and `services/*`.
  - `turbo.json` defines the tasks `typecheck`, `lint` and `test`, with `test` depending on `^typecheck`.
  - `tsconfig.base.json` sets `strict`, `module` and `moduleResolution: "NodeNext"`, `target: "ES2022"`, `noUncheckedIndexedAccess: true`, and `verbatimModuleSyntax: true`.
  - `eslint.config.mjs` is a flat config with typescript-eslint recommended, applied to `packages/**` and `apps/**` only (`ignores: ["nextjs_space/**"]`).

- [ ] **Step 2: Write the failing tests in `packages/env/test/server.test.ts`.**

```ts
const ok = { FOTOAI_SUPABASE_URL: 'https://db.example.com', FOTOAI_SUPABASE_ANON_KEY: 'anon', FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc', NODE_ENV: 'production' };

test('throws listing all missing required variables', () => {
  expect(() => createServerEnv({ NODE_ENV: 'production' })).toThrow(/FOTOAI_SUPABASE_URL.*FOTOAI_SUPABASE_ANON_KEY.*FOTOAI_SUPABASE_SERVICE_ROLE_KEY/s);
});
test('strips trailing slashes and trims whitespace', () => {
  const env = createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: '  https://db.example.com//  ' });
  expect(env.FOTOAI_SUPABASE_URL).toBe('https://db.example.com');
});
test('rejects a non-http(s) URL', () => {
  expect(() => createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: 'ftp://db.example.com' })).toThrow(/FOTOAI_SUPABASE_URL/);
});
test('cookie Secure defaults to true in production and false in development', () => {
  expect(createServerEnv(ok).FOTOAI_COOKIE_SECURE).toBe(true);
  expect(createServerEnv({ ...ok, NODE_ENV: 'development' }).FOTOAI_COOKIE_SECURE).toBe(false);
  expect(createServerEnv({ ...ok, FOTOAI_COOKIE_SECURE: 'false' }).FOTOAI_COOKIE_SECURE).toBe(false);
});
test('treats empty strings as missing', () => {
  expect(() => createServerEnv({ ...ok, FOTOAI_SUPABASE_ANON_KEY: '' })).toThrow(/FOTOAI_SUPABASE_ANON_KEY/);
});
test('error message names variables but never values', () => {
  let message = '';
  try { createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: 'sk-live-SECRET123' }); } catch (e) { message = String(e); }
  expect(message).toMatch(/FOTOAI_SUPABASE_URL/);
  expect(message).not.toContain('sk-live-SECRET123');
});
```

- [ ] **Step 3: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/env test`
  - Expected: FAIL, because `createServerEnv` is not defined.

- [ ] **Step 4: Implement `createServerEnv` in `packages/env/src/server.ts`.**
  - Use `createEnv` from `@t3-oss/env-core` with `runtimeEnv: source` and `emptyStringAsUndefined: true`.
  - Pass an `onValidationError` that throws `new Error('FotoAI env invalid: ' + <issue paths joined by ', '>)`, built from the issue paths only.
  - The URL is checked with zod `.url()` plus a `/^https?:\/\//` refine. It is trimmed, and trailing slashes are removed.
  - `FOTOAI_COOKIE_SECURE`: when unset, it is `NODE_ENV === 'production'`; otherwise it is `=== 'true'`. This matches `nextjs_space/lib/fotoai/env.ts`.
  - Re-export from `src/index.ts`.
  - Add the five names (no values) to the root `.env.example`.

- [ ] **Step 5: Run the checks and confirm they pass.**
  - Run: `pnpm install && pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass, with 6 tests in `@fotoai/env`.
  - Run: `git diff --stat origin/master -- nextjs_space`
  - Expected: no output.

- [ ] **Step 6: Commit.**
  - `git add` the files above.
  - `git commit -m "feat(workspace): pnpm + turborepo skeleton and @fotoai/env"`

---

### Task 2: `@fotoai/contracts` error envelope

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/vitest.config.ts`, `packages/contracts/src/errors.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/errors.test.ts`

**Interfaces:**
- Consumes: nothing (zod only).
- Produces, from `@fotoai/contracts`:
  - `ERROR_CODES = ['validation','unauthenticated','forbidden','not_found','rate_limited','config','upstream','internal'] as const`;
  - `type ErrorCode = (typeof ERROR_CODES)[number]`;
  - `ApiErrorBody = z.object({ error: z.string().min(1), code: z.enum(ERROR_CODES) })`. This is the same JSON shape the live app already returns (`nextjs_space/lib/fotoai/handlers/shared.ts:42-50`), so one client parses the old and the new APIs.
  - `HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>>`;
  - `parseApiError(status: number, body: unknown): { code: ErrorCode; message: string }`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('status map matches the live app error classes', () => {
  expect(HTTP_STATUS_BY_CODE).toEqual({ validation: 400, unauthenticated: 401, forbidden: 403, not_found: 404, rate_limited: 429, config: 500, upstream: 502, internal: 500 });
});
test('parses a live-app error body', () => {
  expect(parseApiError(429, { error: 'Slow down', code: 'rate_limited' })).toEqual({ code: 'rate_limited', message: 'Slow down' });
});
test('falls back to the HTTP status when the body is not an error envelope', () => {
  expect(parseApiError(401, '<html>')).toEqual({ code: 'unauthenticated', message: 'Request failed (status 401)' });
  expect(parseApiError(418, null)).toEqual({ code: 'internal', message: 'Request failed (status 418)' });
});
test('an unknown code in the body falls back to the status', () => {
  expect(parseApiError(404, { error: 'x', code: 'teapot' }).code).toBe('not_found');
});
```

- [ ] **Step 2: Run and confirm they fail.**
  - Run: `pnpm --filter @fotoai/contracts test`
  - Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement the module in `packages/contracts/src/errors.ts`.**
  - The status fallback picks the first code in `ERROR_CODES` whose status equals `status`.
  - Any status with no match gives `internal`.

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(contracts): shared API error envelope"`

---

### Task 3: Root Supabase project and the `@fotoai/db` clients

**Files:**
- Create: `supabase/config.toml`, a copy of `nextjs_space/tests/e2e/supabase/config.toml` (`project_id = "fotoai-local"`).
- Create: three migrations under `supabase/migrations/`, each a byte copy of the matching file in `nextjs_space/supabase/migrations/fotoai/`:

  | New file | Copied from |
  |---|---|
  | `20261017000001_fotoai_schema.sql` | `0001_fotoai_schema.sql` |
  | `20261017000002_fotoai_rls.sql` | `0002_fotoai_rls.sql` |
  | `20261017000003_fotoai_storage.sql` | `0003_fotoai_storage.sql` |

- Create: `packages/db/package.json` (exports `"."` and `"./service"`), `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`, `packages/db/vitest.integration.config.ts`, `packages/db/src/types.gen.ts` (generated), `packages/db/src/user-client.ts`, `packages/db/src/service-client.ts`, `packages/db/src/index.ts`, `packages/db/test/support/local-db.ts`
- Modify: `eslint.config.mjs`. Add `no-restricted-imports` for `@fotoai/db/service` everywhere except `packages/db/**` and `**/src/privileged/**`. The `privileged/` folders are where phase 2 puts the guarded per-user helpers (spec section 3).
- Test: `packages/db/test/migration-copies.test.ts`, `packages/db/test/clients.test.ts`, `packages/db/test/lint-guard.test.ts`, `packages/db/test/rls.integration.test.ts`

**Interfaces:**
- Consumes: `ServerEnv` from `@fotoai/env` (Task 1).
- Produces:
  - `type Database` from `@fotoai/db` (generated).
  - `createUserClient(env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_ANON_KEY'>, accessToken: string, options?: { fetch?: typeof fetch }): SupabaseClient<Database>` from `@fotoai/db`.
  - `createServiceClient(env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>): ServiceClient` from `@fotoai/db/service`.
  - `type ServiceClient = SupabaseClient<Database> & { readonly __service: true }`.
  - `localDbFromEnv(): { url: string; anonKey: string; serviceRoleKey: string } | null` from `packages/db/test/support/local-db.ts`. It reads `FOTOAI_TEST_SUPABASE_URL`, `FOTOAI_TEST_SUPABASE_ANON_KEY` and `FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY`.
  - Package scripts: `db:types` (`supabase gen types typescript --local --schema public > src/types.gen.ts`), `test`, and `test:integration`.

- [ ] **Step 1: Write the failing unit tests.**

```ts
// migration-copies.test.ts
test('root migration copies match nextjs_space byte-for-byte after newline normalisation', () => {
  for (const [root, legacy] of PAIRS) expect(norm(read(root))).toBe(norm(read(legacy))); // norm = s.replace(/\r\n/g, '\n')
});
// clients.test.ts
test('user client sends the anon key as apikey and the user token as bearer', async () => {
  const seen: Headers[] = [];
  const client = createUserClient(env, 'user-token', { fetch: async (_u, init) => { seen.push(new Headers(init?.headers)); return new Response('[]', { status: 200 }); } });
  await client.from('fotoai_user_gear').select('id');
  expect(seen[0]!.get('apikey')).toBe('anon');
  expect(seen[0]!.get('authorization')).toBe('Bearer user-token');
});
test('user client rejects an empty token', () => {
  expect(() => createUserClient(env, '')).toThrow(/access token/);
});
test('user client never persists or refreshes a session', () => { /* assert auth options persistSession=false, autoRefreshToken=false via a spy on createClient */ });
// lint-guard.test.ts
test('importing @fotoai/db/service outside privileged/ fails lint', async () => {
  const results = await new ESLint({ cwd: repoRoot }).lintText("import { createServiceClient } from '@fotoai/db/service';", { filePath: 'packages/core/src/challenges.ts' });
  expect(results[0]!.messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
});
test('importing @fotoai/db/service inside privileged/ passes lint', async () => { /* same text, filePath 'packages/core/src/privileged/xp.ts' → no no-restricted-imports message */ });
```

  - `createUserClient` takes an optional third argument, `options?: { fetch?: typeof fetch }`, so the tests can inject a fetch. Production code never passes it.

- [ ] **Step 2: Write the failing integration tests in `rls.integration.test.ts`.**

```ts
test('refuses a non-local Supabase URL', () => {
  expect(() => assertLocal('https://supabase.techiesandbox.com')).toThrow(/local/);
});
test('fails instead of skipping when FOTOAI_REQUIRE_DB_TESTS=1', () => {
  expect(() => resolveDb({ FOTOAI_REQUIRE_DB_TESTS: '1' })).toThrow(/FOTOAI_TEST_SUPABASE_URL/);
});
describe.skipIf(!db)('RLS on fotoai_user_gear', () => {
  test('a user sees and edits only their own gear', async () => {
    // service.auth.admin.createUser for A and B: email `rls-<uuid>@localhost.test`, a random password made in the test, email_confirm: true
    // sign in each with an anon client to get access tokens; insert one gear row each via createUserClient
    //   ({ category: 'camera', brand: 'Nikon', model: 'FE2' })
    // A selects all gear → exactly A's 1 row; A updates B's row by id → 0 rows changed
  });
  test('the service client sees both users\' rows', async () => { /* select by both user ids → 2 rows */ });
  afterAll(async () => { /* service.auth.admin.deleteUser for A and B (rows cascade) */ });
});
```

  - `assertLocal(url: string): void` and `resolveDb(source): {...} | null` live in `test/support/local-db.ts`.
  - `localDbFromEnv()` calls both, with `process.env` as the source.

- [ ] **Step 3: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/db test`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Copy `config.toml` and the three migrations, then generate `src/types.gen.ts`.**
  - With the `fotoai-local` stack running, run `pnpm --filter @fotoai/db db:types` from the worktree root. The CLI reads the root `supabase/` folder.
  - Check that `Database['public']['Tables']` contains `fotoai_user_gear`.

- [ ] **Step 5: Implement `createUserClient` and `createServiceClient`, plus the ESLint rule.**
  - `createUserClient` calls `createClient<Database>(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token }, fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`.
  - `createServiceClient` uses the same auth options and casts the result to `ServiceClient`.

- [ ] **Step 6: Run the unit and integration tests and confirm they pass.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass.
  - Run the integration suite against the local stack:
    1. Export `FOTOAI_TEST_SUPABASE_URL`, `FOTOAI_TEST_SUPABASE_ANON_KEY` and `FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY` from `npx supabase@2.118.0 status -o env`. Use env only, never a file.
    2. Run `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration`.
    3. Expected: 4 passed, 0 skipped. The config `vitest.integration.config.ts` includes `test/**/*.integration.test.ts` only.

- [ ] **Step 7: Commit.**
  - `git commit -m "feat(db): supabase-js user and service clients, generated types, root local Supabase project"`

---

### Task 4: Drizzle baseline of the existing schema

**Files:**
- Create: `packages/db/drizzle.config.ts`
  - `dialect: 'postgresql'`;
  - `schema: './src/schema/schema.ts'`;
  - `out: './drizzle'`;
  - `schemaFilter: ['public']`;
  - `tablesFilter: ['fotoai_*']`;
  - `dbCredentials.url` from `FOTOAI_TEST_DATABASE_URL`, local-only guard as in Task 3.
- Create: `packages/db/src/schema/schema.ts`, `packages/db/src/schema/relations.ts` (from `drizzle-kit pull`), and `packages/db/drizzle/0000_baseline.sql` plus `packages/db/drizzle/meta/*` (the pull output).
- Modify: `packages/db/package.json` (scripts `db:pull` and `db:generate`; export `./schema`).
- Test: `packages/db/test/drizzle-baseline.integration.test.ts`

**Interfaces:**
- Consumes: the local Postgres at `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (the `fotoai-local` default), passed in `FOTOAI_TEST_DATABASE_URL`.
- Produces:
  - `@fotoai/db/schema`, which exports the Drizzle table objects (for example `fotoaiUserGear`, `fotoaiDailyChallenges`). Phase 2 extends it, and `drizzle-kit generate` makes new migrations from it.
  - `drizzle/meta` is the snapshot baseline that future `generate` runs compare against.

- [ ] **Step 1: Write the failing test.**

```ts
test('drizzle pull output matches the committed baseline', async () => {
  const out = await mkdtemp(join(tmpdir(), 'drizzle-pull-'));
  execFileSync('pnpm', ['exec', 'drizzle-kit', 'pull', '--config', 'drizzle.config.ts', '--out', out], { cwd: pkgRoot, env: process.env });
  expect(norm(read(join(out, 'schema.ts')))).toBe(norm(read('src/schema/schema.ts')));
  expect(norm(read(join(out, 'relations.ts')))).toBe(norm(read('src/schema/relations.ts')));
});
```

  - The test uses the same skip and require logic as Task 3, keyed on `FOTOAI_TEST_DATABASE_URL`.

- [ ] **Step 2: Run it and confirm it fails.**
  - Keep the Task 3 `FOTOAI_TEST_SUPABASE_*` variables exported.
  - Run: `FOTOAI_REQUIRE_DB_TESTS=1 FOTOAI_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm --filter @fotoai/db test:integration`
  - Expected: FAIL, because `src/schema/schema.ts` does not exist.

- [ ] **Step 3: Run `pnpm --filter @fotoai/db db:pull`.**
  1. Move `schema.ts` and `relations.ts` into `src/schema/`.
  2. Keep the generated `0000_*.sql`, renamed to `drizzle/0000_baseline.sql`, and put this first line at its top: `-- Baseline only. Already applied by supabase/migrations/2026101700000{1,2,3}. Never apply this file.`
  3. Keep `drizzle/meta/` as generated.
  4. Do not edit the pulled code by hand. Formatting must stay identical to what `pull` emits, so add `src/schema/**` to the ESLint and Prettier ignores.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run the integration command from Step 2. Expected: 5 passed, 0 skipped.
  - Run `pnpm --filter @fotoai/db exec drizzle-kit generate --name drift-check`. Expected: "No schema changes, nothing to migrate". No new file is written.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(db): drizzle baseline of the existing fotoai schema"`

---

### Task 5: CI for the workspace, docs, and the PR

**Files:**
- Modify: `.github/workflows/ci.yml`. Keep the `verify` job byte-for-byte. Add a job `workspace` (`runs-on: ubuntu-latest`, Node 22) with these steps:
  1. `pnpm/action-setup` (reads `packageManager`).
  2. `actions/setup-node` with `cache: pnpm`.
  3. `pnpm install --frozen-lockfile`.
  4. `pnpm typecheck && pnpm lint && pnpm test`.
  5. `supabase/setup-cli` with `version: 2.118.0`.
  6. `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor`.
  7. Export `FOTOAI_TEST_SUPABASE_URL`, `FOTOAI_TEST_SUPABASE_ANON_KEY`, `FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY` and `FOTOAI_TEST_DATABASE_URL` from `supabase status -o env` into `$GITHUB_ENV`. These are local CI keys, but still never echo them.
  8. `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration`.
  9. A step named `types are up to date`: run `pnpm --filter @fotoai/db db:types`, then `git diff --exit-code packages/db/src/types.gen.ts`.
- Modify: `README.md` (root). Add a "Workspace (refactor)" section with the layout, the Sandbox worktree rule, and the commands from this plan.
- Modify: `docs/testing-e2e.md`. In the one-time setup, copy the root `supabase/` folder instead of the three `nextjs_space` migration files.
- Test: the CI run on the PR.

**Interfaces:**
- Consumes: the scripts from Tasks 1–4.
- Produces: a required-ready `workspace` CI job that phase 2 extends.

- [ ] **Step 1: Add the job and the docs, and validate the workflow locally.**
  - Run: `npx --yes actionlint@1 .github/workflows/ci.yml` (cache in the Sandbox).
  - Expected: no findings.

- [ ] **Step 2: Run the full local gate.**
  - Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test`, then both integration commands.
  - Expected: all pass, 0 skipped.
  - Run: `git diff --stat origin/master -- nextjs_space`. Expected: no output.

- [ ] **Step 3: Commit and push.**
  - `git commit -m "ci: workspace job with lint, typecheck, unit and real-Postgres tests"`
  - `git push -u origin feat/phase1-foundation`

- [ ] **Step 4: Open the PR into `master` and check CI.**
  - The PR body lists what was built and what was tested, and states that `nextjs_space/` is unchanged, so no deploy is needed.
  - Expected: both the `verify` job and the `workspace` job are green.
  - Report the result to Seun. Merging needs Seun's yes, as for every PR.
