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

## Decided by Seun (19 Oct 2026)

1. **The APK is built with EAS in the cloud.** Seun has an Expo account and runs `npx eas-cli login` on this PC; EAS keeps the signing key.
2. **Sign-up and password reset are built into the app now** (not links to the website). How, without changing the shared Supabase Auth settings (checked read-only on 19 Oct 2026: email confirmation is on; the redirect allow list already has `https://myfoto.topues.com/verify-email/confirm` and `https://myfoto.topues.com/reset-password`):
   - **Sign up** in the app (`signUp` with `emailRedirectTo` = the web confirm page), then a "Check your email" screen with Resend. The email link confirms on the existing web page; the user then signs in in the app.
   - **Forgot password** in the app (`resetPasswordForEmail` with `redirectTo` = `https://myfoto.topues.com/reset-password`).
   - **New password in the app:** the app claims that https path as an Android App Link, so the email link opens the app's New password screen. It reads the recovery session from the link, sets the new password with `updateUser`, signs that session out and asks for a normal sign-in (a link carrying someone else's token never leaves the user signed in to that account). The link keeps working on the web when the app is not installed.
   - App Link verification needs `https://myfoto.topues.com/.well-known/assetlinks.json` with the EAS signing certificate's SHA-256. That file ships with the 3B deploy; until then the email link opens the web reset page, which already works.

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

### Task A4: Sign-in, sign-up and password reset, with an encrypted session

**Files:**
- Create: `apps/mobile/src/auth/storage.ts`, `apps/mobile/src/auth/supabase.ts`, `apps/mobile/src/auth/session.tsx` (provider and `useSession`), `apps/mobile/src/auth/messages.ts` (Supabase Auth errors in plain words), `apps/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx`, `check-email.tsx`, `forgot-password.tsx`, `reset-password.tsx`, tests in `apps/mobile/src/auth/__tests__/`.
- Modify: `apps/mobile/app.config.ts` (an Android intent filter with `autoVerify` for `https://myfoto.topues.com/reset-password`).

**Interfaces:**
- `encryptedStorage`: the storage adapter pattern from the Supabase Expo guide. A random AES key is kept in `expo-secure-store`; the session JSON is AES-encrypted and kept in the app's own store. (SecureStore values are limited to about 2 KB, and a Supabase session can be bigger.)
- `supabase`: `createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: encryptedStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`. Auto refresh starts and stops with the app's foreground state (`AppState`).
- Sign-in screen: email and password, `signInWithPassword`; errors from Supabase Auth are shown in plain words (wrong email or password, email not confirmed, too many tries, offline). Links to Create account and Forgot password.
- Sign-up screen: email, password (at least 8 characters) and confirm; `signUp` with `emailRedirectTo: https://myfoto.topues.com/verify-email/confirm`; then Check email (with Resend through `auth.resend({ type: 'signup' })`, at most once a minute). An email already in use gets the same Check email answer (no account probing).
- Forgot password: email; `resetPasswordForEmail(email, { redirectTo: 'https://myfoto.topues.com/reset-password' })`; always "If the email has an account, a link is on its way".
- Reset password (opened by the App Link): reads `access_token`, `refresh_token` and `type=recovery` from the link fragment; an expired or missing token shows "This link has expired" with a way to ask again; otherwise new password and confirm, `updateUser({ password })`, `signOut()`, then sign-in with "Password changed".
- `useSession()`: `{ status: 'loading' | 'signed_out' | 'signed_in', session, signOut }`. Sign-out clears the stored session and the query cache.

- [ ] **Step 1: Write the failing tests** (fake Supabase client; no real account): `the session is stored encrypted, never as plain JSON`; `a stored session restores signed_in at start`; `a wrong password shows "Wrong email or password" and stores nothing`; `sign-out clears the session and the cache`; `the sign-in screen never logs the password or the token`; `sign-up sends the web confirm page as the redirect and shows Check email`; `an email already in use gets the same Check email screen`; `forgot password always gives the same answer`; `a recovery link sets the new password, then signs out`; `an expired recovery link offers a new link and changes nothing`; `mismatched passwords are refused before any call`.
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
- `CHECKLIST.md` 3A: install the APK; create an account with a second email, confirm it from the email, sign in; ask for a password reset and finish it (on the web until the 3B App Link file is live); sign in; see the 5 tabs; the Coach button opens; switch the theme; sign out and back in; turn on airplane mode and see the offline banner.

