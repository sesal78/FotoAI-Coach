-- FotoAI migration 0001: schema (collision-first)
--
-- Target: the existing shared self-hosted Supabase project. This file creates
-- ONLY new objects whose names start with fotoai_ inside schema public.
--
-- Rules enforced by this file:
--   * Aborts before any change if ANY fotoai_ relation, type, or function already
--     exists in public (the namespace must be empty on first apply).
--   * Commits secure-by-default: browser roles (anon, authenticated) have their
--     inherited privileges revoked and RLS is enabled (no policies) on every
--     table in this same transaction. There is no window in which a FotoAI
--     table exists without protection.
--   * No DROP, no IF NOT EXISTS, no CREATE OR REPLACE, no GRANT ALL, no change to
--     any existing object, no roles, no schemas, no extensions.
--   * Whole file is one transaction. A failure leaves nothing behind.
--
-- Apply later (not run by the build worker):
--   psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f 0001_fotoai_schema.sql
--
-- Requires: gen_random_uuid() (pgcrypto/PG13+ core) and auth.users, both present
-- on every Supabase project. The applying role needs CREATE on schema public and
-- REFERENCES on auth.users (the Supabase "postgres" role has both).

begin;

do $fotoai_guard$
declare
  v_hit text;
begin
  select string_agg(n.nspname || '.' || c.relname, ', ' order by c.relname)
    into v_hit
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'fotoai\_%';
  if v_hit is not null then
    raise exception 'FOTOAI_COLLISION: fotoai_ relations already exist: %', v_hit
      using errcode = '42P07';
  end if;

  select string_agg(n.nspname || '.' || t.typname, ', ' order by t.typname)
    into v_hit
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname like 'fotoai\_%';
  if v_hit is not null then
    raise exception 'FOTOAI_COLLISION: fotoai_ types already exist: %', v_hit
      using errcode = '42710';
  end if;

  select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
    into v_hit
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'fotoai\_%';
  if v_hit is not null then
    raise exception 'FOTOAI_COLLISION: fotoai_ functions already exist: %', v_hit
      using errcode = '42723';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
  ) then
    raise exception 'FOTOAI_PRECONDITION: auth.users is missing; this is not a Supabase database'
      using errcode = '42P01';
  end if;
end
$fotoai_guard$;

-- ---------------------------------------------------------------------------
-- User-owned tables. Every row carries user_id = auth.users.id and is deleted
-- with the account. Columns mirror the Appwrite collections in
-- scripts/appwrite-setup.ts; legacy_appwrite_id keeps the old document id for
-- a later, separately approved data import.
-- ---------------------------------------------------------------------------

create table public.fotoai_user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  skill_level text not null default 'intermediate'
    check (skill_level in ('beginner', 'intermediate', 'advanced', 'professional')),
  photography_interests text[] not null default '{}',
  avoids_styles text[] not null default '{}',
  work_days text[] not null default '{}',
  work_start_time text not null default '09:00',
  work_end_time text not null default '17:00',
  lunch_start_time text not null default '12:00',
  lunch_end_time text not null default '13:00',
  primary_photo_day text not null default 'Saturday',
  secondary_photo_days text[] not null default '{}',
  lunch_break_photography boolean not null default true,
  evening_photography boolean not null default true,
  wfh_flexibility boolean not null default true,
  adapt_to_weather boolean not null default true,
  adapt_to_calendar boolean not null default true,
  office_location text,
  home_location text,
  current_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.fotoai_user_gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  category text not null,
  brand text not null,
  model text not null,
  specs text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index fotoai_user_gear_user_idx on public.fotoai_user_gear (user_id);

create table public.fotoai_daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  challenge_type text not null,
  challenge_text text not null,
  difficulty text,
  category text,
  duration text,
  weather_conditions text,
  location text,
  recommended_gear text[] not null default '{}',
  tips text,
  issued_date timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'skipped', 'completed')),
  completed_date timestamptz,
  shot_list text[] not null default '{}',
  narrative_context text,
  editing_direction text,
  mastery_area text,
  technical_level integer check (technical_level between 1 and 5),
  success_criteria text,
  what_to_look_for text,
  created_at timestamptz not null default now(),
  constraint fotoai_daily_challenges_id_user_key unique (id, user_id)
);
create index fotoai_daily_challenges_user_issued_idx
  on public.fotoai_daily_challenges (user_id, issued_date desc);

