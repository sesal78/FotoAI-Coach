-- Refactor 2E-2a: photos that are not challenge submissions (gallery, scan or camera), with the
-- EXIF the phone read and links to a plan step, a film frame or a roll. Additive. Apply to
-- production only with Seun's approval (after 20261019100004_film_rolls.sql):
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- The bytes are uploaded to the existing fotoai-submissions bucket through a one-time signed
-- upload link made by the server, so the Storage policies do not change. The key is always
-- <user>/photos/<photo id>/<random>.<ext>. A photo's own GPS is the user's data.
-- Verify: select count(*) from public.fotoai_photos;  -- 0 right after the apply
-- Undo:   supabase/undo/20261019100005_photos.undo.sql

create table public.fotoai_photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('gallery', 'scan', 'camera')),
  object_key text not null unique,
  mime text not null check (char_length(mime) between 3 and 80),
  bytes bigint not null check (bytes between 1 and 52428800),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  taken_at timestamptz,
  taken_offset text check (taken_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'),
  camera_make text check (char_length(camera_make) <= 80),
  camera_model text check (char_length(camera_model) <= 80),
  lens_model text check (char_length(lens_model) <= 80),
  focal_mm numeric check (focal_mm > 0),
  aperture numeric check (aperture > 0),
  shutter_s numeric check (shutter_s > 0),
  iso integer check (iso > 0),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  step_id uuid,
  frame_id uuid,
  roll_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fotoai_photos_object_key_check check (
    object_key ~ ('^' || user_id::text || '/photos/' || id::text || '/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$')
  ),
  constraint fotoai_photos_step_fkey foreign key (step_id, user_id)
    references public.fotoai_plan_steps (id, user_id) on delete set null (step_id),
  constraint fotoai_photos_frame_fkey foreign key (frame_id, user_id)
    references public.fotoai_film_frames (id, user_id) on delete set null (frame_id),
  constraint fotoai_photos_roll_fkey foreign key (roll_id, user_id)
    references public.fotoai_film_rolls (id, user_id) on delete set null (roll_id)
);

create index fotoai_photos_user_created_idx on public.fotoai_photos (user_id, created_at desc);
create index fotoai_photos_step_idx on public.fotoai_photos (step_id) where step_id is not null;

-- Owner-only rows, used with the user's own token.
alter table public.fotoai_photos enable row level security;
revoke all on table public.fotoai_photos from anon, authenticated;
grant select, insert, update, delete on table public.fotoai_photos to authenticated;
create policy fotoai_photos_select on public.fotoai_photos
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_photos_insert on public.fotoai_photos
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_photos_update on public.fotoai_photos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fotoai_photos_delete on public.fotoai_photos
  for delete to authenticated using (user_id = auth.uid());
