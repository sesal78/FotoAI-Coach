-- Refactor 2B: theme, units and home area for the new apps. The home label reuses the
-- existing home_location text column. Additive. Apply to production only with Seun's approval.
-- Verify: select count(*) filter (where theme = 'golden'), count(*) from public.fotoai_user_preferences;
-- Undo:   supabase/undo/20261018100003_preferences_theme_units_home.undo.sql

alter table public.fotoai_user_preferences add column theme text not null default 'golden';
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_theme_check check (theme in ('golden', 'golden_dark', 'camera'));

alter table public.fotoai_user_preferences add column units text not null default 'metric';
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_units_check check (units in ('metric', 'imperial'));

alter table public.fotoai_user_preferences add column home_lat double precision;
alter table public.fotoai_user_preferences add column home_lng double precision;
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_home_lat_check check (home_lat is null or home_lat between -90 and 90);
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_home_lng_check check (home_lng is null or home_lng between -180 and 180);
alter table public.fotoai_user_preferences
  add constraint fotoai_user_preferences_home_pair_check check ((home_lat is null) = (home_lng is null));
