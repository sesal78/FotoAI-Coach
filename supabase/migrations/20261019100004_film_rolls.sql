-- Refactor 2E-2a: film rolls and their logged frames. Additive. Apply to production only with Seun's approval:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- Ids come from the phone, so a replayed offline write is a no-op. Frames are append-only for users
-- (insert and read only); deleting a roll deletes its frames. Owner checks are keys: a roll's body,
-- a frame's roll, lens and plan step all belong to the same user (fotoai_user_gear and
-- fotoai_plan_steps gain a unique (id, user_id) for that).
-- Verify: select (select count(*) from public.fotoai_film_rolls) as rolls, (select count(*) from public.fotoai_film_frames) as frames;
-- Undo:   supabase/undo/20261019100004_film_rolls.undo.sql

alter table public.fotoai_user_gear add constraint fotoai_user_gear_id_user_key unique (id, user_id);
alter table public.fotoai_plan_steps add constraint fotoai_plan_steps_id_user_key unique (id, user_id);

create table public.fotoai_film_rolls (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id text check (stock_id ~ '^[a-z0-9-]{1,60}$'),
  stock_name text not null check (char_length(stock_name) between 1 and 60),
  box_iso integer not null check (box_iso > 0),
  rated_iso integer not null check (rated_iso > 0),
  exposures integer not null check (exposures between 1 and 72),
  body_gear_id uuid,
  status text not null default 'loaded' check (status in ('loaded', 'finished', 'developed', 'scanned')),
  loaded_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fotoai_film_rolls_id_user_key unique (id, user_id),
  constraint fotoai_film_rolls_body_fkey foreign key (body_gear_id, user_id)
    references public.fotoai_user_gear (id, user_id) on delete set null (body_gear_id)
);

create index fotoai_film_rolls_user_created_idx on public.fotoai_film_rolls (user_id, created_at desc);

create table public.fotoai_film_frames (
  id uuid primary key,
  roll_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  frame_no integer not null check (frame_no between 1 and 74),
  settings jsonb not null,
  lens_gear_id uuid,
  step_id uuid,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  note text check (char_length(note) <= 500),
  shot_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint fotoai_film_frames_id_user_key unique (id, user_id),
  constraint fotoai_film_frames_roll_frame_key unique (roll_id, frame_no),
  constraint fotoai_film_frames_roll_fkey foreign key (roll_id, user_id)
    references public.fotoai_film_rolls (id, user_id) on delete cascade,
  constraint fotoai_film_frames_lens_fkey foreign key (lens_gear_id, user_id)
    references public.fotoai_user_gear (id, user_id) on delete set null (lens_gear_id),
  constraint fotoai_film_frames_step_fkey foreign key (step_id, user_id)
    references public.fotoai_plan_steps (id, user_id) on delete set null (step_id)
);

create index fotoai_film_frames_step_idx on public.fotoai_film_frames (step_id) where step_id is not null;

-- Owner-only rows, used with the user's own token. Frames: insert and read only.
alter table public.fotoai_film_rolls enable row level security;
alter table public.fotoai_film_frames enable row level security;
revoke all on table public.fotoai_film_rolls, public.fotoai_film_frames from anon, authenticated;
grant select, insert, update, delete on table public.fotoai_film_rolls to authenticated;
grant select, insert on table public.fotoai_film_frames to authenticated;

create policy fotoai_film_rolls_select on public.fotoai_film_rolls
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_film_rolls_insert on public.fotoai_film_rolls
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_film_rolls_update on public.fotoai_film_rolls
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_film_rolls_delete on public.fotoai_film_rolls
  for delete to authenticated using (user_id = auth.uid());

create policy fotoai_film_frames_select on public.fotoai_film_frames
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_film_frames_insert on public.fotoai_film_frames
  for insert to authenticated with check (user_id = auth.uid());
