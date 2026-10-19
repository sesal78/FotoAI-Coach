-- UNDO for 20261019100006_coach_and_photo_checks.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: every coach message and every photo check result (the photos themselves stay).
-- Stops before any change while any coach message exists or any photo has a check. Run this
-- before the photos undo.

do $$
begin
  if exists (select 1 from public.fotoai_coach_messages) then
    raise exception 'undo refused: coach messages exist; export or remove them first';
  end if;
  if exists (
    select 1 from public.fotoai_photos
    where check_safe is not null or check_matches is not null or check_genre is not null
       or checked_at is not null or check_prompt is not null
  ) then
    raise exception 'undo refused: photo check results exist; export or clear them first';
  end if;
end $$;

drop table public.fotoai_coach_messages;

alter table public.fotoai_photos
  drop column check_safe,
  drop column check_matches,
  drop column check_genre,
  drop column checked_at,
  drop column check_prompt;