- [ ] **Step 1:** Add the job and the files; push the branch; CI must be green in all four jobs (`verify`, `workspace`, `image`, `mobile`).
- [ ] **Step 2: Commit.** `git commit -m "ci(mobile): typecheck, lint, test and bundle the app"`

### Task A7: 3A release

- [ ] One fresh reviewer checks the whole branch; one fix pass; push; open the PR; CI green.
- [ ] **Stop for Seun's yes** to merge (no production change, but the merge changes the workspace the live image builds from: the `image` job must be green).
- [ ] After the merge, and **after Seun has logged in to EAS on this PC**, ask for a yes to run `eas build --profile preview --platform android` (cloud). Send Seun the install link. Seun runs the 3A checklist and reports.

---

## Sub-phase 3B: Server gaps for the app (step level, expanded 20 Oct 2026)

**Ships:** the Android App Link file, `GET /api/v2/me/progress`, `POST /api/v2/challenges` (a new challenge from Today), Analyse on a v2 photo (critique, editing tips, recreate) with a `GET` of its results, and the Auto theme. **Production:** one migration (`20261020100001`) and one deploy, each on Seun's yes.

**Facts this expansion is built on (read 20 Oct 2026):**
- A4's fresh-user check found no gap: preferences, the active challenge and the loadout all answer 200 for a user who never used the web login. So the old Task B1 has no work of its own; the new progress endpoint is tested for a fresh user (zeros, no rows needed).
- The live critique (`nextjs_space/lib/llm.ts` `critiquePhoto`) returns three 0–100 scores, three feedback texts, strengths, improvements and suggested settings. Critique XP (`nextjs_space/lib/fotoai/xp.ts` `awardCritiqueXP`) gives 50 XP per dimension above 70, split over that dimension's skills (technical: exposure_triangle, iso_management, depth_of_field, white_balance; composition: rule_of_thirds, leading_lines, framing, symmetry; creative: raw_editing, color_grading, exposure_correction), kind `critique_bonus`.
- The live recreate (`reverseEngineerPhoto`) returns estimated settings, lighting, camera position, lens, post-processing, a 5–8 step recipe, difficulty and gear. The live "editing" page compares a before and after pair; editing tips for one photo are new.
- `fotoai_photo_critiques`: users may select, insert and delete (no update); the key CHECK only needs the user's id as the first path part, so a v2 photo key fits.
- The live generator returns today's pending challenge unless forced (server-local day), stores the preference city as `location`, and bumps the issued counters. v2 keeps the rule but uses the home area's timezone (UTC when none), stores **no location**, and bumps the same counters.
- The theme CHECK is `fotoai_user_preferences_theme_check` (golden, golden_dark, camera). The live web app never reads the theme, so adding `auto` cannot break it.
- `/.well-known/` is not under the middleware matcher (`/dashboard`, `/chat` only) and `next.config` has no redirects, so a file in `nextjs_space/public/.well-known/` is served as is.

### Task B0: Android App Link file

**Files:** create `nextjs_space/public/.well-known/assetlinks.json`; extend `nextjs_space/tests/fotoai/v2-routes.test.ts`.

**Interface:** one statement: relation `delegate_permission/common.handle_all_urls`, target `android_app` / `com.topues.fotoai` / SHA-256 `88:AB:10:E2:6B:F7:1D:7D:95:AF:A0:17:F4:00:20:42:92:B8:5D:74:80:6A:C0:64:D5:A3:DD:C9:06:A5:6A:4D` (the EAS signing certificate, public data).

