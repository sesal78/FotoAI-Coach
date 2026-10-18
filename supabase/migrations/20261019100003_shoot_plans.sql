-- Refactor 2E-1: shoot plans and their steps. Additive. Apply to production only with Seun's approval:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- A plan keeps only the Google place_id or the user's own spot id; no Google text is stored.
-- Owner checks are keys: a step belongs to a plan of the same user, and a plan's spot is the
-- same user's spot (fotoai_places gains a unique (id, user_id) for that).
-- Verify: select (select count(*) from public.fotoai_shoot_plans) as plans, (select count(*) from public.fotoai_plan_steps) as steps;
-- Undo:   supabase/undo/20261019100003_shoot_plans.undo.sql

alter table public.fotoai_places add constraint fotoai_places_id_user_key unique (id, user_id);

create table public.fotoai_shoot_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_source text not null check (place_source in ('google', 'user')),
  place_id text,
  spot_id uuid,
  plan_date date not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  title text not null check (char_length(title) between 1 and 80),
  summary text not null check (char_length(summary) <= 400),
  loadout jsonb not null,
  notes text[] not null default '{}',
  prompt_id text not null,
  prompt_version integer not null check (prompt_version > 0),
  model text not null,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fotoai_shoot_plans_id_user_key unique (id, user_id),
  constraint fotoai_shoot_plans_spot_fkey foreign key (spot_id, user_id)
    references public.fotoai_places (id, user_id) on delete set null (spot_id),
  constraint fotoai_shoot_plans_place_check check (
    (place_source = 'google' and place_id is not null)
    or (place_source = 'user' and place_id is null)
  )
);

create index fotoai_shoot_plans_user_created_idx on public.fotoai_shoot_plans (user_id, created_at desc);

create table public.fotoai_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  instruction text not null check (char_length(instruction) between 1 and 600),
  tip text check (char_length(tip) <= 200),
  starts_at timestamptz,
  settings jsonb not null,
  status text not null default 'todo' check (status in ('todo', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fotoai_plan_steps_plan_fkey foreign key (plan_id, user_id)
    references public.fotoai_shoot_plans (id, user_id) on delete cascade,
  constraint fotoai_plan_steps_plan_position_key unique (plan_id, position)
);

-- Owner-only rows, used with the user's own token.
alter table public.fotoai_shoot_plans enable row level security;
alter table public.fotoai_plan_steps enable row level security;
revoke all on table public.fotoai_shoot_plans, public.fotoai_plan_steps from anon, authenticated;
grant select, insert, update, delete on table public.fotoai_shoot_plans, public.fotoai_plan_steps to authenticated;

create policy fotoai_shoot_plans_select on public.fotoai_shoot_plans
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_shoot_plans_insert on public.fotoai_shoot_plans
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_shoot_plans_update on public.fotoai_shoot_plans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_shoot_plans_delete on public.fotoai_shoot_plans
  for delete to authenticated using (user_id = auth.uid());

create policy fotoai_plan_steps_select on public.fotoai_plan_steps
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_plan_steps_insert on public.fotoai_plan_steps
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_plan_steps_update on public.fotoai_plan_steps
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_plan_steps_delete on public.fotoai_plan_steps
  for delete to authenticated using (user_id = auth.uid());