-- Photo object keys are private Storage keys, never public URLs. The key must
-- start with the owning user's id so that Storage RLS and the server signer
-- agree on ownership. The pattern is duplicated verbatim in
-- lib/fotoai/object-keys.ts and 0003_fotoai_storage.sql; tests check they match.
create table public.fotoai_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  challenge_id uuid not null,
  photo_object_key text
    check (
      photo_object_key is null
      or (
        photo_object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'
        and split_part(photo_object_key, '/', 1) = user_id::text
      )
    ),
  photo_mime text,
  photo_bytes bigint check (photo_bytes is null or photo_bytes between 1 and 52428800),
  notes text not null default '',
  feedback text,
  rating integer check (rating is null or rating between 1 and 5),
  feedback_status text not null default 'pending'
    check (feedback_status in ('pending', 'ready')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fotoai_challenge_submissions_id_user_key unique (id, user_id),
  -- Owner-consistent parent: a submission can only point at a challenge that
  -- belongs to the same user.
  constraint fotoai_challenge_submissions_challenge_owner_fkey
    foreign key (challenge_id, user_id)
    references public.fotoai_daily_challenges (id, user_id) on delete cascade
);
create index fotoai_challenge_submissions_user_submitted_idx
  on public.fotoai_challenge_submissions (user_id, submitted_at desc);
create index fotoai_challenge_submissions_challenge_idx
  on public.fotoai_challenge_submissions (challenge_id);

create table public.fotoai_itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  location text not null,
  title text,
  description text,
  spots jsonb not null default '[]'::jsonb,
  suggested_times text[] not null default '{}',
  weather_conditions text,
  gear_recommendations text[] not null default '{}',
  duration text,
  status text not null default 'generated'
    check (status in ('generated', 'scheduled', 'completed')),
  generated_date timestamptz not null default now(),
  scheduled_date timestamptz,
  completed_date timestamptz,
  created_at timestamptz not null default now()
);
create index fotoai_itineraries_user_idx on public.fotoai_itineraries (user_id);

create table public.fotoai_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  total_challenges_issued integer not null default 0 check (total_challenges_issued >= 0),
  total_challenges_completed integer not null default 0 check (total_challenges_completed >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  saturday_challenges_completed integer not null default 0 check (saturday_challenges_completed >= 0),
  saturday_challenges_issued integer not null default 0 check (saturday_challenges_issued >= 0),
  lunch_break_completed integer not null default 0 check (lunch_break_completed >= 0),
  lunch_break_issued integer not null default 0 check (lunch_break_issued >= 0),
  after_work_completed integer not null default 0 check (after_work_completed >= 0),
  after_work_issued integer not null default 0 check (after_work_issued >= 0),
  wfh_completed integer not null default 0 check (wfh_completed >= 0),
  wfh_issued integer not null default 0 check (wfh_issued >= 0),
  favorite_subjects text[] not null default '{}',
  improvement_areas text[] not null default '{}',
  last_challenge_date timestamptz,
  last_completion_date timestamptz,
  last_streak_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.fotoai_agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  action_type text not null,
  details jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  error_message text,
  executed_at timestamptz not null default now()
);
create index fotoai_agent_actions_user_idx
  on public.fotoai_agent_actions (user_id, executed_at desc);

create table public.fotoai_photo_critiques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  submission_id uuid,
  photo_object_key text not null
    check (split_part(photo_object_key, '/', 1) = user_id::text),
  technical_score integer check (technical_score between 0 and 100),
  composition_score integer check (composition_score between 0 and 100),
  creative_score integer check (creative_score between 0 and 100),
  overall_score integer check (overall_score between 0 and 100),
  technical_feedback text,
  composition_feedback text,
  creative_feedback text,
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  suggested_settings text,
  critique_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fotoai_photo_critiques_id_user_key unique (id, user_id),
  constraint fotoai_photo_critiques_submission_owner_fkey
    foreign key (submission_id, user_id)
    references public.fotoai_challenge_submissions (id, user_id) on delete cascade
);
create index fotoai_photo_critiques_user_idx
  on public.fotoai_photo_critiques (user_id, critique_date desc);
create index fotoai_photo_critiques_submission_idx
  on public.fotoai_photo_critiques (submission_id);

create table public.fotoai_reverse_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  photo_object_key text not null
    check (split_part(photo_object_key, '/', 1) = user_id::text),
  result jsonb not null default '{}'::jsonb,
  analysis_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index fotoai_reverse_analyses_user_idx
  on public.fotoai_reverse_analyses (user_id, analysis_date desc);