- [ ] **Step 1: Write the failing test:** `assetlinks.json parses, names com.topues.fotoai and the EAS SHA-256, and allows only handle_all_urls`.
- [ ] **Step 2: Run it (RED), add the file, run it again.**
- [ ] **Step 3: Commit.** `feat(web): Android App Link file for the FotoAI app`

### Task B1: `GET /api/v2/me/progress`

**Files:** create `packages/contracts/src/progress.ts` (`ProgressResponse`, `SkillDto`), `packages/api/src/progress.ts`, `nextjs_space/app/api/v2/me/progress/route.ts`; tests `packages/api/test/progress.integration.test.ts` and the route test.

**Interface:** `{ xp: { total, level, levelStart, nextLevelAt, progress }, streak: { current, longest, lastCompletionDate }, challenges: { completed, issued }, skills: SkillDto[] }`, from `getLevelFromXP` (`levelStart` = `xpForCurrentLevel`, `nextLevelAt` = `xpForNextLevel`) and the caller's `fotoai_user_skills` and `fotoai_user_progress` rows (user token). `SkillDto` = the live `/api/fotoai/skills` item: `id, name, category, description, prerequisites, tier, icon, xpToLearn, xpToPractice, xpToMaster, currentXP, status`. No progress row reads as zeros (a GET writes nothing).

- [ ] **Step 1: Write the failing tests:** `a new user is level 1 with zero XP and every skill available or locked by its prerequisites`; `XP totals and streak match the rows`; `another user's rows never show`; route test `401 without a token`.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(api): v2 progress, XP level and skills for Me`

### Task B2: One issued-counter rule

**Files:** modify `packages/core/src/challenges/rules.ts` (`issuedFieldForChallengeType`, `progressAfterIssue`), `nextjs_space/lib/fotoai/repo-generation.ts` (re-exports the map; behaviour unchanged), `packages/api/src/challenges.ts` (`recordIssued(client, principal, type, now)`), `packages/api/src/coach.ts` (uses `recordIssued` instead of its own bump).

- [ ] **Step 1: Write the failing tests:** core `the issued map matches the live one` and `progressAfterIssue bumps the total, the type counter and last_challenge_date`; the coach integration test (issued counter +1) stays green.
- [ ] **Step 2: RED, implement, GREEN** (core, api integration, the live app's tests).
- [ ] **Step 3: Commit.** `refactor(core): one issued-counter rule for the live app and v2`

### Task B3: `POST /api/v2/challenges` (a new challenge from Today)

**Files:** create `packages/ai/src/prompts/challenge.v1.ts` and `packages/ai/src/challenge.ts`; modify `packages/contracts/src/challenges.ts` (`CHALLENGE_TYPES`, `GenerateChallengeInput`, `GenerateChallengeResponse`), `packages/api/src/challenges.ts` (`generateChallenge`), `packages/api/src/rate-limit.ts` (`challenge_generate: 20`), `nextjs_space/app/api/v2/challenges/route.ts` (adds `POST`); tests `packages/ai/test/challenge.test.ts`, `packages/api/test/challenge-generate.integration.test.ts`, the route test.

**Interfaces:**
- Body `{ type?: WEEKEND_DEEP_DIVE | LUNCH_BREAK | AFTER_WORK | WFH_MICRO | STORY_DRIVEN | TECHNICAL_MASTERY, force?: boolean }` (strict) → `{ challenge, created }`: 201 when created, 200 when today's is returned.
- Order: sign-in, identity keys, body, AI configured; today's open dashboard challenge (pending, source `dashboard`, issued since the start of today in the home area's timezone, else UTC) unless `force`; then the `challenge_generate` reservation, the context, the model call, the insert (pending, source `dashboard`, `location = null`), `recordIssued`.
- Prompt `challenge.v1` (strict schema, **no location field**): `challengeText`, `category`, `difficulty`, `duration`, `tips`, `recommendedGear[]`, and the live extra fields for STORY_DRIVEN and TECHNICAL_MASTERY (`shotList`, `narrativeContext`, `editingDirection`, `masteryArea`, `technicalLevel` 1–5, `successCriteria`, `whatToLookFor`) as nullable. The context goes in the user message only: the type, skill level, interests, `avoidsStyles`, the loadout's names, the 5 weakest skills, the last 5 challenge texts, and today's weather at the home area when set.

- [ ] **Step 1: Write the failing tests:** AI `the instructions are fixed and the context is in the user message`, `the schema has no location field`; integration (mock model) `a first call creates a pending dashboard challenge with no location and bumps the issued counter`, `a second call returns the same one (200, created false) without calling the model`, `force makes a new one and keeps the old one pending`, `the 21st call in an hour is 429 and the model is not called`, `no AI key is a config error before the reservation`; route test `401 without a token`.
- [ ] **Step 2: RED, implement, GREEN** (full gate, integration, `next build`).
- [ ] **Step 3: Commit.** `feat(api): v2 new challenge from Today, with no location`

### Task B4: Migration: analyses on v2 photos, and the Auto theme

**Files:** create `supabase/migrations/20261020100001_photo_analyses_and_auto_theme.sql` and its undo; regenerate the types and the Drizzle baseline; modify `packages/contracts/src/preferences.ts` (`THEMES` gains `auto`) and the `packages/ui` theme-id test; tests `packages/db/test/analyses.integration.test.ts`, `packages/db/test/undo-scripts.test.ts`.

**Interfaces:**
- `fotoai_photo_critiques` gains `photo_id uuid` with FK `(photo_id, user_id)` → `fotoai_photos (id, user_id)` `on delete set null (photo_id)`, `mode text not null default 'critique' check (mode in ('critique', 'editing', 'recreate'))`, `details jsonb check (octet_length(details::text) <= 16000)`, and an index on `photo_id` where it is set. The grants stay select, insert, delete.
- In the same transaction, `fotoai_user_preferences_theme_check` is replaced to allow golden, golden_dark, camera and auto.
- Undo (guarded): refuses while any row has `photo_id` set or `mode <> 'critique'`, or any theme is `auto`; then restores the old CHECK and drops the three columns.

- [ ] **Step 1: Write the failing tests:** `an analysis can only link the owner's photo`; `a mode outside the three is rejected`; `theme auto is accepted`; undo unit `refuses while v2 analyses or auto themes exist`.
- [ ] **Step 2: RED; write the migration and undo, apply locally, regenerate, run the undo in a rolled-back transaction (empty: runs; with data: refused); GREEN.**
- [ ] **Step 3: Commit.** `feat(db): analyses on v2 photos and the Auto theme`

