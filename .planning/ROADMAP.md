# Roadmap: Foto Photography Coach

## Overview

Foto is an AI-powered photography coaching platform. v1.0 delivered the core stack: Next.js 14 + Appwrite auth/database, challenge generation, photo submissions, itinerary planning, AI chat coach, and cron-based scheduled jobs. v1.1 focuses on hardening what exists — improving performance, reliability, security, and user experience without adding major new features.

## Domain Expertise

None configured.

## Milestones

- ✅ **v1.0 Foundation** — Core app built and deployed (Appwrite migration, OpenAI integration, cron security, dead code cleanup)
- 🚧 **v1.1 Improvements** — Phases 1–6 (in progress)

---

## 🚧 v1.1 Improvements (In Progress)

**Milestone Goal:** Harden the existing feature set — centralize auth state, parallelise data fetching, decouple slow operations, add deduplication and caching, and close remaining security/UX gaps identified in the feature audit.

---

### Phase 1: Auth State & Navbar — In progress

**Goal**: Replace per-component `/api/auth/me` calls with a shared React `AuthContext`. Fix navbar auth flicker caused by duplicate auth checks.

**Depends on**: v1.0 complete
**Research**: Unlikely (established React context pattern, no new libraries)

Plans:
- [x] 01-01: Create `AuthContext` + `AuthProvider` wrapping the app
- [ ] 01-02: Migrate `useAppwriteAuth` hook to consume context instead of fetching
- [ ] 01-03: Update navbar to use shared auth state (remove separate fetch)

---

### Phase 2: Dashboard Performance

**Goal**: Eliminate sequential data fetching on the dashboard. Parallelise challenge, progress, and gear API calls. Add React Query for caching and background refetch.

**Depends on**: Phase 1
**Research**: Likely (React Query integration into existing Next.js 14 App Router setup)
**Research topics**: React Query with App Router server/client boundary; invalidation patterns with Appwrite mutations

Plans:
- [ ] 02-01: Install and configure `@tanstack/react-query` with App Router provider
- [ ] 02-02: Replace sequential `await` dashboard fetches with `Promise.all` (immediate win)
- [ ] 02-03: Wrap dashboard queries in React Query hooks for caching + background refetch

---

### Phase 3: Photo Upload & Async Feedback

**Goal**: Decouple LLM feedback generation from the photo upload HTTP request. Upload responds immediately; feedback is generated asynchronously and stored. Add server-side file type and size validation.

**Depends on**: Phase 1
**Research**: Unlikely (async pattern using existing Appwrite + OpenAI; no new infra)

Plans:
- [ ] 03-01: Add server-side validation (file type allowlist, max size 10 MB) before Appwrite upload
- [ ] 03-02: Refactor `/api/submissions` to save submission immediately, trigger feedback async (fire-and-forget or background update)
- [ ] 03-03: Add `feedbackStatus` field (`pending` / `ready`) to `challenge_submissions` collection; poll from frontend

---

### Phase 4: Caching & Deduplication

**Goal**: Cache weather data per-user to avoid redundant API calls. Prevent duplicate challenge generation on cron re-runs. Skip itinerary generation when one already exists for the same location and date.

**Depends on**: Phase 2
**Research**: Unlikely (internal patterns — read-before-write, timestamp comparison)

Plans:
- [ ] 04-01: Add weather cache field to `user_preferences` (location + timestamp + data); skip OpenWeatherMap call if < 30 min old
- [ ] 04-02: Add cron idempotency check in `daily-challenge` route: skip if a challenge for today already exists for the user
- [ ] 04-03: Add itinerary dedup check: return existing itinerary if same `location` + `date` found, skip LLM regeneration

---

### Phase 5: Email Preferences

**Goal**: Allow users to opt out of email notifications. Store `emailOptIn` flag in `user_preferences`. Respect the flag in all `email.ts` send calls and scheduled routes.

**Depends on**: Phase 1
**Research**: Unlikely (no new email provider — extends existing SendGrid helpers)

Plans:
- [ ] 05-01: Add `emailOptIn` boolean attribute to `user_preferences` Appwrite collection (default `true`)
- [ ] 05-02: Gate all `sendEmail()` calls behind `user.emailOptIn` check
- [ ] 05-03: Add opt-out toggle to dashboard settings UI

---

### Phase 6: Chat Sync Robustness

**Goal**: Make the `<CHALLENGE_DATA>` extraction in `/api/chat` more resilient. Add a fallback regex pattern so challenges are still captured if the LLM formats the XML block slightly differently.

**Depends on**: Phase 1
**Research**: Unlikely (regex improvement to existing pattern in `app/api/chat/route.ts`)

Plans:
- [ ] 06-01: Audit current `<CHALLENGE_DATA>` extraction regex against 5+ realistic LLM output variants
- [ ] 06-02: Implement fallback: if XML tag parse fails, attempt JSON extraction via loose object-boundary regex
- [ ] 06-03: Add structured logging for extraction path taken (tag match / fallback / failed) to aid future debugging

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 1. Auth State & Navbar | v1.1 | 1/3 | In progress | - |
| 2. Dashboard Performance | v1.1 | 0/3 | Not started | - |
| 3. Photo Upload & Async Feedback | v1.1 | 0/3 | Not started | - |
| 4. Caching & Deduplication | v1.1 | 0/3 | Not started | - |
| 5. Email Preferences | v1.1 | 0/3 | Not started | - |
| 6. Chat Sync Robustness | v1.1 | 0/3 | Not started | - |