create table public.fotoai_editing_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  original_photo_object_key text
    check (original_photo_object_key is null
           or split_part(original_photo_object_key, '/', 1) = user_id::text),
  edited_photo_object_key text
    check (edited_photo_object_key is null
           or split_part(edited_photo_object_key, '/', 1) = user_id::text),
  recipe jsonb not null default '{}'::jsonb,
  analysis_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index fotoai_editing_recipes_user_idx
  on public.fotoai_editing_recipes (user_id, analysis_date desc);

create table public.fotoai_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  week_start date not null,
  week_end date not null check (week_end >= week_start),
  stats jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  report_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fotoai_weekly_reports_user_week_key unique (user_id, week_start)
);

create table public.fotoai_portfolio_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  photo_count integer not null check (photo_count > 0),
  analysis jsonb not null default '{}'::jsonb,
  analysis_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index fotoai_portfolio_analyses_user_idx
  on public.fotoai_portfolio_analyses (user_id, analysis_date desc);

-- Derived XP state. Browser roles may only read these; writes go through
-- fotoai_award_skill_xp executed by the server with the service role.
create table public.fotoai_user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  skill_id text not null,
  current_xp integer not null default 0 check (current_xp >= 0),
  status text not null default 'available'
    check (status in ('locked', 'available', 'learned', 'practiced', 'mastered')),
  last_xp_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint fotoai_user_skills_user_skill_key unique (user_id, skill_id)
);

create table public.fotoai_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_appwrite_id text unique,
  skill_id text not null,
  xp_amount integer not null check (xp_amount > 0),
  source_kind text not null
    check (source_kind in ('challenge_complete', 'submission', 'critique_bonus')),
  source_id uuid,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Retry-safe award: the same (user, skill, kind, source) is stored once.
create unique index fotoai_xp_events_dedupe_idx
  on public.fotoai_xp_events (user_id, skill_id, source_kind, source_id)
  where source_id is not null;
create index fotoai_xp_events_user_awarded_idx
  on public.fotoai_xp_events (user_id, awarded_at desc);

-- ---------------------------------------------------------------------------
-- Atomic, idempotent XP award (ported from the audited design in
-- audit/foundation/sql-test-gate/01-schema.sql with fotoai_ names).
-- Execute privilege is restricted in 0002_fotoai_rls.sql.
-- ---------------------------------------------------------------------------

create type public.fotoai_xp_award_result as (
  outcome text,
  event_id uuid,
  skill_id text,
  xp_awarded integer,
  current_xp integer,
  status text,
  leveled_up boolean
);

create function public.fotoai_award_skill_xp(
  p_user_id uuid,
  p_skill_id text,
  p_xp_amount integer,
  p_source_kind text,
  p_source_id uuid,
  p_xp_to_learn integer,
  p_xp_to_practice integer,
  p_xp_to_master integer,
  p_prerequisite_skills text[]
) returns public.fotoai_xp_award_result
language plpgsql
security invoker
set search_path = public, pg_temp
as $fotoai_fn$
declare
  r public.fotoai_xp_award_result;
  v_event_id uuid;
  v_prev_xp integer;
  v_prev_status text;
  v_new_xp integer;
  v_new_status text;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;
  if p_xp_amount is null or p_xp_amount <= 0 then
    raise exception 'xp_amount must be > 0' using errcode = '22023';
  end if;
  if p_source_kind not in ('challenge_complete', 'submission', 'critique_bonus') then
    raise exception 'invalid source_kind %', p_source_kind using errcode = '22023';
  end if;
  if p_source_id is null then
    raise exception 'source_id is required for idempotent awards' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('fotoai_award_skill_xp'), hashtext(p_user_id::text));

  if coalesce(array_length(p_prerequisite_skills, 1), 0) > 0 then
    if exists (
      select 1
      from unnest(p_prerequisite_skills) as pre(skill_id)
      left join public.fotoai_user_skills us
        on us.user_id = p_user_id and us.skill_id = pre.skill_id
      where us.status is null
         or us.status not in ('learned', 'practiced', 'mastered')
    ) then
      select coalesce(us.current_xp, 0), coalesce(us.status, 'locked')
        into v_prev_xp, v_prev_status
      from (select 1) x
      left join public.fotoai_user_skills us
        on us.user_id = p_user_id and us.skill_id = p_skill_id;
      r := row('locked', null, p_skill_id, 0, v_prev_xp, v_prev_status, false)::public.fotoai_xp_award_result;
      return r;
    end if;
  end if;

  insert into public.fotoai_xp_events (user_id, skill_id, xp_amount, source_kind, source_id)
  values (p_user_id, p_skill_id, p_xp_amount, p_source_kind, p_source_id)
  on conflict (user_id, skill_id, source_kind, source_id) where source_id is not null
  do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select coalesce(us.current_xp, 0), coalesce(us.status, 'available')
      into v_prev_xp, v_prev_status
    from (select 1) x
    left join public.fotoai_user_skills us
      on us.user_id = p_user_id and us.skill_id = p_skill_id;
    r := row('duplicate', null, p_skill_id, 0, v_prev_xp, v_prev_status, false)::public.fotoai_xp_award_result;
    return r;
  end if;

  select us.current_xp, us.status into v_prev_xp, v_prev_status
  from public.fotoai_user_skills us
  where us.user_id = p_user_id and us.skill_id = p_skill_id;
  v_prev_xp := coalesce(v_prev_xp, 0);
  v_prev_status := coalesce(v_prev_status, 'available');
  v_new_xp := v_prev_xp + p_xp_amount;
  v_new_status := case
    when v_new_xp >= p_xp_to_master then 'mastered'
    when v_new_xp >= p_xp_to_practice then 'practiced'
    when v_new_xp >= p_xp_to_learn then 'learned'
    else 'available'
  end;

  insert into public.fotoai_user_skills (user_id, skill_id, current_xp, status, last_xp_date, updated_at)
  values (p_user_id, p_skill_id, v_new_xp, v_new_status, now(), now())
  on conflict (user_id, skill_id) do update
    set current_xp = excluded.current_xp,
        status = excluded.status,
        last_xp_date = excluded.last_xp_date,
        updated_at = excluded.updated_at;

  r := row('applied', v_event_id, p_skill_id, p_xp_amount, v_new_xp, v_new_status,
           v_new_status <> v_prev_status)::public.fotoai_xp_award_result;
  return r;