### Task B5: Analyse a photo

**Files:** create `packages/ai/src/prompts/critique.v1.ts`, `editing.v1.ts`, `recreate.v1.ts` and `packages/ai/src/analyse.ts`; create `packages/contracts/src/analyses.ts` (`AnalyseInput`, `AnalysisDto`); create `packages/api/src/analyses.ts`; modify `packages/api/src/privileged/xp.ts` (`awardCritiqueXp`), `packages/api/src/photos.ts` (export the check runner) and `packages/api/src/rate-limit.ts` (`photo_analyse: 30`); create the routes `nextjs_space/app/api/v2/photos/[id]/analyse/route.ts` (POST) and `nextjs_space/app/api/v2/photos/[id]/analyses/route.ts` (GET); tests `packages/ai/test/analyse.test.ts`, `packages/api/test/analyses.integration.test.ts`, the route test.

**Interfaces:**
- `POST /api/v2/photos/:id/analyse` `{ mode: critique | editing | recreate }` → `{ analysis: AnalysisDto }` (201). Order: sign-in, identity keys, id, body, AI configured, the `photo_analyse` reservation, the caller's ready photo (404 otherwise), the photo check (run it when the photo was never checked), refuse when the check is not safe (400 "This photo cannot be analysed"), the model call on a 120-second signed read link with the EXIF, the skill level, the loadout's names and the linked step's brief as data, the insert (user token), and for a critique the XP.
- Prompts (strict schemas, the photo as an image part, data only in the user message): `critique.v1` = the live critique fields with integer scores 0–100; `editing.v1` = `{ summary, steps: [{ tool, change, why }] (3–8), filmSimulation | null }`; `recreate.v1` = the live recreate fields.
- Storage: one `fotoai_photo_critiques` row per analysis, with `photo_id`, `mode` and the photo's `object_key`. A critique fills the score and feedback columns; editing and recreate put their answer in `details`.
- Critique XP (service role): the live rule, but with `source_id` = **the photo id**, so analysing the same photo again never earns more critique XP. Editing and recreate earn none.
- `GET /api/v2/photos/:id/analyses` → `{ analyses: AnalysisDto[] }`, newest first, the caller's only.
- `AnalysisDto` = `{ id, photoId, createdAt, mode: 'critique', critique }` or `{ ..., mode: 'editing', editing }` or `{ ..., mode: 'recreate', recreate }`.

