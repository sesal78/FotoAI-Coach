-- UNDO for 20261018100003_preferences_theme_units_home.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: every user's saved theme, units and home map point (home_location text is kept).

alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_pair_check;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_lng_check;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_lat_check;
alter table public.fotoai_user_preferences drop column home_lng;
alter table public.fotoai_user_preferences drop column home_lat;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_units_check;
alter table public.fotoai_user_preferences drop column units;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_theme_check;
alter table public.fotoai_user_preferences drop column theme;
