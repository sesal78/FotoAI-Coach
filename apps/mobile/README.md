# FotoAI for Android (`@fotoai/mobile`)

Expo SDK 58 app (Expo Router, NativeWind 4, TanStack Query). It talks only to `/api/v2/*` on the
live server and to Supabase Auth with the public anon key. Plan: `docs/superpowers/plans/2026-10-19-fotoai-phase3-android.md`.

## Config

Copy `.env.example` to `.env` for local runs. Every value is public (it ships inside the APK):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://myfoto.topues.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://supabase.techiesandbox.com` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the Supabase anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | optional (phase 3G) |

EAS builds read the same names from the FotoAI project's `preview` environment on expo.dev.

## Commands (from the repo root, with the Sandbox store)

```bash
pnpm --filter @fotoai/mobile typecheck
pnpm --filter @fotoai/mobile lint
pnpm --filter @fotoai/mobile test
pnpm --filter @fotoai/mobile export:android
```

`export:android` bundles the JavaScript into `D:/Homebase/Sandbox/fotoai-mobile-export` (outside the repo).

## Build the APK

```bash
cd apps/mobile
npx eas-cli build --profile preview --platform android
```

The `preview` profile makes an internal APK (not for the Play Store). EAS keeps the signing key.
Testing on the phone follows `CHECKLIST.md`.

## Notes

- Routes live in `src/app`; tests live outside it (`src/**/__tests__`, `test/`).
- `tsconfig.typecheck.json` pins React 19 types for the typecheck only: Metro and Jest read
  `tsconfig.json` paths as module aliases.
- Testing Library 14: `fireEvent` is async; await it. Expo Router keeps its store between
  renders, so a route test file renders the router once.
