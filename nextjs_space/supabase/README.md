# FotoAI Supabase path (local build, not applied)

This folder holds the FotoAI migration package for a **later, separately
approved** cutover to the existing shared self-hosted Supabase stack.

Nothing in this folder has been run against any Supabase instance. See
`FOTOAI-BUILD-REPORT.md` for what was built, what was tested, and what was not.

## Layout

| Path | Purpose |
|---|---|
| `migrations/fotoai/0001_fotoai_schema.sql` | 14 `fotoai_*` tables, indexes, `fotoai_xp_award_result` type, `fotoai_award_skill_xp()` |
| `migrations/fotoai/0002_fotoai_rls.sql` | Revokes inherited browser-role privileges, minimal grants, RLS + `fotoai_*` policies |
| `migrations/fotoai/0003_fotoai_storage.sql` | Private bucket `fotoai-submissions` + one owner-prefixed insert policy |
| `evidence/` | Local test log and migration hashes |
| `../lib/fotoai/` | Framework-free server code (identity, owner scope, object keys, signing) |
| `../app/api/fotoai/` | Thin Next.js route files that call `lib/fotoai/handlers` |
| `../tests/fotoai/` | Node test suite (`npm run test:fotoai`) |

## Rules every migration follows

- Starts with a `do $fotoai_guard$` block that **raises `FOTOAI_COLLISION`** if any
  target object already exists. Nothing is created before the guard passes.
- One transaction per file (`begin; ... commit;`). A failure leaves nothing behind.
- 0001 commits **secure-by-default**: browser roles are revoked and RLS is enabled
  on every table in the same transaction that creates them. If 0002 never runs,
  `anon`/`authenticated` still cannot touch a single FotoAI row.
- Only new names: tables/indexes/policies/functions start with `fotoai_`; the
  bucket is `fotoai-submissions`.
- No `DROP`, no `IF NOT EXISTS`, no `CREATE OR REPLACE`, no `GRANT ALL`, no
  grant `TO public`, no default-privilege, role, schema, or extension changes.
- `tests/fotoai/migrations.test.ts` enforces all of the above statically.

## Applying later (requires explicit approval; NOT done in this build)

Run in order with a role that can create tables in `public`, reference
`auth.users`, and insert into `storage.buckets` (the Supabase `postgres` role):

```bash
psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/fotoai/0001_fotoai_schema.sql
psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/fotoai/0002_fotoai_rls.sql
psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/fotoai/0003_fotoai_storage.sql
```

Expected first-apply result: exit code 0 for each file. Expected result of running
any file a second time: non-zero exit and the message
`FOTOAI_COLLISION: ...` with no change (this is the collision test that must be
run on a disposable Postgres before the shared apply).

## Rollback of a partial apply

Each file is atomic. If a file fails, nothing from that file exists. If a later
file fails, the earlier files remain and a human decides whether to remove the
`fotoai_*` objects. No rollback SQL is shipped on purpose: a `DROP` script is
exactly the kind of statement this package refuses to contain. Removal must be
a separately approved, human-run step.

## Application rollback

The Appwrite code path is untouched. The new routes live under `/api/fotoai/*`
and the old routes under `/api/*` keep working. Rolling back the app means
pointing the frontend back at `/api/*` (it still does today) and leaving the
`FOTOAI_*` environment variables unset.

## Local tests

```bash
cd nextjs_space
npm run test:fotoai
```

Needs Node ≥ 22.6 (built-in TypeScript type stripping, `node:test`); the
runner `tests/fotoai/run.mjs` refuses older versions with a clear message.
The app container (`Dockerfile`, Node 18) does not run the tests and is not
affected. No dependencies are installed by the tests. The suite uses an in-memory fake
Supabase client that emulates RLS and the Storage insert policy; it does not
prove Postgres behaviour.
