# FotoAI Refactor Phase 3 (Android App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Android app (`apps/mobile`, Expo) that runs the whole loop on Seun's phone: plan a shoot at a real place, follow the gear-aware guide (digital or film, offline in the field), bring photos in and get feedback. It uses only `/api/v2/*` on the live server and reaches Seun as an internal APK.

**Architecture:**
- Phase 3 has seven sub-phases. They ship as separate PRs, in order:
  - **3A** mobile foundation: the Expo app in the workspace, theme tokens, sign-in, the API client, the 5-tab shell, CI, the first APK. No production change.
  - **3B** the server gaps the app needs: progress and skills, a new challenge from Today, Analyse (critique, editing tips, recreate), the Auto theme. One migration and one deploy.
  - **3C** Today and Me (with gear, loadout, Appearance, onboarding).
  - **3D** Explore (map, places, My spots).
  - **3E** Shoot and the offline field mode (plans, steps, film rolls and frames).
  - **3F** Photos (import, library, scans, Analyse) and the Coach sheet.
  - **3G** release: the v1 APK, Seun's phone checklist, error tracking.
- 3C–3F change only the APK; the API they call is already live.
- **3A is fully specified below.** 3B–3G are specified to the task and interface level. Each one is expanded into step-level TDD tasks (a ledger addendum to this file) right before it starts, against the code that the sub-phase before it actually ships.

**Tech Stack:**
- Phase 2 stack: pnpm 10.26.2, Turborepo 2, TypeScript, zod 3, supabase-js 2, Vitest (packages), the live app on Next.js 14.2;
- new in Phase 3: Expo SDK 58 (released 29 Sep 2026; React Native 0.88), Expo Router, NativeWind 4, TanStack Query 5, Zustand 5, lucide-react-native, expo-secure-store, expo-sqlite, expo-image-picker, expo-media-library, expo-image-manipulator, expo-location, @react-native-community/netinfo, react-native-maps (Google provider), jest-expo with Testing Library (the app), EAS Build (internal APK), @sentry/react-native (optional, off until a DSN is set).

**Spec:** `docs/superpowers/specs/2026-10-18-fotoai-refactor-design.md` (sections 1, 2, 4, 5.2–5.11, 5.13, 7, 8, 10 phase 3). Phase map: `docs/superpowers/plans/2026-10-18-fotoai-refactor-index.md`. Server contracts: `docs/superpowers/plans/2026-10-18-fotoai-phase2-core-services.md` and `packages/contracts`.

## Global Constraints

- **Node and package manager:** Node `>=22.18`; pnpm `10.26.2`. zod stays on major 3. Exact versions are pinned in `apps/mobile/package.json` (no `^` on Expo SDK packages; `npx expo install` picks the SDK-matched versions).
- **Local workspace rules (unchanged):** work only in a Sandbox worktree; set `npm_config_store_dir=D:/Homebase/Sandbox/pnpm-store` and `TURBO_CACHE_DIR=D:/Homebase/Sandbox/turbo-cache`. Expo and Metro caches, `expo export` output and any Android build output go under `D:/Homebase/Sandbox/` too.
- **The app talks only to `/api/v2/*`** at `EXPO_PUBLIC_API_URL` (production: `https://myfoto.topues.com`) and to Supabase Auth and Storage at `EXPO_PUBLIC_SUPABASE_URL` (`https://supabase.techiesandbox.com`) with the anon key. Request and response shapes come from `@fotoai/contracts`; the app parses every response with the contract schema and treats a mismatch as an error state, never as data.
- **Identity:** the app never sends a user id. It sends the Supabase access token as `Authorization: Bearer`. The session is stored encrypted on the phone (section A4). Agents never type a password or create an account: real sign-in is Seun's step; tests use a fake auth client.
- **No secret in the APK.** Only public values ship: the API URL, the Supabase URL and anon key, and the Android Maps key restricted to the app's package and signing certificate. The OpenAI, Places server and service-role keys stay on the server.
- **No silent failure (spec section 2).** Every request has a visible loading, empty, error and offline state. Errors show the server's message and a Retry. Nothing is logged with a token, signed URL, photo or user text.
- **Offline (spec section 5.5):** opening a stored plan, marking a step done and logging a film frame work with no signal. These go through one outbox that survives app restarts and retries until the server confirms. Requests are idempotent: client-made ids for frames and photos, `updatedAt` last-write-wins for steps (both already supported by the v2 API).
- **Themes:** colours come only from `packages/ui` tokens. Every text-on-background pair in every theme meets WCAG AA (4.5:1, or 3:1 for large text), checked by a unit test.
- **Places:** the app shows a place only from the Places endpoints or the user's own spot. It never shows `fotoai_daily_challenges.location` or old itinerary spots on a map.
- **Production changes need Seun's yes, each one at the time it happens:** every migration, every Dokploy change, every deploy, every APK build that uses Seun's Expo account, and anything typed into Seun's Google Cloud or Expo account.
- **The live app must keep working.** Adding `apps/mobile` to the workspace must not change the live Docker image or its build (CI `image` and `verify` jobs stay green). All `nextjs_space` tests pass (317 or more).
- **Mobile testing:** unit and component tests run in CI. Core-loop testing on Seun's phone is **manual for v1**, with the written checklist in `apps/mobile/CHECKLIST.md` (spec section 5.13). An automated mobile end-to-end tool is out of scope.