- [ ] **Step 1: Write the failing tests:** AI `each mode sends the photo as an image part and its data only in the user message`, `scores outside 0–100 are refused by the schema`; integration (real local Storage, mock model) `a critique stores scores and awards critique XP`, `a second critique of the same photo awards no more XP`, `editing and recreate store details and award no XP`, `an unsafe photo cannot be analysed and the model is not called`, `an unchecked photo is checked first`, `another user's photo is 404`, `the 31st analysis in an hour is 429 and the model is not called`, `GET lists only the caller's analyses, newest first`; route tests `401 without a token` for both routes.
- [ ] **Step 2: RED, implement, GREEN** (full gate, integration, `next build`).
- [ ] **Step 3: Commit.** `feat(api): v2 Analyse (critique, editing tips, recreate) on checked photos`

### Task B6: 3B release

- [ ] One fresh reviewer checks the whole branch; one fix pass; push; PR; CI green in all four jobs.
- [ ] **Stop for Seun's yes.** Then: a read-only pre-check (no `photo_id`, `mode` or `details` columns yet; the theme CHECK as expected); apply `20261020100001` with verify queries; reload the schema cache; pin `rollback/pre-3b` at the current master; merge; deploy; smoke (the 2E-2b set, plus `GET /.well-known/assetlinks.json` → 200 JSON, and 401 for `GET /api/v2/me/progress`, `POST /api/v2/challenges`, `POST /api/v2/photos/<uuid>/analyse` and `GET /api/v2/photos/<uuid>/analyses`); a 10-minute log watch.
- [ ] After the deploy: Android checks App Links at install, so Seun reinstalls the APK (or installs the next one) and taps a reset email link, which should open the app's New password screen. That step goes into `CHECKLIST.md` 3B.

---

## Sub-phase 3C: Today and Me (step level, expanded 20 Oct 2026)

**Ships:** APK only. No migration, no deploy: every endpoint 3C calls is live (3B released 20 Oct 2026). **Production:** one EAS preview build on Seun's yes, then Seun's phone checklist.

**Facts this expansion is built on (read 20 Oct 2026, against `master` `876699d`):**
- Live and used by 3C: `GET /api/v2/me`, `GET /api/v2/me/progress`, `GET`/`PATCH /api/v2/me/preferences` (theme, units, home `{ lat, lng, label }`), `GET /api/v2/gear/catalog`, `GET`/`POST /api/v2/me/gear`, `DELETE /api/v2/me/gear/:id`, `GET`/`PUT /api/v2/me/loadout`, `GET /api/v2/me/spots` (each spot has `favourite`), `GET /api/v2/conditions?lat&lng` (`{ light, weather }`, weather may be null), `GET /api/v2/challenges/active`, `POST /api/v2/challenges`, `PATCH /api/v2/challenges/:id`.
- A loadout misfit is a 400 with one plain message (`{ error, code: 'validation' }`), not a field map. The app shows it under the loadout picker.
- `GOOGLE_MAPS_SERVER_API_KEY` is **not set** in Dokploy, so place search answers a config error. 3C sets the home area from the phone's location (with a label Seun can type). A typed place search comes with 3D, once the key is in.
- Light times are ISO strings in the place's own clock with its offset (`2026-10-20T19:41:10+11:00`), so the app shows the clock part as is. No timezone library is needed.
- Seun's kit is in the catalog: `fujifilm-x-t5`, `fujifilm-xf-23mm-f2-8`, `fujifilm-xf-70-300mm-f4-5-6`, `sigma-18-50mm-f2-8-dc-dn-x`, `ricoh-gr-iiix`, `nikon-fe2`, `pentax-me-super`, `yashica-electro-35-gl`, and their lenses.
- The 3A theme is saved on the phone only (expo-sqlite kv-store) and read after the first render (the cold-start flicker follow-up).
- New native modules need a new APK: `expo-location` and `@react-native-community/netinfo`. New JS packages: `@tanstack/react-query-persist-client` and `@tanstack/query-async-storage-persister`, both in the approved TanStack family.

