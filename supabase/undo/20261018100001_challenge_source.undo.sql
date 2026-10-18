-- UNDO for 20261018100001_challenge_source.sql. Run only with Seun's approval.
-- Fails (on purpose) if any row is 'superseded'; resolve those rows first.
alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_status_check;
alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_status_check check (status in ('pending', 'accepted', 'skipped', 'completed'));
alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_source_check;
alter table public.fotoai_daily_challenges drop column source;
