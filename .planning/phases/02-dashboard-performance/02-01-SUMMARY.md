---
phase: 02-dashboard-performance
plan: 01
subsystem: ui, api
tags: [react-query, tanstack, promise-allsettled, performance, dashboard]

# Dependency graph
requires:
  - phase: 01-auth-state-navbar
    provides: AuthProvider in layout, useAppwriteAuth hook
provides:
  - QueryClientProvider wired into App Router layout
  - Dashboard fetches parallelised with Promise.allSettled
affects: [02-02-react-query-hooks, 04-caching-deduplication]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-query v5 (activated — was installed but unused)"]
  patterns: ["useState-based QueryClient instantiation (App Router safe)", "Promise.allSettled for independent parallel fetches"]

key-files:
  created: [nextjs_space/components/query-provider.tsx]
  modified: [nextjs_space/app/layout.tsx, nextjs_space/app/dashboard/page.tsx]

key-decisions:
  - "QueryProvider inside AuthProvider — hooks can access auth context"
  - "Promise.allSettled over Promise.all — one failing endpoint must not block others"
  - "useState QueryClient — prevents shared cache between SSR requests"

patterns-established:
  - "QueryClient via useState in provider component (not module-level)"
  - "Promise.allSettled for multi-endpoint dashboard loading"

issues-created: []

# Metrics
duration: 10h (wall clock — includes user verification wait)
completed: 2026-02-21
---

# Phase 2 Plan 1: React Query Provider + Parallel Fetches Summary

**QueryClientProvider wired into App Router layout with useState pattern; dashboard fetches parallelised via Promise.allSettled eliminating sequential latency**

## Performance

- **Duration:** ~20 min active execution (subagent)
- **Started:** 2026-02-21T11:00:59Z
- **Completed:** 2026-02-21T20:55:48Z
- **Tasks:** 3 (2 auto + 1 verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Created `query-provider.tsx` with App Router-safe QueryClient (useState pattern, 5-min staleTime, retry 1, refetchOnWindowFocus)
- Wired QueryProvider into root layout: ThemeProvider > AuthProvider > QueryProvider > children
- Refactored `loadDashboardData()` from 4 sequential awaits to `Promise.allSettled` — all fetches fire simultaneously
- Each fetch result processed independently; localStorage fallback for challenges preserved
- Build passes cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QueryClientProvider wrapper** — `c8f5fb8` (feat)
2. **Task 2: Parallelise dashboard fetches with Promise.allSettled** — `c40acbf` (perf)

**Plan metadata:** (this commit)

## Files Created/Modified

- `nextjs_space/components/query-provider.tsx` — New: QueryClientProvider with useState-based QueryClient
- `nextjs_space/app/layout.tsx` — Modified: Added QueryProvider wrapping inside AuthProvider
- `nextjs_space/app/dashboard/page.tsx` — Modified: loadDashboardData() refactored to Promise.allSettled

## Decisions Made

- QueryProvider placed inside AuthProvider so React Query hooks can access auth context
- Promise.allSettled chosen over Promise.all to prevent one failing endpoint from blocking all others
- useState-based QueryClient instantiation to prevent shared cache between SSR requests in App Router

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing: ESLint v9 config incompatibility causes `yarn lint` / `npx next lint` to fail (not related to this plan)
- Pre-existing: SendGrid 401 during static page generation of email-test route (not related)

## Next Phase Readiness

- QueryClientProvider is in place — plan 02-02 (React Query hooks) can proceed
- No blockers

---
*Phase: 02-dashboard-performance*
*Completed: 2026-02-21*