**Rules for every 3C screen:**
- It shows a loading, an empty, an error (with the server's message and Retry) and an offline state. Tests cover all four.
- It reads through one hook per endpoint (C1). It never calls `fetch` itself.
- Colours come only from theme tokens. Touch targets are at least 44 dp, and every control has an accessibility role and label.

### Task C0: Dependencies, permissions and the 3B checklist line

**Files:** modify `apps/mobile/package.json` (via `npx expo install expo-location @react-native-community/netinfo`, then `pnpm add` of the two TanStack persist packages), `apps/mobile/app.config.ts` (the `expo-location` plugin with a when-in-use message only), `apps/mobile/CHECKLIST.md` (a 3B section: "Reinstall the APK and tap a reset email link: it opens New password"; passed 20 Oct 2026), `apps/mobile/src/__tests__/app-config-test.ts`.

- [ ] **Step 1: Write the failing test:** `the app asks for foreground location only: no background location permission, and the message says why`.
- [ ] **Step 2: RED, install, configure, GREEN.** The live checks stay green: the `image` and `verify` jobs, and the React isolation scan returns `(none)`.
- [ ] **Step 3: Commit.** `chore(mobile): location and network modules for Today`

### Task C1: Data layer: one hook per endpoint, kept on the phone

**Files:** create `apps/mobile/src/data/keys.ts` (every query key), `apps/mobile/src/data/hooks.ts`, `apps/mobile/src/data/persist.ts`, `apps/mobile/src/ui/LastUpdated.tsx`; modify `apps/mobile/src/data/client.ts` and `apps/mobile/src/app/_layout.tsx`; tests `apps/mobile/src/data/__tests__/hooks-test.tsx` and `persist-test.ts`.

**Interfaces:**
- Hooks: `useMe`, `useProgress`, `usePreferences`, `usePatchPreferences`, `useGearCatalog`, `useMyGear`, `useAddGear`, `useDeleteGear`, `useLoadout`, `usePutLoadout`, `useSpots`, `useConditions(at)`, `useActiveChallenge`, `useNewChallenge`, `usePatchChallenge`. Each one parses with its contract schema; each write invalidates the reads it changes (for example a completed challenge invalidates the active challenge and progress).
- Kept on the phone: reads are saved through the TanStack persister to expo-sqlite kv-store, for up to 7 days, keyed by the app version. Writes are never saved. Sign-out clears the saved copy along with the cache.
- Online state: NetInfo drives TanStack's `onlineManager`, so reads pause offline and refetch on reconnect.
- `<LastUpdated>` shows "Last updated 14:05" under a section when the phone is offline and the section shows saved data.

- [ ] **Step 1: Write the failing tests:** `a response that does not match the contract is an error state, never data`; `a saved read comes back after a restart (a new client on the same storage)`; `sign-out clears the saved reads`; `a write invalidates the reads it changes`; `offline with saved data shows Last updated <time>`.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): data hooks, saved reads and Last updated`

### Task C2: Today

**Files:** create `apps/mobile/src/lib/light.ts` (pure), `apps/mobile/src/lib/where.ts` (home area, else the phone's location), `apps/mobile/src/ui/today/` (`LightCard.tsx`, `WeatherCard.tsx`, `ChallengeCard.tsx`, `SpotCard.tsx`); rewrite `apps/mobile/src/app/(tabs)/today.tsx`; tests `apps/mobile/src/lib/__tests__/light-test.ts` and `apps/mobile/src/__tests__/today-test.tsx`.

**Interfaces:**
- `nextGoodLight(light, now)` returns the golden or blue window that is on now or comes next today, with `{ kind, phase: 'now' | 'next', start, end }`, or null (polar day or night, or nothing left today, then "Light returns tomorrow at <time>").
- `clockOf(iso)` returns `HH:MM` from the string's own clock.
- Where: the home area from preferences. Else the phone's location, after a one-time permission ask. Else a "Set your home area" card that opens Settings. Today never invents a place.
- Sections, top to bottom:
  - the countdown to the next good light, updated each minute;
  - sunrise, golden, blue and sunset times;
  - weather now (in the user's units) with its attribution, or "Weather unavailable";
  - the active challenge with Continue, or "No active challenge" with New challenge;
  - a suggested spot (the first favourite spot; hidden when there is none);
  - "Plan my shoot", which opens Shoot.
- New challenge calls `POST /api/v2/challenges`. A 201 or a 200 both show the challenge. A 429 or a config error shows the server's message.

- [ ] **Step 1: Write the failing tests:**
  - light: `the window on now is phase now`; `after golden evening the next is blue evening`; `after the last window the answer is null`; `a polar day has no windows`; `clockOf keeps the place's clock, not the phone's`.
  - screen: `Today uses the home area, then the phone's location, then asks for a home area`; `weather null shows Weather unavailable`; `New challenge shows the returned challenge on 201 and on 200`; `a 429 shows the server's message`; `the suggested spot is the first favourite and is hidden when there is none`; plus the loading, error and offline states.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): Today with light, weather, the challenge and a spot`

