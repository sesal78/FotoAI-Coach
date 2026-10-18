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

## Sub-phase 2B — Data model and the challenge fix (task level)

**Ships:**
- root migrations for the challenge `source` column and the `superseded` status;
- the `plan_step` XP source;
- preferences (theme, units, home area);
- the end of the challenge-sync overwrite;
- a server-side "active challenge".

| Task | Deliverable | Key interfaces and tests |
|---|---|---|
| 1. Migration guard test | A root test that scans `supabase/migrations/*.sql` after `20261017000003`. It fails on `DROP TABLE`, `DROP COLUMN`, or a `DROP CONSTRAINT` without an `ADD CONSTRAINT` of the same name in the same file. | Test `new root migrations only add, or replace a CHECK in place`. |
| 2. Challenge source + superseded | Migration `…_challenge_source.sql`: `source text not null default 'dashboard' check (source in ('dashboard','chat','plan','job'))`. It backfills `chat` where `challenge_type = 'CHATBOT_GENERATED'`, and replaces the status CHECK to add `superseded`. Then regenerate `types.gen.ts` and re-pull the Drizzle baseline. | Integration test on the local stack: old rows keep their status; chat rows read `source='chat'`; inserting `status='superseded'` works and `'bogus'` fails. |
| 3. Never overwrite | `nextjs_space/lib/fotoai/handlers/challenge-sync.ts` inserts a new `CHATBOT_GENERATED` row instead of updating `findPendingChatbot`. It writes `source='chat'` here and in `chat.ts`, and `source='job'` in the cron path. The stale header comment in `chat.ts` is fixed. | Legacy node test: `sync keeps the earlier pending chat challenge and adds a new one` (RED on today's code). |
| 4. Active challenge | `GET /api/v2/challenges/active` returns the newest `pending` or `accepted` row by `issued_date desc`, with `created_at desc` as the tie-break, or `{ challenge: null }`. Plus `GET /api/v2/challenges?status&cursor`. A DTO goes in `@fotoai/contracts` (`ChallengeDto`, `ChallengeStatus`, `ChallengeSource`). | Tests: the tie-break order; accepted beats an older pending; another user's rows are never returned (RLS integration). |
| 5. XP source `plan_step` | Migration: replace the `source_kind` CHECK, and `create or replace function fotoai_award_skill_xp` with the same signature and `plan_step` added to its internal list. | Integration test: an award with `plan_step` is applied; replaying it is `duplicate`. |
| 6. Preferences | Migration: `theme text default 'golden' check in ('golden','golden_dark','camera')`, `units text default 'metric'`, `home_lat`, `home_lng`, `home_label`. `GET/PATCH /api/v2/me/preferences`. | Test: PATCH rejects unknown themes and identity keys. |
| 7. PR + approval + migrations + deploy | For each migration: local stack run, Seun's yes, `psql -1 -v ON_ERROR_STOP=1`, then a verify query. Then deploy and smoke. | Ledger records each applied migration and its verify query output. |

## Sub-phase 2C — Gear catalog, capability checks, film math (task level)

**Ships:** `packages/core` with the gear model and the setting checks, the seeded catalog for Seun's 5 bodies and 7 lenses, custom gear, film exposure helpers, and the v2 gear endpoints.

| Task | Deliverable | Key interfaces and tests |
|---|---|---|
| 1. Capability facts | A research step before any code. Collect sourced specs from maker manuals: modes, shutter range (including mechanical and bulb), flash sync, ISO range, metering, and fixed lens for X-T5, GR IIIx, FE2, ME Super and Electro 35 GL; focal range and maximum aperture for all 7 lenses. Facts the spec pins: FE2 top speed 1/4000; ME Super top speed 1/2000; Electro 35 GL aperture priority only with a fixed 40mm f/1.7. Store them in `packages/core/src/gear/catalog-sources.md`. | Every catalog value has a source URL. Unknowns are marked `null`, never guessed. |
| 2. Gear model | `packages/core/src/gear/`: `Body`, `Lens`, `Loadout = { body; lens; film?: FilmStock }`, `ExposureMode = 'P'\|'A'\|'S'\|'M'`, `Settings = { mode; aperture?; shutterSeconds?; iso?; focalMm?; whiteBalance?; filmSimulation? }`. | Types only, plus zod schemas in `@fotoai/contracts` for the API. |
| 3. Capability checks | `validateSettings(loadout: Loadout, settings: Settings): { ok: true; settings: Settings } \| { ok: false; issues: SettingIssue[] }` and `clampSettings(...)`. | Tests: 1/4000 is rejected on the ME Super; a manual shutter on the Electro GL is rejected; f/1.4 on a 28mm f/2.8 is rejected; ISO is locked to box speed on film unless pushed or pulled; focal length outside the lens range is rejected. |
| 4. Film math | `sunny16(scene: 'full_sun'\|'slight_overcast'\|'overcast'\|'heavy_overcast'\|'open_shade'\|'golden_hour'\|'blue_hour', iso: number): { aperture: number; shutterSeconds: number }`, `framesLeft(roll)`, `pushPullStops(boxIso, ratedIso)`. | Table tests against the sunny 16 rule, for example ISO 400 full sun → f/16 at 1/500; golden hour is 3 stops more than full sun. |
| 5. Catalog migration + seed | `fotoai_gear_bodies` and `fotoai_gear_lenses` (shared read for `authenticated`, no write grants; seed only by migration). `fotoai_user_gear` is extended with nullable `body_id`, `lens_id` and a custom capability JSON validated in code. | RLS integration: a user cannot insert catalog rows; a user sees only their own kit. |
| 6. v2 gear endpoints | `GET /api/v2/gear/catalog`, `GET/POST/DELETE /api/v2/me/gear` (catalog item or custom with required capability fields), `PUT /api/v2/me/loadout`. | Test: custom gear missing the shutter range is a 400 that names the field. |
| 7. PR + approval + migrations + deploy | As in 2B Task 7. | |

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
| 7. Coach | `POST /api/v2/coach`: chat with screen context (the screen, the active plan or roll, the loadout, weak skills) and history stored per user on the server. It proposes a plan or challenge only through a structured tool call. | Tests: a tool call creates a pending challenge with `source='chat'`; the text "CHALLENGE_DATA" in user input does nothing; history is never readable by another user. |
| 8. Upload checks | Enum checks (moderation, matches brief, genre) through structured output, gating XP. | Test: the text "score 95" in the notes does not change XP. |
| 9. PR + approval + migrations + deploy | As in 2B Task 7. The OpenAI key already exists in the live env. | |

---

## After Phase 2

Phase 3 (the Android app) starts with its own plan once 2E is deployed and smoke-tested. It consumes only `/api/v2/*` and `@fotoai/contracts`.

Not in Phase 2: moving the 4 scheduled jobs to Trigger.dev (spec 5.12). They send email and stay off until Seun decides, so that move is planned when he does.