## Prerequisites from Seun (accounts and keys; agents do not create these)

| Needed before | What | Why |
|---|---|---|
| end of 3A (first APK) | an Expo account (free), and `npx eas-cli login` run by Seun in a terminal | EAS builds the APK in the cloud and keeps the signing key |
| 3D (Explore) | the Google **server** key in Dokploy (`GOOGLE_MAPS_SERVER_API_KEY`), already pending from 2D | nearby, search, place details and photos |
| 3D (Explore) | a Google **Android Maps SDK** key restricted to package `com.topues.fotoai` and the EAS signing SHA-1 (shown by `eas credentials`) | the map tiles on the phone |
| 3G (optional) | a Sentry project DSN | crash and error reports from the phone |
| first install | allow installs from this source on the phone | the APK is not from the Play Store |

## Decisions for Seun

1. **How the APK is built.**
   - **EAS cloud build (recommended).** Needs the free Expo account above. Nothing big is installed on this PC. The signing key is kept by EAS.
   - Local build on this PC. Installs JDK 17 and the Android SDK into `D:/Homebase/Sandbox` (about 10 GB). No account, but Seun keeps the signing key safe.
2. **Sign-up and password reset in v1.**
   - **Link to the website (recommended).** The app has sign-in and sign-out; "Create account" and "Forgot password" open `myfoto.topues.com`. The email flows exist once.
   - Build them into the app now. More screens and a second copy of the email flows.

---

## Sub-phase 3A: Mobile foundation (fully specified)

**Ships:** `apps/mobile` (Expo SDK 58, Expo Router, NativeWind, TypeScript strict) in the workspace; `packages/ui` theme tokens; env checks; the typed API client; email and password sign-in with an encrypted session; the 5-tab shell with the Coach button; a CI job; the EAS profile and, on Seun's yes, the first internal APK. **Production:** none (the APK build uses Seun's Expo account, so it needs a yes).

### Task A1: The Expo app in the workspace

**Files:**
- Create: `apps/mobile/package.json` (`@fotoai/mobile`, private), `apps/mobile/app.config.ts`, `apps/mobile/tsconfig.json` (extends `tsconfig.base.json`, strict), `apps/mobile/babel.config.js`, `apps/mobile/metro.config.js` (Expo default plus NativeWind), `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`, `apps/mobile/eslint.config.mjs` (extends the root config), `apps/mobile/jest.config.js` (`jest-expo` preset).
- Modify: `packages/db/test/workspace-config.test.ts` (the mobile app is a workspace project with the same TS base), `.gitignore` (`apps/mobile/.expo/`, `apps/mobile/android/`, `apps/mobile/ios/`, `dist/`).
- Possibly modify: `nextjs_space/Dockerfile` (only if the frozen filtered install fails with the new lockfile importer; see Step 4).