### Task C3: The challenge screen (Continue)

**Files:** create `apps/mobile/src/app/challenge/[id].tsx`; test `apps/mobile/src/__tests__/challenge-test.tsx`.

**Interface:**
- The screen shows the challenge text, tips, gear, and the extra fields when present: shot list, narrative, editing direction, mastery area and level, success criteria, what to look for.
- It shows only the buttons `CHALLENGE_MOVES` allows from the current status (Accept, Skip, Complete). Each one sends `PATCH /api/v2/challenges/:id`.
- A `changed: false` answer is shown as done, not as an error. Complete refreshes progress.

- [ ] **Step 1: Write the failing tests:** `a pending challenge offers Accept and Skip`; `an accepted one offers Complete and Skip`; `a completed one offers nothing`; `Complete refreshes progress`; `a 400 shows the server's message`.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): challenge detail with accept, skip and complete`

### Task C4: Me: progress and skills

**Files:** rewrite `apps/mobile/src/app/(tabs)/me.tsx`; create `apps/mobile/src/app/me/skills.tsx` and `apps/mobile/src/ui/me/ProgressCard.tsx`; test `apps/mobile/src/__tests__/me-test.tsx`.

**Interface:**
- The progress card shows the level and an XP bar from `levelStart` to `nextLevelAt`, with its label read aloud. It also shows the streak flame (current and longest) and the challenges done out of issued.
- Rows open My gear, Loadout, Skills and Settings.
- Skills lists the tree by category, with the status (locked, available, learned, practiced, mastered) and the XP to the next status.

- [ ] **Step 1: Write the failing tests:** `a fresh user shows level 1, an empty bar and no streak`; `the bar's label reads the XP numbers`; `skills are grouped by category with their status`; plus the four states.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): Me with XP, level, streak and skills`

### Task C5: My gear and the loadout

**Files:** create `apps/mobile/src/app/me/gear/index.tsx`, `apps/mobile/src/app/me/gear/add.tsx`, `apps/mobile/src/app/me/gear/custom.tsx` and `apps/mobile/src/app/me/loadout.tsx`; test `apps/mobile/src/__tests__/gear-test.tsx`.

