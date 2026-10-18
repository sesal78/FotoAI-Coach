# End-to-end browser tests (local only)

App code lives in `nextjs_space/`; run the commands below from there unless a path says otherwise.

Playwright drives the real app in Chromium against a **local** stack:

- the app on `http://localhost:3007` (`next dev`)
- a local Supabase in Docker (API `http://127.0.0.1:54321`, Mailpit inbox `http://127.0.0.1:54324`)

The tests refuse non-local URLs. Never point them at production. Each run signs up a new
throwaway account (`e2e+<id>@localhost.test`) and confirms it through Mailpit, so no password is
stored anywhere.

## What the tests cover

| Test | Checks |
|---|---|
| sign up | sign-up, email confirmation link, `/login?verified=1`, log in |
| check 1 | a chat challenge shows on the dashboard after in-app navigation (no reload) |
| check 2 | a second, different chat challenge is kept (History has 2, "Continue" visible) |
| check 4 | a generated challenge shows live weather (skipped when Open-Meteo is down) |
| check 3 | "Continue this challenge" from History, then submit (201) |
| check 5 | deleting the access cookie: the next API calls renew it from the refresh cookie |
| check 6 | forgot password, email link, reset, old password rejected, new one works |

The chat and generation tests call the real LLM, so they need `OPENAI_API_KEY` and cost a few cents.

## One-time setup (Windows paths as used on the dev PC)

Keep installs, caches and Docker state out of the repo (Homebase rule: Sandbox only).

```bash
# a Sandbox worktree with dependencies
git worktree add D:/Homebase/Sandbox/fotoai-coach-e2e master
cd D:/Homebase/Sandbox/fotoai-coach-e2e/nextjs_space
npm ci
PLAYWRIGHT_BROWSERS_PATH=D:/Homebase/Sandbox/ms-playwright npx playwright install chromium

# a local Supabase project in the Sandbox, using the repo root's supabase/ folder (config + migrations)
mkdir -p D:/Homebase/Sandbox/fotoai-local-supabase
cp -r ../supabase D:/Homebase/Sandbox/fotoai-local-supabase/supabase
cd D:/Homebase/Sandbox/fotoai-local-supabase
npm_config_cache=D:/Homebase/Sandbox/npm-cache npx -y supabase@2.118.0 start
```

## Each run

1. Start the app on port 3007 with the **local** Supabase keys (`npx supabase@2.118.0 status -o json`
   gives `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`). Pass them only as environment variables:
   `FOTOAI_SUPABASE_URL`, `FOTOAI_SUPABASE_ANON_KEY`, `FOTOAI_SUPABASE_SERVICE_ROLE_KEY`,
   `FOTOAI_COOKIE_SECURE=false`, plus `OPENAI_API_KEY`. Do not write keys to files. Then
   `npx next dev -p 3007`.
2. Run the tests:

```bash
cd D:/Homebase/Sandbox/fotoai-coach-e2e/nextjs_space
PLAYWRIGHT_BROWSERS_PATH=D:/Homebase/Sandbox/ms-playwright npm run test:e2e
```

Expected on 18 Oct 2026: 6 passed, 1 skipped (Open-Meteo forecast was down).

## Notes

- Port 3007 is used because another local app holds 3000. In development the app accepts auth
  email links back to any explicit `localhost` port; production accepts only myfoto.topues.com.
- To test session renewal with a short token life, set `jwt_expiry = 120` in the local
  `config.toml` and restart Supabase. The committed config keeps the default 3600.
- Not run in CI yet: CI has no Supabase. Adding `supabase start` to CI is a later step.