**Interfaces:**
- `app.config.ts`: name `FotoAI`, slug `fotoai-coach`, scheme `fotoai`, `android.package` `com.topues.fotoai`, `newArchEnabled` true, `userInterfaceStyle` `automatic`, plugins `expo-router`, `expo-secure-store`, `expo-sqlite`. `extra` holds nothing secret.
- Package scripts: `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`jest`), `export:android` (`expo export --platform android --output-dir ../../../fotoai-mobile-export` — outside the repo, in Sandbox).

- [ ] **Step 1: Write the failing test.** Extend `workspace-config.test.ts`: `apps/mobile is a workspace project named @fotoai/mobile`; `its tsconfig extends the base and is strict`; `its Expo SDK packages are pinned (no ^ or ~ on expo*)`.
- [ ] **Step 2: Run it and confirm it fails** (no `apps/mobile`).
- [ ] **Step 3: Create the app.** Use `npx create-expo-app@latest` with the default template into a Sandbox scratch folder, then copy only the needed files into `apps/mobile` (no example screens, no assets beyond the icon and splash). Install with `npx expo install` so every Expo package matches SDK 58. Run the test again (pass).
- [ ] **Step 4: Prove the monorepo setup.**
  - `pnpm install` (Sandbox store), then `npx expo-doctor` in `apps/mobile` must pass.
  - `pnpm --filter @fotoai/mobile export:android` must bundle.
  - If Metro cannot resolve a package under pnpm's isolated layout, add only that package to `public-hoist-pattern[]` in the root `.npmrc`. **Do not switch the workspace to `node-linker=hoisted`** without asking Seun: it changes how the live image installs.
  - Build the live image locally from the repo root (`docker build -f nextjs_space/Dockerfile .`, output discarded). If the frozen install fails because the lockfile now lists `apps/mobile`, copy `apps/mobile/package.json` into the deps stage (the `--filter "@fotoai/legacy-web..."` install still skips its dependencies) and rebuild. Record the image size before and after; it must not grow.
- [ ] **Step 5: Run the full gate** (`pnpm typecheck && pnpm lint && pnpm test`, the live app's tests, `next build`).
- [ ] **Step 6: Commit.** `git commit -m "feat(mobile): Expo SDK 58 app in the workspace"`

### Task A2: Theme tokens (`packages/ui`)

**Files:**
- Create: `packages/ui/package.json` (`@fotoai/ui`), `packages/ui/src/tokens.ts`, `packages/ui/src/contrast.ts`, `packages/ui/src/index.ts`, `packages/ui/src/nativewind.ts` (a NativeWind/Tailwind preset that maps tokens to CSS variables), `packages/ui/test/tokens.test.ts`.

**Interfaces:**
- `THEME_TOKENS: Record<'golden' | 'golden_dark' | 'camera', ThemeTokens>` (the ids in `THEMES` from `@fotoai/contracts`). `ThemeTokens` = `{ colors: { bg, surface, surfaceAlt, text, textMuted, primary, onPrimary, accent, onAccent, border, success, warning, danger, onDanger }, radius: { sm, md, lg, pill }, font: { body, display, mono }, dialStyle: boolean }` (`dialStyle` is true only for `camera`).
- `resolveTheme(setting: Theme | 'auto', system: 'light' | 'dark'): Theme` — `auto` gives `golden` or `golden_dark`.
- `contrastRatio(fg, bg): number` (WCAG relative luminance).
- `TEXT_PAIRS`: the text/background pairs the app uses (text on bg, text on surface, textMuted on bg and surface, onPrimary on primary, onAccent on accent, onDanger on danger).
- Golden light colours follow the locked mockups (`phone-looks-7.html` look A, `golden-more.html`) as inspiration only; values are chosen to pass AA.

- [ ] **Step 1: Write the failing tests:** `every theme has every token`; `every text pair meets 4.5:1 in every theme` (the audit found white on orange at about 2.8:1: that pair must be absent or fixed); `auto follows the system between golden and golden_dark`; `only the camera theme uses the dial style`; `the theme ids match THEMES from contracts`.
- [ ] **Step 2: Run them and confirm they fail.** Then write the tokens and the helpers, and run them again.
- [ ] **Step 3: Commit.** `git commit -m "feat(ui): theme tokens with an AA contrast check"`

### Task A3: Env and the typed API client

**Files:**
- Create: `apps/mobile/src/lib/env.ts`, `apps/mobile/.env.example`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/__tests__/env.test.ts`, `apps/mobile/src/lib/__tests__/api.test.ts`.

