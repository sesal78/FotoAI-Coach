# FotoAI Refactor Phase 2 (Core Services) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server side of the new loop: real places, light and weather, gear-aware shoot plans, film rolls and frames, and the fixed challenge model. It is all served as `/api/v2/*` from the live app, so the Android app (phase 3) talks to real data.

**Architecture:**
- Phase 2 has five sub-phases. They ship as separate PRs, in this order, because each later one depends on the one before it.
- **2A** brings the live app (`nextjs_space/`) into the pnpm workspace. It builds the app's Docker image from the repo root, and creates `@fotoai/api` with the v2 request pipeline (auth by bearer token or cookie, the `{ error, code }` envelope) and a first endpoint.
- **2B–2E** add the data and features on that base. They are framework-free handlers in `packages/*`, mounted as thin route files in `nextjs_space/app/api/v2/**`.
- **2A is fully specified below.** 2B–2E are specified to the task and interface level. Each one is expanded into step-level TDD tasks (a ledger addendum to this file) right before it starts, against the code that 2A actually ships.

**Tech Stack:**
- Phase 1 stack: pnpm 10.26.2, Turborepo 2, TypeScript, Vitest, zod 3, supabase-js 2, Drizzle;
- the live app: Next.js 14.2, Node test runner;
- new in Phase 2: suncalc (or equal), a timezone-from-coordinates library, Google Places API (New), Open-Meteo plus MET Norway, the Vercel AI SDK with the OpenAI provider, and Langfuse (optional).

**Spec:** `docs/superpowers/specs/2026-10-18-fotoai-refactor-design.md` (sections 2, 3, 5.2–5.9, 5.11, 5.12, 6, 10 phase 2). Phase map: `docs/superpowers/plans/2026-10-18-fotoai-refactor-index.md`. Phase 1 decisions: `docs/superpowers/plans/2026-10-18-fotoai-phase1-foundation.md`.

## Global Constraints

- **Node and package manager:** Node `>=22.18`; pnpm `10.26.2`. zod stays on major 3.
- **Local workspace rules:**
  - work only in a Sandbox worktree;
  - set `npm_config_store_dir=D:/Homebase/Sandbox/pnpm-store` and `TURBO_CACHE_DIR=D:/Homebase/Sandbox/turbo-cache`. Without the second one, turbo writes `.turbo/` into the canonical repo folder (found 18 Oct 2026).
- **Data access:**
  - **Session-only identity.** The server never trusts a user id from the request. Every v2 handler rejects `userId`, `user_id`, `userid`, `ownerId` and `owner_id` in the query and the body with 400.
  - Owner-scoped data goes through `createUserClient` (RLS applies).
  - The service role is used only from `src/privileged/` files (lint-enforced in `packages/**`). In `nextjs_space/` the rule applies by review.
- **Errors and secrets:**
  - Every error response is `ApiErrorBody` (`{ error, code }`) from `@fotoai/contracts`, with `HTTP_STATUS_BY_CODE`.
  - Secrets: never print, log or commit keys. Env is read lazily (never at module load), so `next build` works with no secrets.
- **The live app must keep working.**
  - All existing `nextjs_space` tests pass (`test:fotoai`, 304 or more), and so does `next build`.
  - Its routes and JSON shapes do not change, except the challenge-sync overwrite fix in 2B, which the spec requires.
- **Production changes need Seun's yes, each one at the time it happens.** These are:
  - every migration (applied by hand with `psql`, after a run on the local stack);
  - every Dokploy setting change;
  - every deploy (followed by the smoke test).
- **Migrations:**
  - new migrations go only in the root `supabase/migrations/`, named `2026MMDDhhmmss_<topic>.sql`;
  - they add to the schema: no `DROP TABLE` or `DROP COLUMN`;
  - `DROP CONSTRAINT` is allowed only to replace a CHECK constraint, in the same transaction;
  - `nextjs_space/supabase/migrations/fotoai/` stays frozen at 0001–0003.
- **Places and units:**
  - Places: the AI never invents a place, and stores only `place_id`, coordinates and user notes from Google (spec section 3).
  - Units: metric everywhere new. Times are in the place's timezone.
- **Commits:** Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; one PR per sub-phase into `master`. Merging needs Seun's yes.

## Review Focus

1. **Legacy tests that silently stop running after the workspace move.** If turbo cannot see a `test` script for `nextjs_space`, CI goes green while the 304 tests never run. (2A Task 1, test `turbo runs the legacy app's typecheck and test tasks`.)
2. **The production image starts but cannot serve its own assets.** Standalone output in a monorepo moves `server.js`, `.next/static` and `public`; a wrong copy path gives a 200 page with 404 CSS and JS. (2A Task 2, container smoke `serves a page and one of its own static assets`.)
3. **A v2 route reads env at import time and breaks `next build` without secrets.** CI builds with no `FOTOAI_*` variables. (2A Task 3, test `importing a v2 route module does not read env or build deps`.)
4. **Malformed bearer tokens.** Cases like `Bearer ` (empty), lowercase `bearer`, a header and a cookie both present, a token with whitespace or over 8192 characters, and a token for a deleted user must all give 401, never a 500 or a wrong user. (2A Task 4, tests `rejects malformed Authorization headers` and `prefers the bearer token over the cookie`.)
5. **An offline-queued write retried after it already succeeded.** The phone resends a frame or a step change with the same client id. It must not double-count, double-award XP, or 409 the queue to a stop. (2E Task 4, test `replaying the same client id is a no-op that returns the stored record`.)

---

## Sub-phase 2A — Live app in the workspace, and the v2 foundation (fully specified)

### Task 1: Bring `nextjs_space/` into the pnpm workspace

**Files:**
- Modify: `pnpm-workspace.yaml` (add `nextjs_space`).
- Modify: `nextjs_space/package.json`:
  - `"name": "@fotoai/legacy-web"`;
  - `"typecheck": "tsc --noEmit"`;
  - `"test": "node tests/fotoai/run.mjs"`;
  - keep `test:fotoai` as an alias;
  - remove nothing else;
  - `typescript` → `^5.9.0`.
- Delete: `nextjs_space/package-lock.json` (the root `pnpm-lock.yaml` replaces it).
- Modify: `.github/workflows/ci.yml`. The `verify` job becomes:
  1. root `pnpm install --frozen-lockfile`;
  2. `pnpm --filter @fotoai/legacy-web typecheck`;
  3. `pnpm --filter @fotoai/legacy-web test`;
  4. `pnpm --filter @fotoai/legacy-web build`.

  The job keeps its name.
- Modify: `packages/db/test/workspace-config.test.ts`.
- Modify: `README.md`. Add `TURBO_CACHE_DIR` to the Sandbox commands.

**Interfaces:**
- Consumes: the phase 1 workspace.
- Produces: the workspace package `@fotoai/legacy-web` with the `typecheck` and `test` scripts. Later tasks add `@fotoai/*` dependencies to it.

- [ ] **Step 1: Write the failing test** in `packages/db/test/workspace-config.test.ts`.

```ts
test("turbo runs the legacy app's typecheck and test tasks", () => {
  const dry = JSON.parse(turboDry(['typecheck', 'test'])); // same execFileSync helper as the existing test
  const ids = dry.tasks.map((t: { taskId: string }) => t.taskId);
  expect(ids).toEqual(expect.arrayContaining(['@fotoai/legacy-web#typecheck', '@fotoai/legacy-web#test']));
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `pnpm --filter @fotoai/db test -- workspace-config`
  - Expected: FAIL, because `@fotoai/legacy-web` is not in the task list.

- [ ] **Step 3: Make the workspace changes listed above.** Then run `pnpm install` from the root.

- [ ] **Step 4: Fix any import that npm's hoisting used to hide.** Add each missing package to `nextjs_space/package.json` at the version npm had resolved, so pnpm's strict `node_modules` finds it. Fix any TS 5.9 type errors with the smallest change.
  - Run: `pnpm --filter @fotoai/legacy-web typecheck && pnpm --filter @fotoai/legacy-web test && pnpm --filter @fotoai/legacy-web build`
  - Expected: no type errors; `# pass` is 304 or more with `# fail 0`; the build completes.

- [ ] **Step 5: Run the full gate and confirm it passes.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass, including the new turbo test.

- [ ] **Step 6: Commit.**
  - `git commit -m "build: bring the live app into the pnpm workspace as @fotoai/legacy-web"`

### Task 2: Build the live app's image from the repo root

