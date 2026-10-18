# FotoAI Coach refactor: design

**Date:** 18 October 2026
**Owner:** Seun (the principal). **Status:** draft for owner approval.
**Inputs:**
- Code audit: `D:/Homebase/Research/AI-Opportunities/Repo-Refresh-2026-10/98-FOTOAI-CODE-AUDIT.md`
- Locked mockups: `D:/Homebase/Research/AI-Opportunities/Repo-Refresh-2026-10/.superpowers/brainstorm/18482-1792292557/content/`. The locked set is `phone-flow.html` (the core flow), `phone-looks-7.html` look A, and `golden-more.html`.

The live app (myfoto.topues.com) already runs on self-hosted Supabase. The Appwrite to Supabase move closed with G4 PASS on 17 Oct 2026. This refactor starts from master at `986aa2f`.

## 1. Intent: why we are doing this

Seun is a hobby photographer and opens FotoAI on an **Android phone** first. Seun wants an app to use for real when going out to shoot: personal use for a while, then a decision on whether to sell it.

Today the app guesses. It invents places, it gives camera advice without knowing the camera, and it loses challenges. The UI is a 10-item web menu. The refactor makes the app trustworthy, and builds it around one loop:

1. **Plan a shoot at a real place.** The app shows a true description, a photo, a map, and when the light is good.
2. **Follow a step-by-step shoot guide written for the gear Seun carries that day.** It says what to shoot, where to stand, the settings, and the lens, for digital or film.
3. **Bring the photos in and get feedback.** The app reads the real camera data and location from each photo, or from the shot log for film. It matches each photo to the planned shot and coaches on it.

Everything else (challenges, skills, XP, critique, editing tips, recreate, portfolio) stays, and hangs off this loop.

## 2. Goals, non-goals, anti-goals

**Goals**
- A native **Android app** (Expo) that does the whole loop well. Seun owns an Android phone.
- The **web app** gets the same look and the same features. It is responsive and still useful on a laptop.
- **Real places only.** They come from a place service, never from the AI's memory.
- **Gear-aware guidance.** It covers Seun's 2 digital and 3 film cameras, and every lens.
- **Film photography is supported as a first-class feature:** rolls, frames, a shot log, and scan matching.
- **Easier upkeep:**
  - one monorepo;
  - shared code between web and mobile;
  - typed contracts;
  - the standard Supabase client;
  - far fewer dependencies;
  - no Appwrite, Abacus or SendGrid leftovers.
- **Theme switch:** Golden light (the default), Golden dark, and Camera body, plus automatic light or dark. A new theme should cost only a set of colour tokens.
- **Metric units.** Times are shown in the timezone of the place.

**Non-goals for this refactor**
- An iOS build. Expo keeps it possible later, but nothing iOS-specific is built or tested now.
- Social features, AR overlays, and a voice coach. The reasons in `docs/ROADMAP.md` still hold.
- Payments, plans, or paywalls. Monetisation comes later.
- Live in-app camera control. It is a spike after the main build (see section 9).

**Anti-goals (a failure even if it "works")**
- The app names, describes or pins a place that did not come from the place service or from the user's own pin. For a user's own pin, the app must not invent facts about it.
- The guide recommends a setting the chosen camera or lens cannot do. Examples: 1/4000 on the Pentax ME Super, a manual shutter speed on the Yashica Electro 35 GL, or f/1.4 on the 28mm f/2.8.
- A challenge, plan, roll or photo record disappears, or is overwritten without the user asking.
- The app fails silently. Every failure of an outside service shows a clear state in the UI and is logged.
- The refactor breaks the live app before the replacement is proven. The current web app stays live until the new one passes its checks (section 10).

## 3. Constraints

- **Stack (approved palette, `~/.claude/rules/tech-stack.md`):**
  - pnpm workspaces and Turborepo;
  - Next.js (App Router) with TypeScript, shadcn/ui, Tailwind and Radix;
  - Expo (React Native) with TypeScript, NativeWind, Zustand and/or TanStack Query, and lucide-react-native;
  - zod, Drizzle ORM, and t3-env;
  - Vercel AI SDK, with Langfuse for tracing;
  - Trigger.dev for background and scheduled jobs;
  - Sentry and PostHog;
  - Vitest and Playwright;
  - Node 22.