**Interfaces:**
- `env`: a zod-checked object read once at start from `EXPO_PUBLIC_API_URL` (https URL), `EXPO_PUBLIC_SUPABASE_URL` (https URL), `EXPO_PUBLIC_SUPABASE_ANON_KEY` (non-empty), `EXPO_PUBLIC_SENTRY_DSN` (optional). A bad or missing value shows a full-screen "App not configured: <names>" state, never a crash and never the values.
- `createApi({ baseUrl, getToken, refresh, fetch })` returns `request<T>(path, { method?, body?, schema, signal? }): Promise<T>`:
  - sends `Authorization: Bearer <token>` and JSON;
  - parses the body with `schema` (from `@fotoai/contracts`); a mismatch is `ApiClientError('bad_response')`;
  - a `{ error, code }` body becomes `ApiClientError(code, status, message)` (through `parseApiError`);
  - a network failure or timeout (20 s) is `ApiClientError('offline')`;
  - on a 401 it calls `refresh()` once and retries once; a second 401 signs the user out.
- `ApiClientError` exposes `code`, `status`, `message` and `retryable` (`offline`, `upstream`, `rate_limited` and 5xx are retryable).

- [ ] **Step 1: Write the failing tests:** `a missing env value names the variable, not the value`; `the bearer token is sent and no user id is ever added`; `an error envelope becomes an ApiClientError with the server message`; `a response that fails its schema is bad_response`; `a network error is offline and retryable`; `a 401 refreshes once and retries once; a second 401 signs out`.
- [ ] **Step 2: Run them and confirm they fail.** Then implement, and run them again.
- [ ] **Step 3: Commit.** `git commit -m "feat(mobile): env checks and a contract-typed API client"`

### Task A4: Sign-in with an encrypted session

**Files:**
- Create: `apps/mobile/src/auth/storage.ts`, `apps/mobile/src/auth/supabase.ts`, `apps/mobile/src/auth/session.tsx` (provider and `useSession`), `apps/mobile/app/(auth)/sign-in.tsx`, tests in `apps/mobile/src/auth/__tests__/`.

**Interfaces:**
- `encryptedStorage`: the storage adapter pattern from the Supabase Expo guide. A random AES key is kept in `expo-secure-store`; the session JSON is AES-encrypted and kept in the app's own store. (SecureStore values are limited to about 2 KB, and a Supabase session can be bigger.)
- `supabase`: `createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: encryptedStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`. Auto refresh starts and stops with the app's foreground state (`AppState`).
- Sign-in screen: email and password, `signInWithPassword`; errors from Supabase Auth are shown in plain words (wrong email or password, email not confirmed, too many tries, offline). "Create account" and "Forgot password" open the website (decision 2).
- `useSession()`: `{ status: 'loading' | 'signed_out' | 'signed_in', session, signOut }`. Sign-out clears the stored session and the query cache.

- [ ] **Step 1: Write the failing tests** (fake Supabase client; no real account): `the session is stored encrypted, never as plain JSON`; `a stored session restores signed_in at start`; `a wrong password shows "Wrong email or password" and stores nothing`; `sign-out clears the session and the cache`; `the sign-in screen never logs the password or the token`.
- [ ] **Step 2: Run them and confirm they fail.** Then implement, and run them again.
- [ ] **Step 3: Check a fresh user against the v2 API.** Write an API integration test in `packages/api` (local stack): a user made with the admin API who never used the web login calls `GET /api/v2/me`, `/api/v2/me/preferences`, `/api/v2/challenges/active` and `/api/v2/me/loadout`, and each answers 200 with defaults (the live web login seeds default rows; the app's sign-in does not). If one fails, record it for 3B (no server change in 3A).
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): email sign-in with an encrypted session"`

### Task A5: The 5-tab shell and the Coach button