**Files:**
- Modify: `nextjs_space/next.config.js`. Add `experimental.outputFileTracingRoot: path.join(__dirname, '..')`. Leave the rest unchanged.
- Modify: `nextjs_space/Dockerfile`. The build context is the repo root. Stages:
  - **deps:** `corepack enable`, then copy `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, every workspace `package.json`, and `packages/`. Then run `pnpm install --frozen-lockfile --filter @fotoai/legacy-web...`.
  - **builder:** `pnpm --filter @fotoai/legacy-web build`, with `NEXT_OUTPUT_MODE=standalone`.
  - **runner:** copy `nextjs_space/.next/standalone ./`, `nextjs_space/.next/static ./nextjs_space/.next/static` and `nextjs_space/public ./nextjs_space/public`. Then `CMD ["node", "nextjs_space/server.js"]`.
  - Keep: Node 22 alpine, the non-root user, port 3000, and no secret build args.
- Create: `.dockerignore` at the repo root, listing:
  - `**/node_modules`, `.git`, `.turbo`, `**/.next`;
  - `.superpowers`, `.planning`, `.hermes`, `.claude`;
  - `docs`, `*.pdf`, `coverage`;
  - `supabase/.temp`, `**/.env`, `**/.env.*` (keep `!**/.env.example`).
- Modify: `nextjs_space/deploy.sh` and `nextjs_space/docker-compose.yml` to the new context and Dockerfile path. They are legacy self-host scripts; keep them working.
- Modify: `.github/workflows/ci.yml`. Add a job `image` that builds the image, starts it, and runs `scripts/smoke-image.sh`. It does not push.
- Create: `scripts/smoke-image.sh`.

**Interfaces:**
- Consumes: Task 1's workspace package.
- Produces: an image built by `docker build -f nextjs_space/Dockerfile .`. Task 5 points Dokploy at it.

- [ ] **Step 1: Write the failing smoke script `scripts/smoke-image.sh`.** Its argument is a base URL. It asserts:
  1. `GET /` returns 200.
  2. The first `/_next/static/...` asset referenced in that page returns 200 with a JS or CSS content type.
  3. `GET /api/health` returns JSON with a `status` key. With dummy env this is `unhealthy`; the check is that the server answers, not that Supabase is reachable.

  It prints `serves a page and one of its own static assets: ok` on success, and exits non-zero otherwise.

- [ ] **Step 2: Run it against an image built from the old Dockerfile with the new context. Confirm it fails.**
  - Run: `docker build -f nextjs_space/Dockerfile -t fotoai-web:check . ; docker run -d --rm -p 3011:3000 -e FOTOAI_SUPABASE_URL=http://127.0.0.1:1 -e FOTOAI_SUPABASE_ANON_KEY=x -e FOTOAI_SUPABASE_SERVICE_ROLE_KEY=x --name fotoai-check fotoai-web:check ; bash scripts/smoke-image.sh http://localhost:3011`
  - Expected: the build or the smoke check FAILS, because the old Dockerfile expects a `nextjs_space` context.

- [ ] **Step 3: Rewrite the Dockerfile and `next.config.js` as above, and add `.dockerignore`.**

- [ ] **Step 4: Rebuild, rerun, and confirm it passes.**
  - Run: the same commands as Step 2.
  - Expected: `serves a page and one of its own static assets: ok`.
  - Then run `docker stop fotoai-check`.
  - Add the `image` CI job.

- [ ] **Step 5: Commit.**
  - `git commit -m "build: live app image from the repo root (standalone in a monorepo)"`

### Task 3: `@fotoai/api` package and `transpilePackages`

**Files:**
- Create: `packages/api/package.json` (`@fotoai/api`; exports `.` → `./src/index.ts`), `packages/api/tsconfig.json`, `packages/api/vitest.config.ts`, `packages/api/src/index.ts`, `packages/api/src/handler.ts`.
- Modify: `nextjs_space/package.json`. Add the dependencies `@fotoai/api`, `@fotoai/contracts`, `@fotoai/db` and `@fotoai/env`, all `workspace:*`.
- Modify: `nextjs_space/next.config.js`. Set `transpilePackages: ['@fotoai/api', '@fotoai/contracts', '@fotoai/db', '@fotoai/env']`.
- Create: `nextjs_space/app/api/v2/health/route.ts`.
- Test: `packages/api/test/handler.test.ts`, `nextjs_space/tests/fotoai/v2-routes.test.ts`.

**Interfaces:**
- Consumes:
  - `ApiErrorBody`, `HTTP_STATUS_BY_CODE` and `ErrorCode` from `@fotoai/contracts`;
  - `createServerEnv` and `ServerEnv` from `@fotoai/env`.
- Produces, from `@fotoai/api`:
  - `class ApiError extends Error { constructor(code: ErrorCode, message: string) }`, with `readonly code: ErrorCode` and `get status(): number`;
  - `type V2Deps = { env: ServerEnv; now: () => Date }`. Task 4 adds `verifyToken`;
  - `type V2DepsProvider = () => V2Deps`;
  - `defineV2Handler(provider: V2DepsProvider, body: (request: Request, deps: V2Deps, ctx: { params: Record<string, string> }) => Promise<Response>): (request: Request, ctx?: { params?: Record<string, string> | Promise<Record<string, string>> }) => Promise<Response>`.
    - It calls `provider()` lazily, on the first request.
    - An `ApiError` becomes its envelope and status. Anything else is logged, by message only, and becomes 500 `{ error: 'Internal error', code: 'internal' }`.
  - `json(body: unknown, init?: { status?: number }): Response`;
  - `defaultV2Deps: V2DepsProvider`, which memoises `createServerEnv()` on first use. Task 4 adds the verifier.
  - The route file pattern is: `export const GET = defineV2Handler(defaultV2Deps, async () => json({ status: 'ok', api: 'v2' }))`.

- [ ] **Step 1: Write the failing tests.**

```ts
// packages/api/test/handler.test.ts
test('importing a v2 route module does not read env or build deps', async () => {
  let built = 0;
  const handler = defineV2Handler(() => { built++; return fakeDeps; }, async () => json({ ok: true }));
  expect(built).toBe(0);
  await handler(new Request('http://x/api/v2/health'));
  expect(built).toBe(1);
});
test('an ApiError becomes its envelope and status', async () => {
  const res = await defineV2Handler(() => fakeDeps, async () => { throw new ApiError('not_found', 'No such plan'); })(new Request('http://x'));
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'No such plan', code: 'not_found' });
});
test('an unknown error is a 500 internal envelope without the message', async () => {
  const res = await defineV2Handler(() => fakeDeps, async () => { throw new Error('db password=hunter2'); })(new Request('http://x'));
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain('hunter2');
});
```

  - In `nextjs_space/tests/fotoai/v2-routes.test.ts` (node:test): `GET` from `app/api/v2/health/route.ts` returns 200 `{ status: 'ok', api: 'v2' }`. This proves the live app's test runner loads `@fotoai/*` through the workspace symlinks with type stripping.

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/api test` and `pnpm --filter @fotoai/legacy-web test`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement the package, the route, the new dependencies and `transpilePackages`.**

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @fotoai/legacy-web build`
  - Expected: all pass. The build runs with no `FOTOAI_*` env set.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(api): v2 handler pipeline and /api/v2/health in the live app"`

### Task 4: v2 authentication (bearer token or cookie) and `GET /api/v2/me`

**Files:**
- Create: `packages/db/src/verify-token.ts`; export it from `packages/db/src/index.ts`.
- Create: `packages/api/src/auth.ts`.
- Create: `nextjs_space/app/api/v2/me/route.ts`.
- Test: `packages/api/test/auth.test.ts`, `packages/db/test/verify-token.integration.test.ts`.

