# FotoAI refactor: plan index

**Spec:** `docs/superpowers/specs/2026-10-18-fotoai-refactor-design.md` (approved by Seun on 18 Oct 2026).

The spec covers six phases, and each phase depends on what the phase before it ships. So each phase gets its own plan, written when the phase before it is merged. Then each plan uses the real names and files that are in the repo by then. Every plan produces working, tested software.

| Phase | Plan file | Ships | Touches production? |
|---|---|---|---|
| 1. Foundation | `2026-10-18-fotoai-phase1-foundation.md` | pnpm + Turborepo workspace; `@fotoai/env`, `@fotoai/contracts`, `@fotoai/db` (supabase-js clients, generated types, Drizzle baseline); root local-Supabase project; CI for the workspace and the database | No. `nextjs_space/` is not changed. |
| 2. Core services | written after phase 1 merges | `packages/core` (rules lifted from `nextjs_space/lib/fotoai`, gear capability checks, film math); `packages/places` (Google Places, light, weather + fallback); `packages/ai`; challenge model fix; gear, places, plans, rolls and frames migrations; `/api/v2` handlers mounted in the live app (spec 5.2) | Yes. Migrations need Seun's approval, one by one, and a deploy with smoke tests. |
| 3. Android app | after phase 2 | `apps/mobile` (Expo): 5 tabs, themes, the full loop, film, offline queue; internal APK through EAS | APK only. The API is already live. |
| 4. Web in the new look | after phase 3 | `apps/web` mirrors the mobile screens, staging subdomain, then a Dokploy switch with rollback | Yes. Staging first, then switch on Seun's yes. |
| 5. Cleanup | after phase 4 + P5 burn-in | delete Appwrite code, 410 stubs and `nextjs_space/`; prune dependencies; rewrite docs | Yes. Each deletion needs Seun's yes. |
| 6. Spikes | after phase 5 | Fujifilm Camera Control SDK on Android; phone light-meter accuracy | No. The spikes are throwaway. |

**Known handover from phase 1 to phase 2:** in phase 1, `nextjs_space/` stays on npm with its own lockfile, outside the workspace. That keeps the live build exactly as it is. Phase 2 must change two things before the live app can import `@fotoai/*` packages:
- bring `nextjs_space/` into the pnpm workspace;
- change its Docker build context to the repo root.

The phase 2 plan owns that change and its deploy.
