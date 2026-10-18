-- Refactor 2D: a user's saved spots, either a Google place or their own pin. Additive.
-- Apply to production only with Seun's approval:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- Google Maps Platform terms allow storing only the place_id: a Google row keeps no name and
-- no coordinates (they are fetched fresh). A user pin keeps its own name and coordinates.
-- Verify: select count(*) from public.fotoai_places;  -- 0 right after the apply
-- Undo:   supabase/undo/20261019100002_places.undo.sql

create table public.fotoai_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('google', 'user')),
  place_id text,
  name text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  notes text check (char_length(notes) <= 2000),
  favourite boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fotoai_places_source_shape_check check (
    (source = 'google' and place_id is not null and name is null and lat is null and lng is null)
    or (source = 'user' and place_id is null and name is not null and char_length(name) between 1 and 80 and lat is not null and lng is not null)
  )
);

create unique index fotoai_places_user_place_key on public.fotoai_places (user_id, place_id) where place_id is not null;
create index fotoai_places_user_created_idx on public.fotoai_places (user_id, created_at desc);

-- Owner-only rows, used with the user's own token.
alter table public.fotoai_places enable row level security;
revoke all on table public.fotoai_places from anon, authenticated;
grant select, insert, update, delete on table public.fotoai_places to authenticated;
create policy fotoai_places_select on public.fotoai_places
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_places_insert on public.fotoai_places
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_places_update on public.fotoai_places
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_places_delete on public.fotoai_places
  for delete to authenticated using (user_id = auth.uid());