**Interfaces:**
- Consumes: `defineV2Handler`, `V2Deps` and `defaultV2Deps` (Task 3); `NO_SESSION_AUTH` (`@fotoai/db`).
- Produces:
  - `type TokenVerifier = (token: string) => Promise<{ userId: string; email: string | null } | null>`, exported from `@fotoai/db`. The dependency direction is api → db, never db → api.
  - `V2Deps` gains `verifyToken: TokenVerifier`. `defaultV2Deps` memoises `createTokenVerifier(env)` beside the env.
  - `createTokenVerifier(env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_ANON_KEY'>): TokenVerifier` (`@fotoai/db`). It uses the anon client's `auth.getUser(token)`; an unknown or expired token gives `null`.
  - `interface Principal { userId: string; email: string | null; accessToken: string }`.
  - `requirePrincipal(request: Request, deps: V2Deps): Promise<Principal>` (`@fotoai/api`).
    - The token comes from `Authorization: Bearer <token>` first (case-insensitive scheme), else from the `fotoai_session` cookie. The cookie name is copied from `nextjs_space/lib/fotoai/session-cookie.ts`.
    - It rejects with `ApiError('unauthenticated', ...)` when: there is no token; the token is empty, contains whitespace or is over 8192 characters; the verifier returns `null`; or the user id is not a UUID.
    - It lowercases `userId`.
  - `rejectBrowserIdentity(input: URLSearchParams | Record<string, unknown> | null | undefined): void`. It throws `ApiError('validation', ...)` for any of `userId`, `user_id`, `userid`, `ownerId`, `owner_id`.
  - `GET /api/v2/me` returns `{ userId, email }`.
  - The cookie path does no session refresh, because the web keeps using `/api/fotoai/*` until phase 4. This is stated in the code comment.

- [ ] **Step 1: Write the failing unit tests.** Use an injected verifier; the token `good` maps to a fixed UUID.

```ts
test('rejects malformed Authorization headers', async () => {
  for (const header of ['Bearer ', 'Bearer  two words', 'Basic abc', `Bearer ${'x'.repeat(8193)}`]) {
    await expect(requirePrincipal(req({ authorization: header }), deps)).rejects.toMatchObject({ code: 'unauthenticated' });
  }
});
test('accepts a lowercase bearer scheme', async () => {
  expect((await requirePrincipal(req({ authorization: 'bearer good' }), deps)).userId).toBe(USER);
});
test('prefers the bearer token over the cookie', async () => {
  const p = await requirePrincipal(req({ authorization: 'Bearer good', cookie: 'fotoai_session=other' }), deps);
  expect(p.accessToken).toBe('good');
});
test('falls back to the fotoai_session cookie', async () => { /* cookie only → principal */ });
test('a token the verifier rejects is 401', async () => { /* 'expired' → unauthenticated */ });
test('rejects browser-supplied identity', () => {
  expect(() => rejectBrowserIdentity(new URLSearchParams('user_id=abc'))).toThrow(expect.objectContaining({ code: 'validation' }));
});
```

- [ ] **Step 2: Write the failing integration test** (local stack only, with the phase 1 guards).
  - Create a user with the service client and sign them in.
  - `createTokenVerifier(env)(token)` returns their id.
  - After `auth.admin.deleteUser`, the same token gives `null`.
  - A random string gives `null`.

- [ ] **Step 3: Run both and confirm they fail.**
  - Run: `pnpm --filter @fotoai/api test` and `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Implement the auth, the verifier and the route.**

- [ ] **Step 5: Run and confirm they pass.**
  - Run: the full gate plus both integration suites.
  - Expected: all pass, 0 skipped.

- [ ] **Step 6: Commit.**
  - `git commit -m "feat(api): bearer-or-cookie auth and GET /api/v2/me"`

### Task 5: PR, approval, Dokploy switch, deploy and smoke (production)

**Files:** none (operations). Record the result in the ledger.

- [ ] **Step 1: Open the PR and check CI.**
  - Push the branch and open the 2A PR.
  - Expected: `verify`, `workspace` and `image` are all green.
  - Report to Seun.
- [ ] **Step 2: Stop for Seun's yes.** Ask for approval to: merge; change Dokploy app `UwuYPhnwvjoki-Cadpnvx` from `buildPath ./nextjs_space` / `dockerfile Dockerfile` to `buildPath ./` / `dockerfile nextjs_space/Dockerfile`; and deploy. Do nothing until he says yes.
- [ ] **Step 3: Record the rollback values, then switch and deploy.**
  - Record the current Dokploy values and the last good commit `8c388c3` in the ledger. These are the rollback path.
  - Then merge, update Dokploy, and deploy.
- [ ] **Step 4: Run the smoke tests.**
  - Run the existing 14-check smoke list (`96-P4-FLIP-RUNBOOK.md` step 8, as extended on 17 Oct 2026). Add:
    - `GET https://myfoto.topues.com/api/v2/health` → 200 `{"status":"ok","api":"v2"}`;
    - `GET /api/v2/me` with no token → 401 `{"code":"unauthenticated"}`.
  - Expected: all pass, and there are 0 error lines in the app log for 10 minutes.
  - **On any failure:** restore the recorded Dokploy values, redeploy `8c388c3`, and re-run the smoke tests.

---

## Sub-phase 2B — Data model and the challenge fix (step level; expanded 18 Oct 2026 after 2A shipped)

**Ships:**
- the challenge `source` column and the `superseded` status;
- the end of the challenge-sync overwrite;
- a server-side active challenge and challenge list (`/api/v2/challenges*`);
- the `plan_step` XP source;
- theme, units and home-area preferences (`/api/v2/me/preferences`).