- **Backend:** the existing shared self-hosted Supabase at `https://supabase.techiesandbox.com`. The `fotoai_*` tables and RLS policies stay. Schema changes go through migrations only, and they add to the schema. Existing users and data are kept.
- **Hosting:** the web app stays on Dokploy (app `UwuYPhnwvjoki-Cadpnvx`), built from the Dockerfile. All config is in environment variables, validated at boot, and listed in `.env.example`. There are three environments: local, staging and production.
- **Security rules from the migration that must survive:**
  - session-only identity (the server never trusts a user id from the browser or app);
  - owner-scoped queries under RLS with the user's token;
  - the service role is used only through guarded, per-user helpers.
- **Workspace:** the code lives in `D:/Homebase/Topues Studio/Portfolio/FotoAI-Coach`. Installs, builds and test runs happen in `D:/Homebase/Sandbox`. Work is done on feature branches and merged by PR; nothing is committed straight to master.
- **Email:** Resend only. SMTP and SendGrid code is removed.
- **Google Maps Platform terms:** store only `place_id` and coordinates long-term. Fetch names, photos and details fresh, or cache them only within what the terms allow.

## 4. Decided by Seun

- The core loop and the three-screen flow (mockup `phone-flow.html`).
- **Look: Golden light** (light and warm, built around the light times). Reference: https://dribbble.com/shots/27633929-Golden-Hour-Sunlight-Tracking-App-Design. The mockups are inspiration only; nothing is copied.
- **Borrowed parts:**
  - the **map-first Explore** from the "Trail map" look (reference https://dribbble.com/shots/27755810-Mobile-App-Trail-Companion-Hiking-Navigation), recoloured warm;
  - the **XP bar, level and streak** from the "Playful coach" look (reference https://dribbble.com/shots/25681527-Gamified-Learning-App-UI), shown on Me.
- **Navigation:** 5 tabs plus a floating Coach button on every screen.

  | Tab | Holds (old web menus) | New |
  |---|---|---|
  | Today | Dashboard: active challenge, history, Continue | light times, weather, suggested spot |
  | Explore | Locations, Recreate | real places on a map, with a photo and details |
  | Shoot | challenges in progress | shoot plans and the step-by-step guide, for digital or film |
  | Photos | Portfolio, Critique, Editing tips | gallery import, scan matching, rolls |
  | Me | Skills, Progress, Settings | XP, level and streak; My gear; Appearance (themes) |
  | Coach button | Chat | context-aware chat, available everywhere |

- **Themes:** Golden light (the default), Golden dark, and Camera body (dark, with dial-style settings), plus an automatic light or dark setting.
- **Gear (seed data for Seun's account):**

  | Camera | Type | Lenses |
  |---|---|---|
  | Fujifilm X-T5 | digital | Fujinon 23mm f/2.8, Fujinon 70-300mm, Sigma 18-50mm f/2.8 |
  | Ricoh GR IIIx | digital | fixed 26.1mm (40mm-equivalent) f/2.8 |
  | Nikon FE2 | film, 35mm SLR | 28mm f/2.8, 50mm f/1.4 |
  | Pentax ME Super | film, 35mm SLR | 28mm f/2.8, 50mm f/1.7 |
  | Yashica Electro 35 GL | film, rangefinder | fixed 40mm f/1.7 |

- **Film flow (mockup `golden-more.html`):**
  - each roll has a film stock, a box speed and an exposure count;
  - the guide holds ISO at the box speed and gives full manual or aperture-priority advice for that body;
  - a phone light meter is offered, with sunny 16 as the fallback;
  - a frame counter and a shot log record frame number, settings, place and time;
  - lab scans are matched to logged frames afterwards.
- **Photo import (v1):** the vendor apps move photos to the phone and add GPS. These are FUJIFILM XApp for the X-T5 and GR WORLD for the GR IIIx. FotoAI then picks photos from the phone gallery and reads EXIF and location. Bluetooth and live camera links come later (spike).
- **Offline in the field (18 Oct 2026, from the builder check):** with no signal, Seun must be able to open a plan, mark shots done and log film frames. These are saved on the phone and uploaded when the signal comes back. No frame may be lost.
- **Own spots (18 Oct 2026, from the builder check):** Seun can drop a pin for a spot Google does not list (for example a viewpoint or a beach), name it and add notes. It shows as "My spot". The AI uses only Seun's notes, the coordinates, the map, the light times and the weather for it.
- **The build choices in section 5 were played back to Seun.** Seun confirmed them on 18 Oct 2026: a native app plus the website, one shared base, Supabase kept, Google Places for real places, Open-Meteo with a backup weather source, sun times computed in code, metric units, and the build order in section 10.

## 5. How it is built: architecture

Seun confirmed this shape in chat. The details inside it are the builder's, unless marked otherwise.

### 5.1 Repository layout (pnpm + Turborepo)

```
apps/web        Next.js (latest stable, App Router, RSC + server actions), shadcn/ui, Tailwind 4
apps/mobile     Expo (latest SDK), Expo Router, NativeWind, Android first
services/jobs   Trigger.dev tasks: the 4 scheduled jobs + submission follow-ups (off until Seun turns them on)
packages/core   domain rules lifted from nextjs_space/lib/fotoai (challenges, XP, skills, gear capability checks, film math)
packages/contracts  zod schemas and DTOs shared by web, mobile and server
packages/db     Drizzle schema for the existing fotoai_* tables + new tables; RLS-aware query helpers
packages/ai     Vercel AI SDK calls, zod-validated outputs, versioned prompts, Langfuse tracing
packages/places Google Places + light/sun + weather adapters (with fallback)
packages/ui     design tokens (themes) shared by web (CSS variables) and mobile (NativeWind theme)
packages/env    t3-env schemas per app
```

The current `nextjs_space/` app stays in the repo and keeps serving production until the new web app replaces it. After that, it is deleted in the cleanup phase.

### 5.2 API and auth

- One API under `/api/v2/*`. The web app and the mobile app both use it. Its contracts live in `packages/contracts`.
- **Where `/api/v2` runs (Claude's call):**
  - The handlers are framework-free and live in the packages.
  - During phases 2–3 they are mounted in the current production app, which is moved into the monorepo unchanged in phase 1. So the Android APK talks to the live API on real data, and no new container is needed on the memory-tight Dokploy host.
  - In phase 4, `apps/web` mounts the same handlers and takes over.
- The existing handler pattern stays: framework-free handlers with injected dependencies, wrapped per route. The `/api/fotoai/*` routes keep working for the old web app until it is removed.
- **Auth:**
  - Supabase Auth through supabase-js on mobile, with the session stored in secure storage;
  - `@supabase/ssr` on web, which replaces the hand-written `supabase-http.ts` and `session-refresh.ts`;
  - the API accepts a bearer token (mobile) or cookies (web);
  - identity always comes from the verified session.
- Rate limits on AI and Places calls are per user, as today (PR #5).

### 5.3 Places, maps, light and weather

- **Places:** Google Places API (New): nearby search, text search, place details and place photos. A server key is kept in env.
  - The AI never invents a place. It only ranks and explains places it was given, by `place_id`.
  - Store `place_id`, coordinates and Seun's own notes. Fetch the rest fresh.
- **My spots:**
  - A user pin has a name, coordinates and notes, and no `place_id`.
  - Prompts mark it as user-provided. The AI may describe only what the notes, the coordinates, the light and the weather support.
- **Maps:** mobile uses Google Maps on Android (react-native-maps), with its own restricted Android key. Web uses Google Maps JS or MapLibre (builder's call). The map shows the user, the spot, a walking route or line, and other nearby spots.
- **Light:** sunrise, sunset, golden hour, blue hour and moon times are computed in code (suncalc or an equivalent) for the place's coordinates and timezone. This needs no network, so it always works.
- **Weather:**
  - Open-Meteo is the main source, keeping the existing retry;
  - a second provider is the fallback (MET Norway Locationforecast suggested; builder's call);
  - metric units are used;
  - when both fail, the UI says "weather unavailable" and the guide carries on without it.

### 5.4 Gear model and capability checks

- **A gear catalog** (seeded, editable) holds camera bodies and lenses with their capability data:
  - for bodies: type (digital or film), modes (P/A/S/M or aperture-priority only), shutter range, flash sync, ISO range, metering, and fixed-lens flag;
  - for lenses: focal range and maximum aperture.
- **Seun's 5 cameras and 7 lenses are seeded first.** The data is checked against maker documents. Known facts that the checks must enforce:
  - the Nikon FE2 tops out at 1/4000 s;
  - the Pentax ME Super tops out at 1/2000 s;
  - the Yashica Electro 35 GL is aperture-priority only, so you set the aperture and the camera picks the shutter, and it has a fixed 40mm f/1.7 lens.
  - The builder looks up and records the remaining values, with sources.
- **Gear outside the catalog (Claude's call):** a user can add custom gear, but must enter the capability fields the checks need (type, modes, shutter range, ISO range; focal range and maximum aperture for lenses). The catalog is written only through seed migrations, so no admin UI is built.
- **A user's kit** is the bodies and lenses they own. A **shoot loadout** is what they carry today, for example "FE2 + 50mm + Portra 400".
- **Every setting the AI suggests is validated in `packages/core`** against the loadout before it is shown. An impossible value is clamped or re-asked, never shown.

### 5.5 Shoot plans and the guide

- **A shoot plan** has a main place, a date, a light window and a loadout. Each step may name its own place, so a multi-stop plan (the old itineraries) is simply steps at different places (Claude's call). It holds ordered **steps**. Each step has:
  - a title and a short "what and where to stand";
  - a target time;
  - settings (mode, aperture, shutter, ISO, focal length or lens, and white balance or film simulation on Fuji);
  - a lens swap note;
  - a "why".
- **The plan is generated by the AI** from structured input only: place facts, light times, weather, the loadout's capabilities, the film stock (if any), and Seun's skill levels. The output is checked against a zod schema and then by the capability checks.
- **Film specifics:**
  - ISO is locked to the loaded stock's box speed, unless Seun marks the roll as pushed or pulled;
  - the advice matches the body (aperture priority with a needle or LED check, or full manual);
  - the guide gives exposure fallbacks (sunny 16 and its adjustments for golden and blue hour);
  - it suggests a film stock for the light when a roll is not yet loaded.
- **In the field (offline-first, Seun's decision):**
  - An opened plan is stored on the phone.
  - Marking a shot done and logging a frame work with no signal. Each record gets an id on the device and is put in an upload queue that retries until the server confirms it. Saving the same record twice is harmless (idempotent upserts).
  - Frames are append-only, so there are no conflicts. For plan step status, the latest change wins.
  - The UI shows how many records are waiting to upload. The queue survives app restarts.
  - Sync is tested with the phone offline, killed, and back online.
- **Plans replace nothing.** A challenge can turn into a plan, and a plan can complete a challenge.

### 5.6 Film rolls and frames

- **Roll:** camera, film stock, box speed (and push or pull), exposure count (24 or 36, or custom), status (loaded, finished, at the lab, scanned), and dates.
- **Frame:** roll, frame number, the plan step it belongs to (optional), settings, place (coordinates), time, a note, and the matched scan photo (optional).
- **Frame counter:** each logged frame moves the counter on. The UI warns near the end of the roll.
- **Scan matching:** Seun adds the lab scans in order. The app pairs scan *n* with frame *n* by default. Seun can drag to fix gaps (an unlogged frame gets "add settings?"). Matched scans inherit the frame's settings, place and time, because scans have no useful EXIF.

### 5.7 Photos and import

- **Digital:** Seun picks photos from the Android gallery.
  - expo-media-library or the image picker is used, with the permission that unlocks photo location (`ACCESS_MEDIA_LOCATION`). Android removes GPS data from picked photos without it.
  - EXIF is read on the device: camera, lens, focal length, aperture, shutter, ISO, time and GPS.
  - The photo is matched to a plan step by time and place when possible.
- **Uploads** go to Supabase Storage (the existing bucket and policies). Large originals are resized on the device before upload. The builder chooses the size limit, but it must be big enough for critique.
- **Analyse actions on a photo:** critique, editing tips and recreate. These are one flow with three modes, replacing three copied pages.
- **Portfolio** lives under Photos.
- **Upload checks use fixed-answer AI checks** (enum outputs), not free text:
  - moderation and not-a-photo;
  - matches the brief (yes, partial or off-brief);
  - genre for XP routing.
  - These checks gate XP, so XP cannot be farmed through text.

### 5.8 AI layer

- All model calls go through `packages/ai`. It uses the Vercel AI SDK with OpenAI models, as today: `gpt-4o-mini` class for text and a vision model for critique. Every call has a timeout, one retry, a zod-validated output and a Langfuse trace with token use.
- **Prompts are versioned files.** User text is never put into system prompts. It is passed as clearly fenced user content.
- **Coach chat** knows where Seun is: the screen, the active plan or roll, the loadout, and Seun's weak skills. It can propose a plan or a challenge as a structured tool call, not a text convention.
- **Learning loop:** past critiques and skill levels feed new challenges and plans. The `avoidsStyles` preference is used.
- **openai-decisions:** the fixed-answer checks in 5.7 may use the shared openai-decisions service if it offers an app-callable endpoint. Otherwise they use enum-constrained structured output directly. This is the builder's call.

### 5.9 Challenges (kept, fixed for good)

- **Statuses:** pending → accepted → completed, skipped or superseded.
- A `source` column records where the challenge came from: dashboard, chat, plan or job.
- Challenges are never overwritten. There is one "active challenge" endpoint, a detail view with Continue, and a History list with filters and paging. The live fixes from PRs #6 and #7 keep their tests.

### 5.10 Themes and design tokens

- Colours, radii and type are tokens in `packages/ui`, mapped to CSS variables on web and to the NativeWind theme on mobile. A theme is one token set.
- **The 3 launch themes:**
  - Golden light;
  - Golden dark;
  - Camera body, which also switches settings blocks to the dial style.
- **The Auto setting** follows the system light or dark mode, between Golden light and Golden dark.
- Text contrast meets WCAG AA in every theme. The audit found white on orange at about 2.8:1, which must not repeat.

### 5.11 Gamification

- XP, level and streak use the existing rules (`lib/fotoai` XP and skills), moved into `packages/core`. They are shown on Me as a progress bar, the level, a streak flame and skill levels. Completing challenges earns XP, as today. A plan step earns XP only when it has a matched photo or a logged film frame; tapping "done" alone earns none (Claude's call). This needs a new `source_kind` value on `fotoai_xp_events`. Text claims never earn XP.

### 5.12 Jobs and email

- The 4 scheduled jobs move to Trigger.dev: daily challenge, streak manager, weather monitor and weekly report. Submission follow-ups move there too.
- **The jobs stay switched off until Seun says yes**, because they send email. This is an existing open decision.
- Email is sent through Resend from `noreply@topues.com`.

### 5.13 Observability and testing

- Sentry is used on web, mobile and the API. PostHog handles product analytics. Seun is the main user, so events are kept minimal.
- **Vitest** runs in `packages/*` and for the API handlers. The existing fake-Supabase tests are ported, and a real-Postgres test runs in CI against a migrated schema.
- **Playwright** runs the web end-to-end tests. The existing local-stack suite is kept and extended to the new loop.
- **Staging (Claude's call):**
  - The Dokploy host has no memory for a second Supabase stack.
  - Automated end-to-end tests therefore run against the local Supabase stack, both on the dev PC and in CI. They never run against production.
  - The staging web app is the new image on a staging subdomain, pointed at production Supabase. It is checked only by Seun with Seun's own account; agents never create accounts on production.
  - Free host memory is checked before the staging container is added.
- **Mobile:**
  - unit tests cover the logic;
  - core-loop testing on Seun's Android phone is **manual for v1**, stated as such, with a written checklist;
  - an automated mobile end-to-end tool is the builder's call, later.
- CI on GitHub Actions runs lint, typecheck and tests for every PR. The current setup ignores lint at build time; that ends.

## 6. Data changes (summary)

All of these changes add to the schema through migrations. Each new table has RLS that scopes rows to the owner.

**Migrations touch the shared production database. Each one is applied by hand (as today) only after Seun approves it, and it is tested first on the local stack** (Claude's call, following the approval rules).

**Old AI-invented places** in `fotoai_itineraries.spots` and `fotoai_daily_challenges.location` stay as read-only history, labelled "unverified (old app)". They are never shown on the map or used in new plans, and they are not migrated (Claude's call).

| Table (new unless noted) | Purpose |
|---|---|
| `fotoai_gear_bodies`, `fotoai_gear_lenses` | catalog with capability data (shared read; admin write) |
| `fotoai_user_gear` (existing, extended) | which bodies and lenses a user owns |
| `fotoai_places` | `source` (google or user), `place_id` (null for the user's own pins), name for user pins only, coordinates, user notes, favourites (no copied Google content) |
| `fotoai_shoot_plans`, `fotoai_plan_steps` | plans and steps with settings and status |
| `fotoai_film_rolls`, `fotoai_film_frames` | rolls and logged frames |
| `fotoai_photos` (existing photo or submission tables, extended) | source (gallery, scan or camera), EXIF fields, coordinates, links to step or frame |
| `fotoai_challenges` (existing, extended) | `status` values and the `source` column (section 5.9) |
| `fotoai_user_preferences` (existing, extended) | theme, units, home location |

The builder checks the exact existing table names against the live schema before writing migrations.

## 7. Screens (mobile first; web mirrors them)

| Tab | Screen | Key content |
|---|---|---|
| Today | Home | countdown to the next good light; light times and weather; suggested spot; active challenge with Continue; "Plan my shoot" |
| Explore | Map | map with the user and real spots; bottom sheet with place photo, description, walk time, weather, tags; "Plan a shoot here"; Recreate entry |
| Explore | Place detail | big photo, facts from Places, best light and best angle (AI-explained), Seun's notes |
| Shoot | Plan | loadout picker (body, lens, film stock); ordered steps with settings; roll tracker on film; mark done or log frame; phone meter (film) |
| Photos | Library | gallery import; rolls; scan matching; per-photo EXIF and place; Analyse (critique, editing, recreate); portfolio |
| Me | Profile | XP, level, streak, skills; My gear; Appearance; settings |
| (any) | Coach | chat sheet with screen context |

The mockup files are the visual reference for Golden light, Explore, the film guide, Photos (scans) and Me.

## 8. What happens to today's features

| Today | After the refactor |
|---|---|
| Dashboard challenge generator + chat challenges | one challenge model, created from Today, the Coach or a plan |
| Locations page (AI-invented spots, Melbourne hard-coded) | Explore with Google Places, centred on the user's location |
| Itineraries | become multi-stop shoot plans |
| Critique / Editing / Recreate (3 pages) | one Analyse flow with 3 modes, under Photos |
| Portfolio | under Photos |
| Skills / Progress | Me (XP, level, streak, skills) |
| Settings / onboarding | Me plus a short onboarding that sets up gear and home area |
| Chat (localStorage history) | Coach, with history stored per user on the server |
| Landing page | kept for logged-out visitors, in the new look; CTAs go to sign-up |

## 9. Spikes after the main build (throwaway until approved)

- **Live camera control on Android.** The Fujifilm Camera Control SDK supports the X-T5 and added Android in v1.32. The spike tests remote shutter, settings readout and image transfer from inside FotoAI. For the GR IIIx, it checks whether any supported control path exists beyond GR WORLD.
- **Phone light meter accuracy.** Phase 3 ships the sunny 16 and exposure-table helper. The phone meter is built only if this spike passes (Claude's call). The spike compares metering from the phone camera with the FE2 and ME Super meters. If the phone cannot get within about 1/2 stop, the meter ships labelled "estimate" or is cut, and sunny 16 remains.

## 10. Build order and release

The order was confirmed with Seun on 18 Oct 2026.

1. **Foundation:**
   - the monorepo skeleton, with the current app moved in unchanged;
   - `packages/env`, `contracts` and `db`;
   - supabase-js and `@supabase/ssr`;
   - CI with lint, typecheck and tests;
   - the current app still deploys exactly as today.
2. **Core services:**
   - the gear catalog and capability checks;
   - the places, light and weather adapters;
   - the shoot plan generator;
   - rolls and frames;
   - the challenge model fix;
   - the `/api/v2` routes with tests.
3. **Android app:** the 5 tabs, themes, the full loop, and film support. It is distributed to Seun as an internal APK through EAS, not the Play Store.
4. **Web in the new look:** it mirrors the mobile screens. It goes to staging first, then replaces `nextjs_space/` in production by a Dokploy switch. The old build stays ready for rollback.
5. **Cleanup** (each step needs Seun's yes):
   - delete Appwrite code and the 410 stubs after the P5 burn-in;
   - delete `nextjs_space/`;
   - prune dependencies;
   - rewrite stale docs;
   - remove the Abacus and SendGrid leftovers.
6. **Spikes** (section 9).

**Rollback:** the production web app switches only after staging passes the Playwright suite and Seun's checklist. The previous image stays deployable. All migrations add to the schema, so the old app keeps working against the new schema.

## 11. Left to the builder

- Exact library picks inside the palette: map library on web, sun-calculation library, EXIF reader, weather fallback, and a mobile end-to-end tool.
- Image size limits, cache lifetimes, and offline storage for plans.
- Turborepo task graph, CI caching, and Docker layout for the monorepo.
- Exact gear capability values beyond the facts in 5.4 (they must have sources).
- How to split each phase into PRs.

## 12. Open items (not blocking the plan)

- **Scheduled jobs:** on or off. This is Seun's call; they stay off until Seun decides.
- **P5 burn-in** and the timing of Appwrite teardown: Seun's call.
- **Outside service accounts (Claude's call on hosting):**
  - Sentry, PostHog, Langfuse, Trigger.dev and EAS use their cloud free tiers, because the Dokploy host has no spare memory.
  - Photos are never sent to Langfuse; only text and token counts are.
  - Seun creates the accounts (agents do not create accounts) before the phase that needs each one.
- **Google Maps Platform:** a billing account and keys (a server key and a restricted Android key) are needed before phase 2 can call Places. The free monthly allowance is expected to cover personal use.
