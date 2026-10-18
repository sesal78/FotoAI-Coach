-- UNDO for 20261019100003_shoot_plans.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: every shoot plan and plan step, and the (id, user_id) key on fotoai_places.
-- Stops before any change while any plan exists.

do $$
begin
  if exists (select 1 from public.fotoai_shoot_plans) then
    raise exception 'undo refused: shoot plans exist; export or remove them first';
  end if;
end $$;

drop table public.fotoai_plan_steps;
drop table public.fotoai_shoot_plans;
alter table public.fotoai_places drop constraint fotoai_places_id_user_key;
