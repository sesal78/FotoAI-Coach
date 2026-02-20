# Project State: Foto Photography Coach

## Current Position

Phase: 1 of 6 (Auth State & Navbar)
Plan: Not started
Status: Ready to plan
Last activity: 2026-02-20 — Milestone v1.1 Improvements created

Progress: ░░░░░░░░░░ 0%

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

### Key File Locations
- App root: `nextjs_space/`
- Auth hook: `hooks/useAppwriteAuth.ts`
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

Last session: 2026-02-20
Stopped at: Milestone v1.1 initialization
Resume file: None
