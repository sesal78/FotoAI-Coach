# Project State: Foto Photography Coach

## Current Position

Phase: 2 of 6 (Dashboard Performance) — Complete
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-21 — Completed 02-02-PLAN.md

Progress: ███░░░░░░░ 33%

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
| 02-01 | QueryProvider inside AuthProvider | Hooks can access auth context |
| 02-01 | Promise.allSettled over Promise.all | One failing endpoint must not block others |
| 02-01 | useState QueryClient (not module-level) | Prevents shared cache between SSR requests |
| 02-02 | Shared interfaces in lib/types.ts | Challenge & UserProgress reusable across hooks and components |
| 02-02 | placeholderData from localStorage | Instant render before network response in usePendingChallenge |
| 02-02 | useInvalidateDashboard() pattern | Single callback invalidates all dashboard query keys after mutations |
| 02-02 | Mutations kept as imperative fetch | useMutation conversion deferred; keeps scope minimal |

### Key File Locations
- App root: `nextjs_space/`
- Auth context: `contexts/auth-context.tsx`
- Auth hook (proxy): `hooks/useAppwriteAuth.ts`
- Dashboard hooks: `hooks/use-dashboard-data.ts`
- Appwrite server client: `lib/appwrite-server.ts`
- Appwrite client (browser): `lib/appwrite.ts`
- Collection IDs: `lib/appwrite-collections.ts`
- Shared types: `lib/types.ts`
- LLM functions: `lib/llm.ts`
- Chat route: `app/api/chat/route.ts`
- Scheduled routes: `app/api/scheduled/*/route.ts`
- Query provider: `components/query-provider.tsx`
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

None.

---

## Roadmap Evolution

- v1.0 Foundation: Core app built (Appwrite auth + database, OpenAI LLM, cron security hardening, dead code removal)
- v1.1 Improvements created: 6 phases — performance, reliability, security, UX hardening (2026-02-20)

---

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed Phase 2 (Dashboard Performance), ready for Phase 3
Resume file: None
