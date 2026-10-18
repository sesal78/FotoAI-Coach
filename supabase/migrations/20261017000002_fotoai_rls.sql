-- FotoAI migration 0002: grants and owner policies (collision-first)
--
-- Depends on 0001_fotoai_schema.sql, which already committed every fotoai_
-- table with browser-role privileges revoked and RLS enabled (deny-all).
-- This file only ADDS the minimal grants and the owner (auth.uid()) policies
-- that the FotoAI server needs when it acts with the user's own token.
-- service_role keeps its default access (it bypasses RLS and is used only by
-- the server for signing, deletes, and XP awards).
--
-- Rules: no DROP, no IF NOT EXISTS, no GRANT ALL, no "to public", no change to
-- any object that does not start with fotoai_. Aborts if 0001 is not fully in
-- place (tables missing or RLS not enabled) or if any fotoai_ policy already
-- exists (a partial earlier apply that a human must investigate).
--
-- Apply later (not run by the build worker):
--   psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f 0002_fotoai_rls.sql

begin;

do $fotoai_guard$
declare
  v_expected text[] := array[
    'fotoai_user_preferences', 'fotoai_user_gear', 'fotoai_daily_challenges',
    'fotoai_challenge_submissions', 'fotoai_itineraries', 'fotoai_user_progress',
    'fotoai_agent_actions', 'fotoai_photo_critiques', 'fotoai_reverse_analyses',
    'fotoai_editing_recipes', 'fotoai_weekly_reports', 'fotoai_portfolio_analyses',
    'fotoai_user_skills', 'fotoai_xp_events'
  ];
  v_missing text;
  v_hit text;
begin
  select string_agg(e.name, ', ') into v_missing
  from unnest(v_expected) as e(name)
  where not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = e.name and c.relkind = 'r'
  );
  if v_missing is not null then
    raise exception 'FOTOAI_PRECONDITION: apply 0001 first; missing tables: %', v_missing
      using errcode = '42P01';
  end if;

  select string_agg(p.tablename || '.' || p.policyname, ', ') into v_hit
  from pg_policies p
  where p.schemaname = 'public' and p.policyname like 'fotoai\_%';
  if v_hit is not null then
    raise exception 'FOTOAI_COLLISION: fotoai_ policies already exist: %', v_hit
      using errcode = '42710';
  end if;

  -- 0001 must have left every table deny-all: RLS enabled, no browser privileges.
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any (v_expected) and not c.relrowsecurity;
  if v_missing is not null then
    raise exception 'FOTOAI_PRECONDITION: row level security is not enabled on: %', v_missing
      using errcode = '42501';
  end if;

  select string_agg(e.name, ', ') into v_hit
  from unnest(v_expected) as e(name)
  where has_table_privilege('anon', 'public.' || e.name, 'select')
     or has_table_privilege('authenticated', 'public.' || e.name, 'select, insert, update, delete');
  if v_hit is not null then
    raise exception 'FOTOAI_PRECONDITION: browser roles still hold privileges on: %', v_hit
      using errcode = '42501';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'FOTOAI_PRECONDITION: Supabase roles anon/authenticated/service_role are missing'
      using errcode = '42704';
  end if;
end
$fotoai_guard$;

-- ---------------------------------------------------------------------------
-- 1. Server-only XP award function (browser roles were revoked in 0001).
-- ---------------------------------------------------------------------------

grant execute on function public.fotoai_award_skill_xp(uuid, text, integer, text, uuid, integer, integer, integer, text[])
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Minimal grants for the authenticated role (server acts with the user's
--    own access token). anon gets nothing.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.fotoai_user_preferences      to authenticated;
grant select, insert, update, delete on table public.fotoai_user_gear             to authenticated;
grant select, insert, update, delete on table public.fotoai_daily_challenges      to authenticated;
grant select, insert, update, delete on table public.fotoai_challenge_submissions to authenticated;
grant select, insert, update, delete on table public.fotoai_itineraries           to authenticated;
grant select, insert, update, delete on table public.fotoai_user_progress         to authenticated;
grant select, insert                 on table public.fotoai_agent_actions         to authenticated;
grant select, insert, delete         on table public.fotoai_photo_critiques       to authenticated;
grant select, insert, delete         on table public.fotoai_reverse_analyses      to authenticated;
grant select, insert, delete         on table public.fotoai_editing_recipes       to authenticated;
grant select                         on table public.fotoai_weekly_reports        to authenticated;
grant select, insert, delete         on table public.fotoai_portfolio_analyses    to authenticated;
grant select                         on table public.fotoai_user_skills           to authenticated;
grant select                         on table public.fotoai_xp_events             to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Owner policies (RLS itself was enabled in 0001): every row is visible
--    and writable only to its owner.
-- ---------------------------------------------------------------------------