**Interfaces:**
- My gear lists Seun's items. Remove asks first, then calls DELETE.
- Add shows the catalog with a search box (make or model). One tap adds an item; owned items are marked.
- Custom gear is one form for a body or a lens (react-hook-form with the contract's `CustomBodyInput` or `CustomLensInput`). Field errors show at the field; a server 400 shows at the top.
- Loadout:
  - The body list shows only bodies with capability data.
  - The lens list shows only lenses with capability data, and is hidden when the body has a fixed lens.
  - Film fields (stock, box ISO, rated ISO) show for a film body.
  - Save sends `PUT`. A misfit message shows under the picker, and nothing is saved.

- [ ] **Step 1: Write the failing tests:** `one tap adds a catalog item and marks it owned`; `remove asks first`; `a custom lens with an impossible aperture range shows the field error and sends nothing`; `a body with a fixed lens hides the lens picker`; `a film body shows the film fields`; `a misfit shows the server's message under the picker`; plus the four states.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): my gear, custom gear and the loadout`

### Task C6: Settings: appearance, units, home area, sign out

**Files:** create `apps/mobile/src/app/me/settings.tsx`; modify `apps/mobile/src/ui/ThemeProvider.tsx`; test `apps/mobile/src/__tests__/settings-test.tsx` and extend `apps/mobile/src/ui/__tests__/ui-test.tsx`.

**Interfaces:**
- Theme (Golden light, Golden dark, Camera body, Auto) changes at once on the phone and is then saved with `PATCH`. If the save fails, the phone keeps the choice and shows "Not saved to your account" with Retry.
- On sign-in the account's theme wins over the phone's copy. The phone's copy is read synchronously before the first frame (`getItemSync`), so there is no flicker.
- Units (metric or imperial) are saved with `PATCH` and used on Today.
- Home area: "Use my location" reads the phone's location (foreground, coarse) and saves it with an editable label. "Clear" removes it. A refused permission shows how to allow it in Android settings.
- Sign out clears the cache and the saved reads.

- [ ] **Step 1: Write the failing tests:** `the theme choice survives a restart and shows on the first frame`; `the account's theme wins on sign-in`; `a failed theme save keeps the choice and offers Retry`; `Use my location saves lat, lng and the label`; `a refused permission shows the settings hint`; `sign out clears saved reads`.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): settings with theme sync, units and home area`

### Task C7: Onboarding on the first sign-in

**Files:** create `apps/mobile/src/app/onboarding.tsx`; modify `apps/mobile/src/app/_layout.tsx` (the guard); test `apps/mobile/src/__tests__/onboarding-test.tsx`.

**Interface:**
- After sign-in, a user with no gear who has not finished or skipped onboarding goes to Onboarding. The phone keeps a flag, so it shows once.
- Step 1 adds gear from the catalog (one tap per item, as in C5), with a link to custom gear.
- Step 2 sets the home area (Use my location) or skips it.
- Done or Skip opens Today.

- [ ] **Step 1: Write the failing tests:** `a user with no gear sees onboarding once`; `a user with gear goes straight to Today`; `skip goes to Today and does not come back`; `one tap adds gear`.
- [ ] **Step 2: RED, implement, GREEN.**
- [ ] **Step 3: Commit.** `feat(mobile): first-run onboarding for gear and home area`

### Task C8: 3C release

- [ ] One fresh reviewer checks the whole branch; one fix pass; PR; CI green in all four jobs.
- [ ] Add `apps/mobile/CHECKLIST.md` section 3C: Today at home and away, New challenge, a challenge from accept to complete, Me numbers after the completion, add, remove and custom gear, the loadout misfit, theme after a restart, units, home area, onboarding on a new account, offline with "Last updated".
- [ ] **Stop for Seun's yes.** Then merge, and build the preview APK on EAS (Seun's Expo account). Seun installs it and runs the 3C checklist. There is no server change.

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
