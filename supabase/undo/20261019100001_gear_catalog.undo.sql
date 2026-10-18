-- UNDO for 20261019100001_gear_catalog.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: the gear catalog, every gear row's catalog link and custom data, and every saved loadout.
-- Stops before any change while any user gear row links the catalog or carries custom data.

do $$
begin
  if exists (select 1 from public.fotoai_user_gear where body_id is not null or lens_id is not null or custom is not null) then
    raise exception 'undo refused: user gear links the catalog or has custom data; resolve those rows first';
  end if;
end $$;

alter table public.fotoai_user_preferences drop column loadout;
alter table public.fotoai_user_gear drop constraint fotoai_user_gear_one_link_check;
alter table public.fotoai_user_gear drop column custom;
alter table public.fotoai_user_gear drop column lens_id;
alter table public.fotoai_user_gear drop column body_id;
drop table public.fotoai_gear_bodies;
drop table public.fotoai_gear_lenses;
