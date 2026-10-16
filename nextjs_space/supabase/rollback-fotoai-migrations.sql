-- rollback-fotoai-migrations.sql
--
-- FotoAI migration package rollback (runbook 87-FOTOAI-RUNBOOK.md, phase P2,
-- rollback R2). Reverses exactly what 0001_fotoai_schema.sql,
-- 0002_fotoai_rls.sql and 0003_fotoai_storage.sql created.
--
-- Written by Build, 2026-10-16, repo master 6a2c58e (runbook P2 task 2).
-- NOT RUN by the build worker. The DB credential FOTOAI_MIGRATION_DSN is not
-- in the store as of 2026-10-16, so this script is staged only.
--
-- An approved operator runs it later against the same DSN as the apply:
--   psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f rollback-fotoai-migrations.sql
-- One transaction: any error rolls the whole rollback back and leaves the
-- database exactly as it was.
--
-- Safety model:
--   * Named drops only. Every statement names a fotoai_* object or the single
--     'fotoai-submissions' bucket row. No wildcard delete, no ownership sweep.
--   * DROP without CASCADE. An unexpected dependent object (for example a view
--     someone built over a fotoai table) makes the drop fail and the whole
--     rollback abort. Nothing on the shared stack is cascaded away silently.
--   * The bucket row is deleted only when storage.objects holds zero rows for
--     it. If P3 migrated photos, this script refuses to run: removing user
--     data is a separate, approved action, never this rollback.
--   * IF EXISTS appears only on exact fotoai_* names, so a partially applied
--     package can still be cleaned. The final block then asserts that ZERO
--     fotoai_* objects remain; anything left aborts the rollback.
--   * Policies and grants created by 0002 die with their tables.
--   * Not touched: auth.users, the auth schema, extensions, roles, schemas,
--     other buckets, other tables, other policies, default privileges.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables, child-first, so the foreign keys between them do not block.
--    fotoai_photo_critiques -> fotoai_challenge_submissions
--    -> fotoai_daily_challenges. Every other table references only auth.users.
-- ---------------------------------------------------------------------------

drop table if exists public.fotoai_photo_critiques;
drop table if exists public.fotoai_challenge_submissions;
drop table if exists public.fotoai_daily_challenges;
drop table if exists public.fotoai_user_preferences;
drop table if exists public.fotoai_user_gear;
drop table if exists public.fotoai_itineraries;
drop table if exists public.fotoai_user_progress;
drop table if exists public.fotoai_agent_actions;
drop table if exists public.fotoai_reverse_analyses;
drop table if exists public.fotoai_editing_recipes;
drop table if exists public.fotoai_weekly_reports;
drop table if exists public.fotoai_portfolio_analyses;
drop table if exists public.fotoai_user_skills;
drop table if exists public.fotoai_xp_events;

-- ---------------------------------------------------------------------------
-- 2. Function and type from 0001. Function first: its return type is the
--    composite type, so the type cannot drop before the function.
-- ---------------------------------------------------------------------------

drop function if exists public.fotoai_award_skill_xp(
  uuid, text, integer, text, uuid, integer, integer, integer, text[]);
drop type if exists public.fotoai_xp_award_result;

-- ---------------------------------------------------------------------------
-- 3. Storage: the one policy on storage.objects and the one bucket row made
--    by 0003. Exact names; no other bucket or policy is touched. The whole
--    section is skipped if Storage is not installed (0003 cannot have run).
-- ---------------------------------------------------------------------------

do $fotoai_rollback_storage$
declare
  v_objects bigint;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'buckets'
  ) then
    return;  -- Storage not installed; 0003 never applied.
  end if;

  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
  ) then
    select count(*) into v_objects
    from storage.objects where bucket_id = 'fotoai-submissions';
    if v_objects > 0 then
      raise exception
        'FOTOAI_ROLLBACK_DATA: bucket fotoai-submissions holds % object(s); data removal needs its own approved step',
        v_objects
        using errcode = '55006';
    end if;
  end if;

  execute 'drop policy if exists fotoai_submissions_insert on storage.objects';
  delete from storage.buckets where id = 'fotoai-submissions';
end
$fotoai_rollback_storage$;

-- Tell the shared PostgREST the fotoai_ schema is gone (a notification only,
-- same as 0002).
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 4. Final assertion: the fotoai_ namespace must be empty, or this rollback
--    aborts and a human investigates.
-- ---------------------------------------------------------------------------

do $fotoai_rollback_verify$
declare
  v_left text;
begin
  select string_agg(n.nspname || '.' || c.relname, ', ' order by c.relname)
    into v_left
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'fotoai\_%';
  if v_left is not null then
    raise exception 'FOTOAI_ROLLBACK_INCOMPLETE: fotoai_ relations remain: %', v_left
      using errcode = '55006';
  end if;

  select string_agg(n.nspname || '.' || t.typname, ', ' order by t.typname)
    into v_left
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname like 'fotoai\_%';
  if v_left is not null then
    raise exception 'FOTOAI_ROLLBACK_INCOMPLETE: fotoai_ types remain: %', v_left
      using errcode = '55006';
  end if;

  select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
    into v_left
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'fotoai\_%';
  if v_left is not null then
    raise exception 'FOTOAI_ROLLBACK_INCOMPLETE: fotoai_ functions remain: %', v_left
      using errcode = '55006';
  end if;

  select string_agg(p.schemaname || '.' || p.tablename || '.' || p.policyname,
                    ', ' order by p.policyname)
    into v_left
  from pg_policies p
  where (p.schemaname = 'public' and p.policyname like 'fotoai\_%')
     or (p.schemaname = 'storage' and p.tablename = 'objects'
         and p.policyname like 'fotoai\_%');
  if v_left is not null then
    raise exception 'FOTOAI_ROLLBACK_INCOMPLETE: fotoai_ policies remain: %', v_left
      using errcode = '55006';
  end if;

  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'buckets'
  ) then
    if exists (select 1 from storage.buckets where id = 'fotoai-submissions') then
      raise exception 'FOTOAI_ROLLBACK_INCOMPLETE: bucket fotoai-submissions still exists'
        using errcode = '55006';
    end if;
  end if;
end
$fotoai_rollback_verify$;

commit;