-- fotoai_user_preferences
create policy fotoai_user_preferences_select on public.fotoai_user_preferences
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_user_preferences_insert on public.fotoai_user_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_user_preferences_update on public.fotoai_user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_user_preferences_delete on public.fotoai_user_preferences
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_user_gear
create policy fotoai_user_gear_select on public.fotoai_user_gear
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_user_gear_insert on public.fotoai_user_gear
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_user_gear_update on public.fotoai_user_gear
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_user_gear_delete on public.fotoai_user_gear
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_daily_challenges
create policy fotoai_daily_challenges_select on public.fotoai_daily_challenges
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_daily_challenges_insert on public.fotoai_daily_challenges
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_daily_challenges_update on public.fotoai_daily_challenges
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_daily_challenges_delete on public.fotoai_daily_challenges
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_challenge_submissions (parent ownership is also enforced by the
-- composite foreign key on (challenge_id, user_id))
create policy fotoai_challenge_submissions_select on public.fotoai_challenge_submissions
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_challenge_submissions_insert on public.fotoai_challenge_submissions
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_challenge_submissions_update on public.fotoai_challenge_submissions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_challenge_submissions_delete on public.fotoai_challenge_submissions
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_itineraries
create policy fotoai_itineraries_select on public.fotoai_itineraries
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_itineraries_insert on public.fotoai_itineraries
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_itineraries_update on public.fotoai_itineraries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_itineraries_delete on public.fotoai_itineraries
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_user_progress
create policy fotoai_user_progress_select on public.fotoai_user_progress
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_user_progress_insert on public.fotoai_user_progress
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_user_progress_update on public.fotoai_user_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_user_progress_delete on public.fotoai_user_progress
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_agent_actions (append-only audit log for the owner)
create policy fotoai_agent_actions_select on public.fotoai_agent_actions
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_agent_actions_insert on public.fotoai_agent_actions
  for insert to authenticated with check (user_id = auth.uid());

-- fotoai_photo_critiques
create policy fotoai_photo_critiques_select on public.fotoai_photo_critiques
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_photo_critiques_insert on public.fotoai_photo_critiques
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_photo_critiques_delete on public.fotoai_photo_critiques
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_reverse_analyses
create policy fotoai_reverse_analyses_select on public.fotoai_reverse_analyses
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_reverse_analyses_insert on public.fotoai_reverse_analyses
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_reverse_analyses_delete on public.fotoai_reverse_analyses
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_editing_recipes
create policy fotoai_editing_recipes_select on public.fotoai_editing_recipes
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_editing_recipes_insert on public.fotoai_editing_recipes
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_editing_recipes_delete on public.fotoai_editing_recipes
  for delete to authenticated using (user_id = auth.uid());

-- fotoai_weekly_reports (written only by the scheduler with service_role)
create policy fotoai_weekly_reports_select on public.fotoai_weekly_reports
  for select to authenticated using (user_id = auth.uid());

-- fotoai_portfolio_analyses
create policy fotoai_portfolio_analyses_select on public.fotoai_portfolio_analyses
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_portfolio_analyses_insert on public.fotoai_portfolio_analyses
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_portfolio_analyses_delete on public.fotoai_portfolio_analyses
  for delete to authenticated using (user_id = auth.uid());

-- Derived XP state: read-only for the owner. No insert/update/delete policy
-- and no such grant, so direct browser-role writes fail (X10).
create policy fotoai_user_skills_select on public.fotoai_user_skills
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_xp_events_select on public.fotoai_xp_events
  for select to authenticated using (user_id = auth.uid());

-- Ask the shared PostgREST to pick up the new tables. This is a notification,
-- not a configuration change.
notify pgrst, 'reload schema';

commit;