end
$fotoai_fn$;

-- ---------------------------------------------------------------------------
-- Secure-by-default, in the SAME transaction as the tables.
--
-- A Supabase project has "alter default privileges" that hand anon,
-- authenticated, and service_role full access to every new table and function
-- in public. We do not change those shared defaults. Instead, before this
-- transaction commits, every FotoAI table has its inherited browser-role
-- privileges revoked and row level security enabled with NO policies.
-- Result after 0001 alone: anon/authenticated cannot read or write any
-- fotoai_ row. 0002 later adds the minimal grants and owner policies.
-- ---------------------------------------------------------------------------

revoke all privileges on table public.fotoai_user_preferences      from anon, authenticated;
revoke all privileges on table public.fotoai_user_gear             from anon, authenticated;
revoke all privileges on table public.fotoai_daily_challenges      from anon, authenticated;
revoke all privileges on table public.fotoai_challenge_submissions from anon, authenticated;
revoke all privileges on table public.fotoai_itineraries           from anon, authenticated;
revoke all privileges on table public.fotoai_user_progress         from anon, authenticated;
revoke all privileges on table public.fotoai_agent_actions         from anon, authenticated;
revoke all privileges on table public.fotoai_photo_critiques       from anon, authenticated;
revoke all privileges on table public.fotoai_reverse_analyses      from anon, authenticated;
revoke all privileges on table public.fotoai_editing_recipes       from anon, authenticated;
revoke all privileges on table public.fotoai_weekly_reports        from anon, authenticated;
revoke all privileges on table public.fotoai_portfolio_analyses    from anon, authenticated;
revoke all privileges on table public.fotoai_user_skills           from anon, authenticated;
revoke all privileges on table public.fotoai_xp_events             from anon, authenticated;

revoke execute on function public.fotoai_award_skill_xp(uuid, text, integer, text, uuid, integer, integer, integer, text[])
  from public, anon, authenticated;

alter table public.fotoai_user_preferences      enable row level security;
alter table public.fotoai_user_gear             enable row level security;
alter table public.fotoai_daily_challenges      enable row level security;
alter table public.fotoai_challenge_submissions enable row level security;
alter table public.fotoai_itineraries           enable row level security;
alter table public.fotoai_user_progress         enable row level security;
alter table public.fotoai_agent_actions         enable row level security;
alter table public.fotoai_photo_critiques       enable row level security;
alter table public.fotoai_reverse_analyses      enable row level security;
alter table public.fotoai_editing_recipes       enable row level security;
alter table public.fotoai_weekly_reports        enable row level security;
alter table public.fotoai_portfolio_analyses    enable row level security;
alter table public.fotoai_user_skills           enable row level security;
alter table public.fotoai_xp_events             enable row level security;

commit;
