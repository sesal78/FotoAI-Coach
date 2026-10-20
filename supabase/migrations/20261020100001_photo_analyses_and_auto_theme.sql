-- Refactor 3B: Analyse on v2 photos (critique, editing tips, recreate), and the Auto theme.
-- Additive. Apply to production only with Seun's approval (after 20261019100006):
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- One fotoai_photo_critiques row per analysis. A v2 analysis links its photo (owner only, through
-- the composite key) and keeps the photo's object key; when the photo is deleted the analysis
-- stays with no link. Live critiques keep photo_id null and mode 'critique'. The grants do not
-- change (select, insert, delete).
-- Verify: select count(*) from public.fotoai_photo_critiques where photo_id is not null or mode <> 'critique';  -- 0
--         select pg_get_constraintdef(oid) from pg_constraint where conname = 'fotoai_user_preferences_theme_check';
-- Undo:   supabase/undo/20261020100001_photo_analyses_and_auto_theme.undo.sql

alter table public.fotoai_photos
  add constraint fotoai_photos_id_user_key unique (id, user_id);

alter table public.fotoai_photo_critiques
  add column photo_id uuid,
  add column mode text not null default 'critique',
  add column details jsonb,
  add constraint fotoai_photo_critiques_mode_check check (mode in ('critique', 'editing', 'recreate')),
  add constraint fotoai_photo_critiques_details_check check (octet_length(details::text) <= 16000),
  add constraint fotoai_photo_critiques_photo_fkey foreign key (photo_id, user_id)
    references public.fotoai_photos (id, user_id) on delete set null (photo_id);

create index fotoai_photo_critiques_photo_idx on public.fotoai_photo_critiques (photo_id) where photo_id is not null;

alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_theme_check;
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_theme_check check (theme in ('golden', 'golden_dark', 'camera', 'auto'));