**Files:**
- Create: `apps/mobile/app/(tabs)/_layout.tsx`, `today.tsx`, `explore.tsx`, `shoot.tsx`, `photos.tsx`, `me.tsx`; `apps/mobile/src/ui/ThemeProvider.tsx`, `apps/mobile/src/ui/states.tsx` (`Loading`, `Empty`, `ErrorState`, `OfflineBanner`), `apps/mobile/src/ui/CoachButton.tsx`, `apps/mobile/src/data/query.ts` (TanStack Query client: retries only for retryable errors, no retry on 4xx); tests in `apps/mobile/src/ui/__tests__/` and `apps/mobile/app/__tests__/`.

**Interfaces:**
- Tabs: Today, Explore, Shoot, Photos, Me (lucide icons). Signed-out users see only the sign-in route.
- The Coach button floats on every tab and opens a sheet; in 3A the sheet says the coach comes in 3F.
- The theme provider reads the theme setting (device-local in 3A, saved to preferences in 3C) and the system scheme, and applies the NativeWind variables from `@fotoai/ui`.
- Each tab is a placeholder that makes one real call to prove the wiring: Me shows `GET /api/v2/me` (email), Today shows `GET /api/v2/challenges/active`.

- [ ] **Step 1: Write the failing tests:** `signed out shows sign-in, signed in shows the 5 tabs`; `the Coach button is on every tab`; `ErrorState shows the message and Retry calls the query again`; `an offline error shows the offline banner, not a crash`; `changing the theme setting re-colours the screen`.
- [ ] **Step 2: Run them and confirm they fail.** Then implement, and run them again.
- [ ] **Step 3: Commit.** `git commit -m "feat(mobile): 5-tab shell, states and the Coach button"`

### Task A6: CI and the EAS profile

**Files:**
- Modify: `.github/workflows/ci.yml` (new job `mobile`).
- Create: `apps/mobile/eas.json`, `apps/mobile/CHECKLIST.md` (the phone checklist, 3A section), `apps/mobile/README.md` (run, test, build, env).

**Interfaces:**
- CI job `mobile`: checkout, pnpm, Node 22, `pnpm install --frozen-lockfile`, then `pnpm --filter @fotoai/mobile typecheck lint test`, `npx expo-doctor`, `pnpm --filter @fotoai/mobile export:android` (bundle only, no native build, no secrets).
- `eas.json`: profile `preview` = Android `buildType: apk`, `distribution: internal`; env from EAS environment variables (the public `EXPO_PUBLIC_*` values). Profile `production` is not used in phase 3.
- `CHECKLIST.md` 3A: install the APK; sign in; see the 5 tabs; the Coach button opens; switch the theme; sign out and back in; turn on airplane mode and see the offline banner.

- [ ] **Step 1:** Add the job and the files; push the branch; CI must be green in all four jobs (`verify`, `workspace`, `image`, `mobile`).
- [ ] **Step 2: Commit.** `git commit -m "ci(mobile): typecheck, lint, test and bundle the app"`

### Task A7: 3A release

- [ ] One fresh reviewer checks the whole branch; one fix pass; push; open the PR; CI green.
- [ ] **Stop for Seun's yes** to merge (no production change, but the merge changes the workspace the live image builds from: the `image` job must be green).
- [ ] After the merge, and **after Seun has logged in to EAS on this PC**, ask for a yes to run `eas build --profile preview --platform android` (cloud). Send Seun the install link. Seun runs the 3A checklist and reports.

---

## Sub-phase 3B: Server gaps for the app (task level; expanded before it starts)

