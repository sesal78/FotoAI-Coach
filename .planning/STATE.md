# Project State: Foto Photography Coach

## Current Position

Phase: 2 of 6 (Dashboard Performance)
Plan: 02-01 planned, 02-02 planned
Status: Ready to execute
Last activity: 2026-02-21 — Phase 2 plans created (02-01: provider + Promise.all, 02-02: React Query hooks)

Progress: █░░░░░░░░░ 17%

---

## Active Milestone

**v1.1 Improvements** — Phases 1–6

---

## Accumulated Context

### Architecture Decisions (v1.0)
- Auth: Appwrite email/password sessions. Session cookie: `foto_session`. Server-side: `createSessionClient(request)`. Client-side: `useAppwriteAuth()` hook.
- Database: Appwrite document collections (no SQL). All IDs in `lib/appwrite-collections.ts`.
- LLM: OpenAI direct (`https://api.openai.com/v1/chat/completions`), model `gpt-4o-mini`. All calls via `lib/llm.ts`.
- Cron auth: `CRON_SECRET` bearer token. Helper: `lib/cron-auth.ts` → `verifyCronRequest()`.
- File storage: Appwrite Storage bucket for photo submissions.
- Email: SendGrid via `lib/email.ts`.
- Weather: OpenWeatherMap via `lib/weather.ts`.

### Architecture Decisions (v1.1)

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01-01 | AuthProvider inside ThemeProvider | Both providers available to all children |
| 01-01 | useAppwriteAuth kept as proxy | Zero breaking changes for 5 existing consumers |

### Key File Locations
- App root: `nextjs_space/`
- Auth context: `contexts/auth-context.tsx`
- Auth hook (proxy): `hooks/useAppwriteAuth.ts`
- Appwrite server client: `lib/appwrite-server.ts`
- Appwrite client (browser): `lib/appwrite.ts`
- Collection IDs: `lib/appwrite-collections.ts`
- LLM functions: `lib/llm.ts`
- Chat route: `app/api/chat/route.ts`
- Scheduled routes: `app/api/scheduled/*/route.ts`
- Dashboard: `app/dashboard/page.tsx`
- Submissions: `app/api/submissions/route.ts`

### Known Issues / Carry-forwards
- ESLint 9.x + eslint-config-next 15.x version conflict (pre-existing, non-blocking)
- No automated tests exist; `yarn lint` is the only CI check
- `feedbackStatus` field does not yet exist in `challenge_submissions` (Phase 3 will add it)
- `emailOptIn` field does not yet exist in `user_preferences` (Phase 5 will add it)
- Weather cache fields do not yet exist in `user_preferences` (Phase 4 will add them)

---

## Blockers / Concerns

None at milestone start.

---

## Roadmap Evolution

- v1.0 Foundation: Core app built (Appwrite auth + database, OpenAI LLM, cron security hardening, dead code removal)
- v1.1 Improvements created: 6 phases — performance, reliability, security, UX hardening (2026-02-20)

---

## Session Continuity

Last session: 2026-02-21
Stopped at: Phase 2 planned, ready for execution (start with 02-01)
Resume file: None
