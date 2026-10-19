-- UNDO for 20261019100005_photos.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: every photo row (the Storage objects stay; remove them separately if wanted).
-- Stops before any change while any photo exists. Run this before the film-rolls undo.

do $$
begin
  if exists (select 1 from public.fotoai_photos) then
    raise exception 'undo refused: photos exist; export or remove them first';
  end if;
end $$;

drop table public.fotoai_photos;
