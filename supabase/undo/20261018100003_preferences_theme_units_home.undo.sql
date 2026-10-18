-- UNDO for 20261018100003_preferences_theme_units_home.sql. Run only with Seun's approval.
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_pair_check;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_lng_check;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_home_lat_check;
alter table public.fotoai_user_preferences drop column home_lng;
alter table public.fotoai_user_preferences drop column home_lat;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_units_check;
alter table public.fotoai_user_preferences drop column units;
alter table public.fotoai_user_preferences drop constraint fotoai_user_preferences_theme_check;
alter table public.fotoai_user_preferences drop column theme;
