-- UNDO for 20261019100004_film_rolls.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: every film roll and logged frame, and the (id, user_id) keys on fotoai_user_gear and fotoai_plan_steps.
-- Stops before any change while any roll exists. Run the photos undo (20261019100005) first.

do $$
begin
  if exists (select 1 from public.fotoai_film_rolls) then
    raise exception 'undo refused: film rolls exist; export or remove them first';
  end if;
end $$;

drop table public.fotoai_film_frames;
drop table public.fotoai_film_rolls;
alter table public.fotoai_plan_steps drop constraint fotoai_plan_steps_id_user_key;
alter table public.fotoai_user_gear drop constraint fotoai_user_gear_id_user_key;