**Ships:** read endpoints for Me, a new challenge from Today, Analyse on a v2 photo, the Auto theme, and any fresh-user default found in A4. **Production:** one migration and one deploy (Seun's yes for each).

### Task B1: Fresh-user defaults
- Fix every gap the A4 check found, so a user who signs in only from the app gets 200 with defaults from every v2 read (get-or-create in the handler, user token).
- Test: the A4 integration test, now passing for every endpoint.

### Task B2: `GET /api/v2/me/progress`
- Returns `{ xp: { total, level, levelStart, nextLevelAt }, streak: { current, longest, lastCompletionDate }, challenges: { completed, issued }, skills: SkillDto[] }`, using the skill tree and level rules in `@fotoai/core` and the caller's `fotoai_user_skills` and `fotoai_user_progress` rows.
- `SkillDto`: id, name, category, tier, icon, prerequisites, status, currentXP and the three thresholds (the live `/api/skills` shape, in camelCase).
- Tests: a new user is level 1 with empty skills shown as available or locked; XP totals match the rows; another user's rows never show.

### Task B3: `POST /api/v2/challenges` (a new challenge from Today)
- Body `{ type?: <the live challenge types>, force?: boolean }` → `{ challenge, created }`. Without `force`, today's open dashboard challenge is returned (200, `created: false`). A new one is saved `pending` with `source = 'dashboard'`; older ones are never overwritten.
- A versioned prompt `packages/ai/src/prompts/challenge.v1.ts` (structured output, **no location field**), fed with the weakest skills, preferences (`avoidsStyles`), the loadout and today's weather at the home location when set.
- Rate limit `challenge_generate: 20` per hour (the live value); the issued counter goes up, as the live generator does.
- Tests (mock model): `a forced call makes a new pending challenge and keeps the old one`; `no location is stored`; `the 21st call in an hour is 429 and the model is not called`.

### Task B4: Analyse a photo, and the Auto theme (migration)
- Migration `2026MMDDhhmmss_photo_analyses_and_auto_theme.sql`:
  - `fotoai_photo_critiques` gains `photo_id uuid` (composite FK `(photo_id, user_id)` → `fotoai_photos (id, user_id)` `on delete set null (photo_id)`), `mode text not null default 'critique' check in ('critique', 'editing', 'recreate')`, and `details jsonb` (editing steps or recreate settings);
  - the `fotoai_user_preferences.theme` CHECK is replaced, in one transaction, to also allow `auto`.
- Undo guarded: refuses while any row has `photo_id` set or `mode <> 'critique'`, or any theme is `auto`.
- `POST /api/v2/photos/:id/analyse` `{ mode }` → `{ analysis }`. Only for a ready photo whose check says safe (an unchecked photo is checked first). The model sees the photo on a 120-second signed link plus the EXIF and the linked step's brief as data. Critique scores award critique XP (service role, duplicate-safe, the live rule). Rate limit `photo_analyse: 30` per hour.
- `GET /api/v2/photos/:id/analyses` → the photo's analyses, newest first.
- Contracts: `THEMES` gains `auto` (the app's resolver already handles it).
- Tests: `an unsafe photo cannot be analysed`; `another user's photo is 404`; `critique XP is awarded once`; `editing and recreate store details and award no XP`; the undo refuses with data.

### Task B5: 3B release
- Review, fix pass, PR, CI. **Stop for Seun's yes**, then the pre-check, the migration with verify queries, the schema reload, the rollback pin, the merge, the deploy, the smoke checks plus a 401 check for each new route, and the log watch.

---

## Sub-phase 3C: Today and Me (task level)

**Ships:** APK only.
- **C1 Data layer:** one TanStack Query hook per endpoint, with keys in one file; the last good answer of each read is kept on the phone (expo-sqlite) and shown with "Last updated <time>" when offline.
- **C2 Today:** the next good light as a countdown (`GET /api/v2/conditions` at the home location or the phone's location), light times in the place's timezone, weather or "Weather unavailable", the active challenge with Continue, "New challenge" (B3), a suggested spot (a favourite spot, else none), "Plan my shoot" (to Shoot).
- **C3 Me:** XP bar, level, streak flame and skills from B2.
- **C4 My gear and loadout:** the catalog, add and remove gear, custom gear with the required capability fields, the loadout picker with the server's misfit errors shown at the field.
- **C5 Appearance and settings:** theme (Golden light, Golden dark, Camera body, Auto) saved with `PATCH /api/v2/me/preferences`; units; home area; sign out.
- **C6 Onboarding** on the first sign-in with no gear: add gear (Seun's kit is a one-tap catalog list) and set the home area (location permission or a typed place).
- **Tests:** every screen renders its loading, empty, error and offline states; the theme choice survives a restart. **Checklist:** 3C section.

## Sub-phase 3D: Explore (task level)

**Ships:** APK only. Needs both Google keys (prerequisites).
- **D1 Map:** react-native-maps with the Google provider, the Android key from an EAS environment variable through `app.config.ts`. With no key or a failed load, a list-only Explore with a clear "Map unavailable" note.
- **D2 Nearby and search:** markers and a list from `GET /api/v2/explore/nearby` and `/search` around the user (location permission) or the home area. "Places unavailable" when the server has no key (the server's `config` error).
- **D3 Place sheet and detail:** photo (`/places/:id/photo`), facts, best light and angles (`/explain`), walk distance as a straight line.
- **D4 My spots:** drop a pin, name it, add notes, favourite, delete; shown as "My spot".
- **D5 Plan a shoot here:** opens Shoot with the place or spot filled in.
- **Tests:** no place is drawn that did not come from the API; the map-unavailable path. **Checklist:** 3D section.

## Sub-phase 3E: Shoot and the offline field mode (task level)

**Ships:** APK only.
- **E1 Local store:** expo-sqlite tables `cache` (key, json, updated_at) and `outbox` (id, kind, path, method, body, attempts, next_try_at, created_at). Opened plans and the active roll are kept in `cache`.
- **E2 Sync engine:** runs on start, on reconnect (netinfo) and every 30 s while online; sends outbox items in order, with backoff; deletes an item only after a 2xx (or a 4xx the server will never accept, which is moved to a visible "Needs attention" list, never dropped silently). A badge shows how many records wait.
- **E3 New plan:** place or spot, date, loadout (body, lens, film), `POST /api/v2/plans`; the server's validation messages shown at the field.
- **E4 Plan view:** ordered steps with settings and times in the place's timezone; "Done" and "Skip" write to the outbox (`PATCH .../steps/:stepId` with `updatedAt`).
- **E5 Film:** load a roll (stock list, box speed, push or pull, exposures), a frame logger with the counter and an end-of-roll warning, the sunny 16 helper from `@fotoai/core`, and frame logging through the outbox with a client id.
- **Tests:** `a frame logged offline is sent once when back online`; `the outbox survives a restart`; `two taps on Done send one change`; `a step changed on the web later wins over an older offline change`. **Checklist:** 3E section with an airplane-mode run, a forced app kill and the return online.

## Sub-phase 3F: Photos and the Coach (task level)

**Ships:** APK only.
- **F1 Import:** pick from the gallery with EXIF (`expo-image-picker` with `exif: true`; `expo-media-library` with `ACCESS_MEDIA_LOCATION` for the location); EXIF is read before any change; HEIC becomes JPEG and the long side is cut to 3000 px (JPEG quality 0.9) with `expo-image-manipulator`; create, upload to the signed link and confirm run through the outbox with a client id, so a killed upload resumes.
- **F2 Library:** ready photos in a grid; detail with EXIF, place, the linked step and the check result; signed read links are fetched when shown (never stored).
- **F3 Rolls and scans:** roll list and detail; add scans in order; pair scan *n* with frame *n*, drag to fix; `POST /api/v2/rolls/:id/scans`.
- **F4 Analyse:** critique, editing tips and recreate (B4) on a photo, with the saved results listed.
- **F5 Coach sheet:** sends the screen and the open plan or roll as context; shows history; a proposed challenge opens its card; a proposed plan opens New plan filled in; "Clear history".
- **Tests:** `EXIF and GPS reach the create call`; `a resized photo keeps its EXIF in the create call`; `an upload killed half way resumes`; `a coach proposal opens the right screen`. **Checklist:** 3F section.

## Sub-phase 3G: Release (task level)

- **G1** Sentry in the app only when `EXPO_PUBLIC_SENTRY_DSN` is set; no photo, token or user text in events.
- **G2** The v1 internal APK (`preview` profile) on Seun's yes.
- **G3** Seun runs the full `CHECKLIST.md` on the phone; every failure becomes a fix task before phase 3 is closed.
- **G4** Docs: `apps/mobile/README.md`, the handoff, the phase ledger; offer phase 4.

## Out of scope for phase 3

- iOS builds, the Play Store, push notifications, the phone light meter (a spike in phase 6), live camera control (phase 6), the new web app (phase 4), turning on the scheduled jobs (Seun's open decision).