**2B decisions (planner's calls, recorded here):**
- **SQL-first migrations.** The migrations are hand-written SQL in the root `supabase/migrations/`, because CHECK replacements and `create or replace function` are not Drizzle-generatable. After each migration, regenerate `types.gen.ts` and re-pull the Drizzle baseline (`db:pull`, then move `schema.ts`/`relations.ts` to `src/schema/` and keep `drizzle/meta`). The phase 1 drift tests keep them honest.
- **Applying migrations locally.** Copy each new migration into `D:/Homebase/Sandbox/fotoai-local-supabase/supabase/migrations/`, then run `npx supabase@2.118.0 migration up` there. Never `db reset`: the stack holds other local test data.
- **Applying migrations to production.** After Seun's yes, pipe the file through `ssh <VPS> docker exec -i <supabase-db container> psql -U postgres -At -v ON_ERROR_STOP=1 -1 -f -`. This is the same path the P3 copy tooling used (`p3-parity/p3_copy.py`). Each migration has a written verify query and a written undo script; undo is run only with Seun's yes.
- **Order on release.** The live code from Task 3 writes the new `source` column, so the Task 2 migration must be applied to production **before** the 2B deploy. Every migration only adds, so the 2A code keeps working against the new schema. That makes rollback a code-only redeploy.
- **Sync never overwrites.** It also does not mark older chat challenges `superseded`, so History keeps them continuable. The `superseded` status exists for later explicit use. The sync endpoint has no caller in the current web UI; chat saves through `chat.ts`. So the change carries little user risk.
- **The home area reuses the existing `home_location` text column as its label.** New columns are only `home_lat` and `home_lng`.

### Task B1: Root migration guard

**Files:**
- Create: `packages/db/test/migration-guard.test.ts`
- Create: `packages/db/test/support/migration-rules.ts`

**Interfaces:**
- Produces: `migrationViolations(sql: string): string[]`. It returns one message per rule broken; an empty list means OK.
  - `DROP TABLE` and `DROP COLUMN` are always banned.
  - `DROP CONSTRAINT <name>` needs an `ADD CONSTRAINT <name>` in the same file.
  - `DROP FUNCTION`, `TRUNCATE` and an unqualified `DELETE FROM` are banned.

- [ ] **Step 1: Write the failing tests.**

```ts
test('new root migrations only add, or replace a CHECK in place', () => {
  for (const file of rootMigrationsAfter('20261017000003')) expect(migrationViolations(read(file)), file).toEqual([]);
});
test('flags destructive statements', () => {
  expect(migrationViolations('alter table t drop column c;')).toHaveLength(1);
  expect(migrationViolations('drop table t;')).toHaveLength(1);
  expect(migrationViolations('alter table t drop constraint t_c_check;')).toEqual(['DROP CONSTRAINT t_c_check without ADD CONSTRAINT t_c_check']);
  expect(migrationViolations('alter table t drop constraint t_c_check; alter table t add constraint t_c_check check (c > 0);')).toEqual([]);
  expect(migrationViolations('truncate t;')).toHaveLength(1);
});
test('ignores SQL comments', () => {
  expect(migrationViolations('-- drop table t;\nselect 1;')).toEqual([]);
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/db test -- migration-guard`
  - Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `migrationViolations`.** Strip `--` and `/* */` comments, then use case-insensitive regexes.

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `pnpm --filter @fotoai/db test`
  - Expected: PASS. No new migrations exist yet, so the first test is vacuous until B2.

- [ ] **Step 5: Commit.**
  - `git commit -m "test(db): guard new root migrations against destructive statements"`

### Task B2: Challenge `source` column and `superseded` status

**Files:**
- Create: `supabase/migrations/20261018100001_challenge_source.sql`
- Create: `supabase/undo/20261018100001_challenge_source.undo.sql` (not applied by tooling)
- Modify: `packages/db/src/types.gen.ts`, `packages/db/src/schema/*`, `packages/db/drizzle/meta/*` (regenerated)
- Test: `packages/db/test/challenges-schema.integration.test.ts`

**Interfaces:**
- Produces:
  - `fotoai_daily_challenges.source text not null default 'dashboard'`, with `fotoai_daily_challenges_source_check (source in ('dashboard','chat','plan','job'))`;
  - `fotoai_daily_challenges_status_check` extended with `'superseded'`.

- [ ] **Step 1: Write the failing integration test.** It uses the local stack and the phase 1 guards.
  - It creates a user, then inserts with the service client a `CHATBOT_GENERATED` row and an `AFTER_WORK` row, without a `source`. Both must succeed, defaulting to `'dashboard'`.
  - It checks that `status: 'superseded'` inserts and `status: 'bogus'` fails with a check violation.
  - It checks that `source: 'nope'` fails.
  - Test names:
    - `challenge source defaults to dashboard and accepts only known sources`
    - `superseded is a valid challenge status; unknown statuses are rejected`

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration -- challenges-schema`
  - Expected: FAIL, because the `source` column does not exist and `superseded` violates the status check.

- [ ] **Step 3: Write the migration.**

```sql
-- 2B: where a challenge came from, and a status for challenges replaced on purpose.
alter table public.fotoai_daily_challenges add column source text not null default 'dashboard';
update public.fotoai_daily_challenges set source = 'chat' where challenge_type = 'CHATBOT_GENERATED';
alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_source_check check (source in ('dashboard', 'chat', 'plan', 'job'));
alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_status_check;
alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_status_check
  check (status in ('pending', 'accepted', 'skipped', 'completed', 'superseded'));
```

  - The undo file drops `fotoai_daily_challenges_source_check` and the column, then restores the 4-value status check. The migration guard skips `supabase/undo/`.
  - Verify query: `select source, count(*) from public.fotoai_daily_challenges group by 1 order by 1;`

- [ ] **Step 4: Apply the migration locally and regenerate.**
  - Copy the migration into the local stack and run `migration up`.
  - Run `pnpm --filter @fotoai/db db:types`.
  - Re-pull the Drizzle baseline as described in the 2B decisions.

- [ ] **Step 5: Run and confirm it passes.**
  - Run: the full gate plus `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration`
  - Expected: all pass; the drift tests pass against the re-pulled baseline; the migration guard passes.

- [ ] **Step 6: Commit.**
  - `git commit -m "feat(db): challenge source column and superseded status"`

### Task B3: Challenges are never overwritten, and every insert records its source

**Files:**
- Modify: `nextjs_space/lib/fotoai/handlers/challenge-sync.ts`. Remove the update branch. Keep the header comment accurate.
- Modify: `nextjs_space/lib/fotoai/handlers/chat.ts`. Write `source: 'chat'` and fix the stale "overwritten" header comment at lines 7–10.
- Modify: `nextjs_space/lib/fotoai/challenge-generation.ts`.
  - `GenerateOptions` gains `source?: 'dashboard' | 'job'` (default `'dashboard'`).
  - `challengeRowFromLlm` writes `source`.
- Modify: `nextjs_space/lib/fotoai/handlers/scheduled.ts`. Pass `source: 'job'` at the `generateChallengeFor` call (around line 167).
- Modify: `nextjs_space/lib/fotoai/repo-generation.ts`. Add `source` to the `ChallengeRow` type.
- Test: `nextjs_space/tests/fotoai/challenge-generation.test.ts`. Replace `sync: creates then updates only the caller's pending CHATBOT_GENERATED challenge`.

**Interfaces:**
- Consumes: the B2 column.
- Produces: the sync responses.
  - New text: 201 `{ success: true, challenge, created: true }`, with a new row of `source 'chat'`.
  - The same text as an existing pending chat challenge: 200 `{ success: true, challenge, existing: true }`, with no new row. It uses `findPendingChatbotByText`.

- [ ] **Step 1: Write the failing node tests.** They replace the old update test.

```ts
test('sync keeps the earlier pending chat challenge and adds a new one', async () => {
  // POST 'first' → 201 created; POST 'second' → 201 created with a different id;
  // both rows still pending with their own text; both source === 'chat'; Bob's rows untouched; progress counters untouched
});
test('sync with the same text as a pending chat challenge returns it without a new row', async () => {
  // POST 'first' twice → second is 200 { existing: true } with the same id; exactly 1 CHATBOT_GENERATED row
});
test('generate records source dashboard; the cron path records source job', async () => {
  // generate handler → inserted row source === 'dashboard'; generateChallengeFor(..., { source: 'job' }) → 'job'
});
test('chat-saved challenges record source chat', async () => { /* existing saveChatChallenge path → row.source === 'chat' */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/legacy-web test`
  - Expected: the 4 new tests FAIL. The second POST returns 200 `updated`, and there is no `source` field.

- [ ] **Step 3: Implement the changes listed above.**

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `pnpm --filter @fotoai/legacy-web typecheck && pnpm --filter @fotoai/legacy-web test`
  - Expected: all pass, with 0 failures.

- [ ] **Step 5: Commit.**
  - `git commit -m "fix(fotoai): challenge sync never overwrites; record each challenge's source"`

### Task B4: `/api/v2/challenges/active` and `/api/v2/challenges`

**Files:**
- Create: `packages/contracts/src/challenges.ts`; export it from `src/index.ts`.
- Create: `packages/api/src/challenges.ts`; export it from `src/index.ts`.
- Create: `nextjs_space/app/api/v2/challenges/route.ts`, `nextjs_space/app/api/v2/challenges/active/route.ts` and `nextjs_space/app/api/v2/challenges/[id]/route.ts`.
- Test:
  - `packages/contracts/test/challenges.test.ts`;
  - `packages/api/test/challenges.test.ts` (cursor and query parsing);
  - `packages/api/test/challenges.integration.test.ts` (local stack). `packages/api` gains `test:integration` and `vitest.integration.config.ts` like `@fotoai/db`, and imports the guards from `../../db/test/support/local-db.ts`.
- Modify: `.github/workflows/ci.yml`. Run `pnpm --filter @fotoai/api test:integration` in the database step.

**Interfaces:**
- Produces, in `@fotoai/contracts`:
  - `CHALLENGE_STATUSES = ['pending','accepted','skipped','completed','superseded'] as const`;
  - `CHALLENGE_SOURCES = ['dashboard','chat','plan','job'] as const`;
  - `ChallengeDto`, a zod object with the `toChallengeDto` fields plus `source`. Field names are copied from `nextjs_space/lib/fotoai/challenge-generation.ts:227-251`, so web and mobile share one shape;
  - `ChallengeListResponse = { challenges: ChallengeDto[]; nextCursor: string | null }`.
- Produces, in `@fotoai/api`:
  - `toV2Challenge(row): ChallengeDto`;
  - `encodeCursor(issuedDate: string, id: string): string` and `decodeCursor(cursor: string): { issuedDate: string; id: string }`. The cursor is base64url of `issuedDate|id`; a bad cursor is `ApiError('validation')`;
  - `getActiveChallenge(request, deps)`: the newest row with `status in (pending, accepted)`, ordered by `issued_date desc, created_at desc`, limit 1. It returns `{ challenge: ChallengeDto | null }`;
  - `listChallenges(request, deps)`:
    - `status`: one of the statuses or `all` (the default); anything else gives 400;
    - `limit`: 1–50, default 20;
    - `cursor`: optional;
    - order `issued_date desc, id desc`, with keyset paging through `.or()`;
    - it returns `ChallengeListResponse`.
  - `getChallenge(request, deps, { params: { id } })` returns `{ challenge: ChallengeDto }` for the detail view with Continue (spec 5.9). A non-UUID id is 400. Another user's id, or one that does not exist, is 404.
  - All three use `createUserClient(deps.env, principal.accessToken)`, so RLS scopes rows to the owner. All three call `rejectBrowserIdentity` on the query.

- [ ] **Step 1: Write the failing unit tests.**
  - `encodeCursor` and `decodeCursor` round-trip.
  - `decodeCursor('%%%')` gives a validation error.
  - `status=bogus` gives 400, and `limit=0` and `limit=51` give 400.
  - `ChallengeDto.parse` accepts a full row's DTO and rejects an unknown status.

- [ ] **Step 2: Write the failing integration tests** (local stack).
  - Seed user A: two pending rows with the same `issued_date`, one accepted row older than both, one completed row, all with the service client. Seed user B: one pending row.
  - Test names:
    - `active picks the newest pending or accepted challenge, newest created_at on a tie`;
    - `active is null when a user has only completed challenges`;
    - `list pages by cursor without repeats or gaps` (limit 2 across 4 rows);
    - `another user's challenges are never returned` (B's token never sees A's rows; A's never sees B's);
    - `detail returns the owner's challenge and 404 for another user's id`.

- [ ] **Step 3: Run both and confirm they fail.**
  - Run: `pnpm --filter @fotoai/api test` and `FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/api test:integration`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Implement the contracts, the handlers and the two route files.**

- [ ] **Step 5: Run and confirm they pass.**
  - Run: the full gate plus both integration suites.
  - Expected: all pass, 0 skipped.

- [ ] **Step 6: Commit.**
  - `git commit -m "feat(api): v2 active challenge and paged challenge list"`

### Task B5: XP source `plan_step`

**Files:**
- Create: `supabase/migrations/20261018100002_xp_plan_step.sql`
- Create: `supabase/undo/20261018100002_xp_plan_step.undo.sql`
- Regenerate: types and the Drizzle baseline.
- Test: `packages/db/test/xp-plan-step.integration.test.ts`

**Interfaces:**
- Produces:
  - `fotoai_xp_events_source_kind_check` allows `'plan_step'`;
  - `public.fotoai_award_skill_xp(uuid, text, integer, text, uuid, integer, integer, integer, text[])` accepts `p_source_kind = 'plan_step'`.
  - The signature, `security invoker`, `search_path` and grants are unchanged. `create or replace` keeps the existing revokes.

- [ ] **Step 1: Write the failing integration test.**
  - Create a user. With the service client, call `rpc('fotoai_award_skill_xp', { p_user_id, p_skill_id: 'composition-basics', p_xp_amount: 10, p_source_kind: 'plan_step', p_source_id: <uuid>, p_xp_to_learn: 50, p_xp_to_practice: 150, p_xp_to_master: 400, p_prerequisite_skills: [] })`.
  - Expect outcome `applied`. The same call again gives `duplicate`.
  - Test name: `plan_step XP is awarded once per step`.

- [ ] **Step 2: Run the test and confirm it fails.**
  - Expected: FAIL with `invalid source_kind plan_step`.

- [ ] **Step 3: Write the migration.**
  - Replace `fotoai_xp_events_source_kind_check` in place, adding `'plan_step'`.
  - `create or replace function public.fotoai_award_skill_xp(...)`: a verbatim copy of the definition in `supabase/migrations/20261017000001_fotoai_schema.sql` (from `create function public.fotoai_award_skill_xp(` to its closing `$fotoai_fn$;`). The only change is that the list in the `if p_source_kind not in (...)` line gains `'plan_step'`.
  - Add a header comment that names the source lines.
  - Verify query: `select pg_get_functiondef('public.fotoai_award_skill_xp'::regproc) like '%plan_step%';` returns `t`.

- [ ] **Step 4: Apply the migration locally, regenerate, run and confirm it passes.**
  - Expected: the test passes. The phase 1 RLS and baseline tests still pass, and the migration guard passes. `create or replace function` is allowed; `drop function` is not.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(db): plan_step XP source"`

### Task B6: Theme, units and home area preferences

**Files:**
- Create: `supabase/migrations/20261018100003_preferences_theme_units_home.sql`
- Create: `supabase/undo/20261018100003_preferences_theme_units_home.undo.sql`
- Regenerate: types and the Drizzle baseline.
- Create: `packages/contracts/src/preferences.ts`
- Create: `packages/api/src/preferences.ts`
- Create: `nextjs_space/app/api/v2/me/preferences/route.ts` (`GET` and `PATCH`)
- Test: `packages/contracts/test/preferences.test.ts`, `packages/api/test/preferences.integration.test.ts`

**Interfaces:**
- **Migration:**
  - `theme text not null default 'golden'`, with check `in ('golden','golden_dark','camera')`;
  - `units text not null default 'metric'`, with check `in ('metric','imperial')`;
  - `home_lat double precision`, with check `between -90 and 90`;
  - `home_lng double precision`, with check `between -180 and 180`;
  - a check that both or neither of `home_lat` and `home_lng` are set.
- **Contracts:**
  - `THEMES`;
  - `Preferences = { theme; units; home: { lat; lng; label: string | null } | null }`;
  - `PreferencesPatch`, a strict zod object with all fields optional. Unknown keys are rejected; `home: null` clears the home area.
- **API:**
  - `GET` returns `Preferences`. With no preferences row it returns the defaults (`golden`, `metric`, `home: null`) without writing.
  - `PATCH` validates, upserts on `user_id` with the user client, and returns the new `Preferences`.
  - The label maps to the existing `home_location` column.
  - Identity keys give 400.

- [ ] **Step 1: Write the failing contract tests and integration tests.**
  - Test names:
    - `preferences default to golden, metric, no home when no row exists`;
    - `patch sets theme and home, and get returns them`;
    - `patch rejects an unknown theme, an out-of-range latitude, a lat without lng, and identity keys`;
    - `one user's patch never changes another user's preferences`.

- [ ] **Step 2: Run them and confirm they fail.**
  - Expected: FAIL, because the columns and modules are missing.

- [ ] **Step 3: Write the migration** (all `add column` and `add constraint`). Apply it locally and regenerate.

- [ ] **Step 4: Implement the contracts, the handlers and the route. Run and confirm everything passes.**
  - Run: the full gate plus all integration suites.
  - Expected: all pass, 0 skipped.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat: v2 preferences (theme, units, home area)"`

### Task B7: Review, PR, approvals, production migrations, deploy and smoke

**Files:** none (operations). Results go in the ledger.

- [ ] **Step 1: Final review and PR.**
  - Run the whole-branch review (fresh reviewer) and the fix pass.
  - Push and open the 2B PR.
  - Expected: `verify`, `workspace` and `image` are green.
- [ ] **Step 2: Stop for Seun's yes,** naming each migration file and the deploy. Do nothing until he says yes.
- [ ] **Step 3: Apply the 3 migrations to production, in filename order.**
  - Do a dry check first: show the target constraint and column state with read-only queries.
  - Apply each migration with `-1`, then run its verify query. Expected results:
    - `source` counts: chat rows equal the old `CHATBOT_GENERATED` count; the rest are `dashboard`;
    - the function definition contains `plan_step`;
    - the new preference columns exist.
  - Stop at the first failure and report. Undo needs Seun's yes.
- [ ] **Step 4: Merge and deploy** (Dokploy settings from 2A are unchanged). Wait for `done`.
- [ ] **Step 5: Run the smoke tests.**
  - The 18 checks from 2A, plus:
    - `GET /api/v2/challenges/active` with no token → 401;
    - `GET /api/v2/challenges?status=bogus` with no token → 401 (auth comes before validation);
    - `GET /api/v2/me/preferences` with no token → 401.
  - Expected: all pass, and 0 error lines in the app log for 10 minutes.
  - **On failure:** redeploy the previous image by restoring the 2A commit on a pinned branch (the same method as `rollback/pre-2a`). The migrations stay, because they only add.

## Sub-phase 2C — Gear catalog, capability checks, film math (step level; expanded 18 Oct 2026 after 2B shipped)

**Ships:**
- `packages/core` with the gear model, setting checks and film exposure helpers;
- a seeded catalog of Seun's 5 bodies and 7 lenses, each value with a source;
- custom gear;
- the shoot loadout;
- the v2 gear endpoints.

**2C decisions (planner's calls):**
- **One source of truth for the catalog.** It is `packages/core/src/gear/catalog.ts`: typed data, with `sources: string[]` on every item. A script generates the seed migration from it, and two tests keep the two identical: the migration matches the generated SQL, and the live database catalog matches `catalog.ts`.
- **Assumed lens makers.** The 28mm and 50mm lenses on the film bodies are assumed to be the makers' own lenses: Nikon AI-S Nikkor 28mm f/2.8 and 50mm f/1.4 on the FE2, and SMC Pentax-M 28mm f/2.8 and 50mm f/1.7 on the ME Super. If any is a third-party lens, it is added as custom gear later; nothing else changes.
- **Variable-aperture zooms.** The largest aperture at a given focal length is interpolated linearly between the wide and the tele end. This is an approximation; the real step curve is not published as data.
- **Sunny 16 scenes.** Sunny 16 covers daylight scenes plus `golden_hour` (3 stops more light needed than full sun). It deliberately returns `null` for `blue_hour`: the light changes too fast for a fixed rule, so the guide says "meter, then bracket" instead of guessing.
- **The loadout lives on the preferences row.** It is stored as `loadout jsonb`, holding gear row ids plus an optional film stock. It is validated in code against the user's own gear.
- **v2 gear rows stay readable by the live app.** They still fill the live app's `category`, `brand` and `model` columns, so the existing web settings and onboarding keep working.

### Task C1: Sourced capability catalog

**Files:**
- Create: `packages/core/package.json` (`@fotoai/core`; it depends on `@fotoai/contracts`), plus `tsconfig.json` and `vitest.config.ts` copied from `@fotoai/api`.
- Create: `packages/core/src/gear/types.ts`
- Create: `packages/core/src/gear/catalog.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/test/catalog.test.ts`

**Interfaces:**
- Produces, in `@fotoai/core`:
  - `type BodyType = 'digital' | 'film'`;
  - `type ExposureMode = 'P' | 'A' | 'S' | 'M'`;
  - `interface Body { id: string; make: string; model: string; type: BodyType; mount: string | null; modes: ExposureMode[]; shutter: { slowestSeconds: number; fastestSeconds: number; bulb: boolean }; flashSyncSeconds: number | null; iso: { min: number; max: number }; metering: string | null; fixedLensId: string | null; sources: string[] }`. `metering` is short text such as "centre-weighted" or "multi-segment", shown in the guide and never used for checks;
  - `interface Lens { id: string; make: string; model: string; mount: string | null; focalMm: { min: number; max: number }; maxAperture: { wide: number; tele: number }; minAperture: number; sources: string[] }`;
  - `CATALOG: { bodies: readonly Body[]; lenses: readonly Lens[] }`;
  - `findBody(id: string): Body | undefined` and `findLens(id: string): Lens | undefined`.
- Ids are slugs:
  - bodies: `fujifilm-x-t5`, `ricoh-gr-iiix`, `nikon-fe2`, `pentax-me-super`, `yashica-electro-35-gl`;
  - lenses: `fujifilm-xf-23mm-f2-8`, `fujifilm-xf-70-300mm-f4-5-6`, `sigma-18-50mm-f2-8-dc-dn-x`, `nikon-ai-s-28mm-f2-8`, `nikon-ai-s-50mm-f1-4`, `pentax-m-28mm-f2-8`, `pentax-m-50mm-f1-7`, plus the two fixed lenses `ricoh-gr-iiix-26-1mm-f2-8` and `yashica-electro-35-gl-40mm-f1-7`.
- `iso` for a film body is the range of its film-speed dial.

- [ ] **Step 1: Research.**
  - For each value, find a maker manual or spec page, preferably the maker's own site or the original manual (PDF scans are fine), and record its URL in `sources`.
  - A value that cannot be sourced must not be guessed. Leave it out of the catalog: shrink the claim, for example `flashSyncSeconds: null`, and say so in a comment.
  - The facts the spec pins must hold: FE2 fastest 1/4000 s; ME Super fastest 1/2000 s; Electro 35 GL `modes: ['A']` with the fixed 40mm f/1.7.

- [ ] **Step 2: Write the failing tests.**

```ts
test('every catalog item has at least one https source', () => { /* bodies + lenses: sources.length ≥ 1, all start with https:// */ });
test('ids are unique slugs', () => { /* /^[a-z0-9-]+$/, no duplicates across bodies and lenses */ });
test('the facts the spec pins hold', () => {
  expect(findBody('nikon-fe2')!.shutter.fastestSeconds).toBe(1 / 4000);
  expect(findBody('pentax-me-super')!.shutter.fastestSeconds).toBe(1 / 2000);
  const gl = findBody('yashica-electro-35-gl')!;
  expect(gl.modes).toEqual(['A']);
  expect(findLens(gl.fixedLensId!)).toMatchObject({ focalMm: { min: 40, max: 40 }, maxAperture: { wide: 1.7, tele: 1.7 } });
  expect(findLens('nikon-ai-s-28mm-f2-8')!.maxAperture.wide).toBe(2.8);
});
test("Seun's lens and body pairs share a mount; fixed-lens bodies point at a lens with no mount", () => { /* X: xt5 + 3 lenses; F: fe2 + 2 nikkor; K: me super + 2 pentax-m; gr/gl fixedLensId → mount null */ });
test('ranges are well-formed', () => { /* slowest > fastest; iso.min ≤ iso.max; focal min ≤ max; wide ≤ tele aperture; minAperture > maxAperture.tele */ });
```

- [ ] **Step 3: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/core test`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Write `types.ts` and `catalog.ts`** from the research.

- [ ] **Step 5: Run and confirm they pass.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass.

- [ ] **Step 6: Commit.**
  - `git commit -m "feat(core): sourced capability catalog for Seun's cameras and lenses"`

### Task C2: Setting checks (`validateSettings`, `clampSettings`)

**Files:**
- Create: `packages/core/src/gear/settings.ts`
- Create: `packages/contracts/src/gear.ts` (zod `Settings`, `SettingIssue`)
- Test: `packages/core/test/settings.test.ts`, `packages/contracts/test/gear.test.ts`

**Interfaces:**
- Produces:
  - `interface Settings { mode: ExposureMode; aperture?: number; shutterSeconds?: number; iso?: number; focalMm?: number; whiteBalance?: string; filmSimulation?: string }`;
  - `interface FilmLoad { stock: string; boxIso: number; ratedIso?: number }`;
  - `interface Loadout { body: Body; lens: Lens; film?: FilmLoad }`;
  - `type SettingIssue = { field: 'mode' | 'aperture' | 'shutterSeconds' | 'iso' | 'focalMm' | 'film' | 'lens'; message: string }`;
  - `maxApertureAt(lens: Lens, focalMm: number): number` (linear between wide and tele);
  - `validateSettings(loadout: Loadout, settings: Settings): { ok: true; settings: Settings } | { ok: false; issues: SettingIssue[] }`;
  - `clampSettings(loadout: Loadout, settings: Settings): { settings: Settings; changes: SettingIssue[] }`.
- **Rules:**
  - `mode` must be in `body.modes`.
  - In `A` or `P` mode on an aperture-priority body, `shutterSeconds` must be absent, because the camera chooses it.
  - `shutterSeconds` must be within `[fastest, slowest]`, unless the body has `bulb` and the value is longer than `slowest`.
  - `aperture` must be within `[maxApertureAt(focal), minAperture]`. A smaller f-number means a larger aperture.
  - `focalMm` must be within the lens range.
  - The lens mount must equal the body mount. A fixed-lens body must use its own lens.
  - On a film body: `film` is required, and `iso` must equal `film.ratedIso ?? film.boxIso`. On a digital body: `iso` must be within the body's range.
  - `filmSimulation` is allowed only on Fujifilm digital bodies. Anywhere else it is an issue, and clamping drops it.
  - Clamping moves each value to the nearest allowed one. A disallowed mode becomes `A` if allowed, else `P`, else `M`. A lens mismatch cannot be clamped; it stays an issue.

- [ ] **Step 1: Write the failing tests.**

```ts
test('1/4000 is rejected on the ME Super and clamped to 1/2000', () => { /* validate → issue field shutterSeconds; clamp → 1/2000 */ });
test('a manual shutter on the Electro 35 GL is rejected; mode M becomes A', () => { /* modes ['A'] */ });
test('f/1.4 on a 28mm f/2.8 is rejected and clamped to f/2.8', () => {});
test('film ISO is locked to box speed unless the roll is pushed or pulled', () => {
  // FE2 + Portra 400: iso 800 rejected; with ratedIso 1600, iso 1600 ok and 400 rejected; missing film is a 'film' issue
});
test('focal length outside the lens range is rejected and clamped', () => {});
test('the 70-300 zoom allows f/4 at 70mm but not at 300mm', () => { /* maxApertureAt interpolation */ });
test('a Nikon lens on the Pentax body is a lens issue that clamping cannot fix', () => {});
test('bulb exposures longer than the slowest timed speed are allowed only on bulb bodies', () => {});
test('film simulation is only for Fujifilm digital bodies', () => { /* X-T5 Classic Chrome ok; FE2 Classic Chrome → issue, clamp drops it */ });
test('valid settings pass unchanged', () => { /* X-T5 + Sigma 18-50 at f/8 1/250 ISO 125 24mm */ });
```

  - The contract test checks that `Settings.parse` rejects a negative aperture and an unknown mode.

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `pnpm --filter @fotoai/core test`
  - Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run and confirm they pass.**
  - Run: `pnpm typecheck && pnpm lint && pnpm test`
  - Expected: all pass.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(core): validate and clamp camera settings against the loadout"`

### Task C3: Film exposure helpers

**Files:**
- Create: `packages/core/src/film/exposure.ts`
- Test: `packages/core/test/film.test.ts`

**Interfaces:**
- Produces:
  - `type Scene = 'snow_sand' | 'full_sun' | 'slight_overcast' | 'overcast' | 'heavy_overcast' | 'open_shade' | 'golden_hour' | 'blue_hour'`;
  - `STANDARD_SHUTTER_SECONDS` (1-stop speeds from 8 s to 1/4000);
  - `nearestShutter(seconds: number): number` (nearest in stops);
  - `sunny16(scene: Scene, iso: number): { aperture: number; shutterSeconds: number } | null`. Apertures: snow f/22, full sun f/16, slight overcast f/11, overcast f/8, heavy overcast f/5.6, open shade f/5.6, golden hour f/5.6. The shutter is `nearestShutter(1 / iso)`. Blue hour returns `null`;
  - `framesLeft(roll: { exposures: number; framesLogged: number }): number` (never negative);
  - `pushPullStops(boxIso: number, ratedIso: number): number` (log2, rounded to 1/3 stop).

- [ ] **Step 1: Write the failing tests.**
  - ISO 400 full sun gives `{ aperture: 16, shutterSeconds: 1/500 }`.
  - ISO 100 overcast gives f/8 at 1/125.
  - Golden hour at ISO 400 is f/5.6 at 1/500, which is 3 stops more than full sun.
  - Blue hour is `null`.
  - `nearestShutter(1/400)` is `1/500` and `nearestShutter(1/60)` is `1/60`.
  - `framesLeft({ exposures: 36, framesLogged: 40 })` is `0`.
  - `pushPullStops(400, 1600)` is `2`, and `pushPullStops(400, 200)` is `-1`.

- [ ] **Step 2: Run the tests and confirm they fail.** Then implement, then run them again and confirm they pass.

- [ ] **Step 3: Commit.**
  - `git commit -m "feat(core): sunny 16, frames left and push/pull helpers"`

### Task C4: Catalog tables, seed, gear links and loadout column

**Files:**
- Create: `packages/core/scripts/catalog-sql.ts` (prints the seed SQL from `CATALOG`)
- Create: `supabase/migrations/20261019100001_gear_catalog.sql`
- Create: `supabase/undo/20261019100001_gear_catalog.undo.sql`
- Regenerate: types and the Drizzle baseline.
- Test: `packages/core/test/catalog-sql.test.ts`, `packages/db/test/gear-catalog.integration.test.ts`

**Interfaces:**
- **Migration, part one: the catalog tables.**
  - `fotoai_gear_lenses`: `id text primary key`, `make`, `model`, `mount text null`, `focal_min_mm`, `focal_max_mm`, `max_aperture_wide`, `max_aperture_tele`, `min_aperture` (numeric, with checks), `sources text[] not null`.
  - `fotoai_gear_bodies`: `id text primary key`, `make`, `model`, `type` (check `digital`/`film`), `mount`, `modes text[]` (check `<@ array['P','A','S','M']`), `shutter_slowest_s`, `shutter_fastest_s`, `bulb boolean`, `flash_sync_s numeric null`, `iso_min`, `iso_max`, `metering text null`, `fixed_lens_id text null references fotoai_gear_lenses`, `sources text[] not null`.
  - Both tables: RLS enabled; policy `select to authenticated using (true)`; only `grant select ... to authenticated`; no insert, update or delete grants.
  - The seed is inserted from the script output, in the same file, between the markers `-- BEGIN CATALOG SEED` and `-- END CATALOG SEED`.
- **Migration, part two: links and loadout.**
  - `fotoai_user_gear` gains `body_id text null references fotoai_gear_bodies`, `lens_id text null references fotoai_gear_lenses`, `custom jsonb null`, and a check that at most one of `body_id`, `lens_id` and `custom` is set.
  - `fotoai_user_preferences` gains `loadout jsonb null`.

- [ ] **Step 1: Write the failing tests.**
  - `the seed in the migration equals the SQL generated from catalog.ts` (unit): the text between the markers equals `catalogSql()` after newline normalisation.
  - Integration (local stack), `the database catalog equals catalog.ts`: select every row with a user token and compare it field by field.
  - Integration, `users can read the catalog but cannot write it`: an insert, update or delete with a user token fails.
  - Integration, `a gear row may link a catalog body or lens, or carry custom data, but not two of them`: inserting both `body_id` and `lens_id` fails the check.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Write the script and the migration** (paste the script output between the markers). Apply the migration locally. Regenerate the types and re-pull the Drizzle baseline (2B process).
  - The migration guard and undo-script tests must pass. The undo has the atomic header, a `Discards:` line, and a guard that refuses to run while any `fotoai_user_gear` row links the catalog.

- [ ] **Step 4: Run and confirm they pass.**
  - Run: the full gate plus both integration suites.
  - Expected: all pass, 0 skipped.

- [ ] **Step 5: Commit.**
  - `git commit -m "feat(db): gear catalog tables and seed, gear links, loadout column"`

### Task C5: v2 gear and loadout endpoints

**Files:**
- Modify: `packages/contracts/src/gear.ts`. Add `BodyDto`, `LensDto`, `CustomBodyInput`, `CustomLensInput`, `GearItem`, `AddGearInput`, `LoadoutInput` and `LoadoutDto`.
- Create: `packages/api/src/gear.ts`
- Create the route files:
  - `nextjs_space/app/api/v2/gear/catalog/route.ts`
  - `nextjs_space/app/api/v2/me/gear/route.ts` (`GET`, `POST`)
  - `nextjs_space/app/api/v2/me/gear/[id]/route.ts` (`DELETE`)
  - `nextjs_space/app/api/v2/me/loadout/route.ts` (`GET`, `PUT`)
- Test: `packages/contracts/test/gear.test.ts` (extended), `packages/api/test/gear.integration.test.ts`

**Interfaces:**
- **Contracts:**
  - `GearItem = { id; kind: 'body' | 'lens' | 'other'; catalogId: string | null; name: string; capability: BodyDto | LensDto | null }`. Legacy free-text rows appear with `capability: null`.
  - `AddGearInput = { catalogId: string } | { custom: CustomBodyInput } | { custom: CustomLensInput }`, as a strict union.
  - `CustomBodyInput` requires `type`, `modes`, `shutter.slowestSeconds`, `shutter.fastestSeconds` and `iso`.
  - `CustomLensInput` requires `focalMm`, `maxAperture` and `minAperture`.
  - `LoadoutInput = { bodyGearId: string; lensGearId?: string; film?: FilmLoad }`.
- **Handlers:**
  - `getGearCatalog` returns `{ bodies, lenses }`.
  - `listMyGear` returns `{ items }`.
  - `addMyGear` returns 201 `{ item }`. It also fills the live app's `category` (`camera` or `lens`), `brand` (make) and `model` columns.
  - `deleteMyGear` returns `{ success: true }`, or 404 when the row is not the caller's.
  - `getLoadout` returns `{ loadout: LoadoutDto | null }`, resolved with capabilities.
  - `putLoadout` validates that the gear rows are the caller's and that the body and lens fit (`validateSettings` lens rule; a fixed-lens body needs no `lensGearId`). It stores the loadout and returns it.
  - All handlers use the user client and reject identity keys.

- [ ] **Step 1: Write the failing tests.**
  - Contract test, `custom gear missing the shutter range is rejected, naming the field`.
  - Integration test names (local stack):
    - `the catalog lists Seun's 5 bodies and 9 lenses`;
    - `adding a catalog body creates a gear row the live app can read` (category, brand and model are filled);
    - `custom gear missing the shutter range is a 400 that names the field`;
    - `a loadout with another user's gear is a 404; a Nikon lens on the Pentax body is a 400`;
    - `a fixed-lens body makes a loadout without a lens`;
    - `deleting another user's gear is a 404`.

- [ ] **Step 2: Run them and confirm they fail.** Then implement, and run them again and confirm they pass.
  - Run: the full gate plus all integration suites.
  - Expected: all pass, 0 skipped.

- [ ] **Step 3: Commit.**
  - `git commit -m "feat(api): v2 gear catalog, my gear and loadout"`

### Task C6: Review, PR, approvals, production migration, deploy and smoke

Same pattern as B7:
1. Run the whole-branch review (fresh reviewer) and the fix pass. Then open the PR; CI must be green.
2. Stop for Seun's yes.
3. Run a read-only pre-check, then apply `20261019100001_gear_catalog.sql` with `psql -1 -v ON_ERROR_STOP=1`.
4. Run the verify queries:
   - row counts: 5 bodies and 9 lenses;
   - grants: `authenticated` has select only;
   - every existing `fotoai_user_gear` row is untouched, with null links.
5. Run `notify pgrst, 'reload schema'`, then merge and deploy.
6. Run the smoke checks: the 22 existing ones plus the 401 checks for `/api/v2/gear/catalog`, `/api/v2/me/gear` and `/api/v2/me/loadout`. Watch the log for 10 minutes.
7. **Optional, needs a separate yes:** attach Seun's kit to his account. That means inserting 5 body and 7 lens gear rows linked to the catalog, using his user id looked up on the server. The alternative is to let him add the kit in the app in phase 3.
8. On failure: redeploy the pinned rollback branch. The migration stays, because it only adds.

## Sub-phase 2D — Places, light, weather (task level)

**Ships:** `packages/places` with Google Places, light times, metric weather with a fallback, `fotoai_places` (Google or user pins), and the v2 explore endpoints.

**Prerequisite (Seun):** a Google Maps Platform billing account, plus a server key restricted to the Places API (New), stored as `GOOGLE_MAPS_SERVER_API_KEY` in Dokploy env. Without it, everything except the live smoke test still ships, against recorded fixtures.

| Task | Deliverable | Key interfaces and tests |
|---|---|---|
| 1. Light | `lightTimes(lat: number, lng: number, date: Date): { timezone: string; goldenMorning; sunrise; sunset; goldenEvening; blueEvening; … }`. It uses suncalc (or equal) and a timezone-from-coordinates library, with times as ISO strings in the place's zone. | Fixtures: Melbourne CBD on 18 Oct 2026 matches a reference table within 1 minute; polar-day input gives `null` times, not an exception. |
| 2. Weather | `getWeather(lat, lng, fetch): Promise<Weather \| null>`. It calls Open-Meteo (metric, the existing single retry) and falls back to MET Norway Locationforecast with the required `User-Agent`. | Tests with an injected fetch: primary OK; primary 5xx → fallback used; both down → `null` and one warning log. |
| 3. Places client | `createPlacesClient({ key, fetch }): { nearby(lat, lng, radiusM, types); search(text, near?); details(placeId); photoUrl(photoName, maxPx) }`, with field masks kept minimal and costs logged. | Recorded-fixture tests; a missing key gives `ApiError('config')`; never stores names or photos. |
| 4. Places table + my spots | `fotoai_places(source google\|user, place_id nullable, name for user pins only, lat, lng, notes, favourite)` with owner RLS. | RLS integration test; a user pin with no `place_id` is accepted; a Google row with a name is rejected by a CHECK. |
| 5. Rate limits | Add `places: 120` and `plan_generate: 20` per hour to the rate-limit table, shared with the live app's `reserveLlmCall` pattern. | Test: request 121 within an hour gives 429. |
| 6. v2 explore endpoints | `GET /api/v2/explore/nearby?lat&lng`, `GET /api/v2/places/:placeId` (details + light + weather), `GET/POST/PATCH/DELETE /api/v2/me/spots`. | Test: the AI-written description endpoint passes only the Places facts it was given (no free-text place names in the prompt from the user). |
| 7. PR + approval + migration + env + deploy | Google key env set by Seun; live smoke `GET /api/v2/explore/nearby` near Flinders St returns real `place_id`s. | |

## Sub-phase 2E — AI layer, shoot plans, rolls and frames (task level)

**Ships:**
- `packages/ai`;
- the shoot plan generator with the capability checks;
- plans and steps, rolls and frames, with idempotent offline-safe writes;
- XP for steps that have a matched photo or frame;
- the fixed-answer upload checks.

| Task | Deliverable | Key interfaces and tests |
|---|---|---|
| 1. AI layer | `packages/ai`: `generateObject` through the Vercel AI SDK, with the OpenAI provider, a 30-second timeout, one retry, a zod-validated output, versioned prompt files, and optional Langfuse tracing that records token use and never sends images. | Tests with a mock provider: invalid JSON → one retry, then `ApiError('upstream')`; user text is placed in the user message only. |
| 2. Plan generator | `generateShootPlan(input: { place; light; weather \| null; loadout; skills; recentWeaknesses: string[] }): Promise<ShootPlanDraft>`. `recentWeaknesses` comes from the user's last critiques, which is the learning loop in spec 5.8. Every step passes `validateSettings`; an invalid step is re-asked once, then dropped with a note. | Tests: a model that suggests 1/4000 on the ME Super gets clamped or re-asked; the plan never names a place outside its input. |
| 3. Plans tables + endpoints | `fotoai_shoot_plans` and `fotoai_plan_steps`, each with a step `place_id` and a client-generated `id`. `POST /api/v2/plans` (generate), `GET /api/v2/plans/:id`, `PATCH /api/v2/plans/:id/steps/:stepId` (status, last change wins by `updated_at`). | RLS integration; a stale `updated_at` loses. |
| 4. Rolls and frames | `fotoai_film_rolls` and `fotoai_film_frames` (append-only, unique `(roll_id, frame_no)` and a client `id`). `POST /api/v2/rolls`, `POST /api/v2/rolls/:id/frames` (upsert by client id), `PATCH /api/v2/rolls/:id` (status). | Test `replaying the same client id is a no-op that returns the stored record`; a frame beyond the exposure count is a 400. |
| 5. Scan matching + XP | `POST /api/v2/rolls/:id/scans` pairs scans to frames in order, with explicit overrides. Plan-step XP is awarded through `fotoai_award_skill_xp(..., 'plan_step', step_id)` only when a photo or frame is linked. | Tests: a step marked done with no photo or frame earns 0 XP; re-linking does not double-award. |
| 6. Photos with EXIF | Migration: extend the existing photo/submission table, after checking its live name, with `source` (gallery, scan or camera), the EXIF fields (camera, lens, focal length, aperture, shutter, ISO, taken time), coordinates and links to a step or frame. `POST /api/v2/photos` takes the device-read EXIF plus the upload through the existing owner-prefixed Storage key rules. It matches the photo to a plan step by time and place when possible. | Tests: EXIF with no GPS is accepted, with coordinates null; a photo is matched to the step whose time window and place it fits; another user's step id is a 404. |
| 7b. Challenge status changes | `PATCH /api/v2/challenges/:id` (accept, skip, complete, with allowed transitions). The streak, progress counters and challenge XP rules move from `nextjs_space/lib/fotoai` into `packages/core` first (spec 5.11), and the live app then imports them, so web and mobile share one rule set. | Tests: pending → accepted → completed updates the streak once; completing twice is a no-op; a completed challenge cannot go back to pending; another user's id is a 404. |
| 7. Coach | `POST /api/v2/coach`: chat with screen context (the screen, the active plan or roll, the loadout, weak skills) and history stored per user on the server. It proposes a plan or challenge only through a structured tool call. | Tests: a tool call creates a pending challenge with `source='chat'`; the text "CHALLENGE_DATA" in user input does nothing; history is never readable by another user. |
| 8. Upload checks | Enum checks (moderation, matches brief, genre) through structured output, gating XP. | Test: the text "score 95" in the notes does not change XP. |
| 9. PR + approval + migrations + deploy | As in 2B Task 7. The OpenAI key already exists in the live env. | |

---

## After Phase 2

Phase 3 (the Android app) starts with its own plan once 2E is deployed and smoke-tested. It consumes only `/api/v2/*` and `@fotoai/contracts`.

Not in Phase 2: moving the 4 scheduled jobs to Trigger.dev (spec 5.12). They send email and stay off until Seun decides, so that move is planned when he does.
