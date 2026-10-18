-- UNDO for 20261018100001_challenge_source.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: the recorded source of every challenge (the source column is dropped).
-- Stops before any change while a challenge has status 'superseded'; resolve those rows first.

do $$
begin
  if exists (select 1 from public.fotoai_daily_challenges where status = 'superseded') then
    raise exception 'undo refused: superseded challenges exist; resolve them first';
  end if;
end $$;

alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_status_check;
alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_status_check check (status in ('pending', 'accepted', 'skipped', 'completed'));
alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_source_check;
alter table public.fotoai_daily_challenges drop column source;
