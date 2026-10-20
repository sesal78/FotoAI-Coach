-- UNDO for 20261020100001_photo_analyses_and_auto_theme.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: the photo link, mode and details columns of fotoai_photo_critiques, and the Auto theme.
-- Stops before any change while any v2 analysis exists or any user has the Auto theme. Run this
-- before the photos undo (the photo link points at fotoai_photos).

do $$
begin
  if exists (select 1 from public.fotoai_photo_critiques where photo_id is not null or mode <> 'critique' or details is not null) then
    raise exception 'undo refused: v2 photo analyses exist; export or remove them first';
  end if;
  if exists (select 1 from public.fotoai_user_preferences where theme = 'auto') then
    raise exception 'undo refused: users have the auto theme; move them to golden first';
  end if;
end $$;

alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_theme_check;
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_theme_check check (theme in ('golden', 'golden_dark', 'camera'));

drop index public.fotoai_photo_critiques_photo_idx;

alter table public.fotoai_photo_critiques
  drop constraint fotoai_photo_critiques_photo_fkey,
  drop column photo_id,
  drop column mode,
  drop column details;

alter table public.fotoai_photos
  drop constraint fotoai_photos_id_user_key;
