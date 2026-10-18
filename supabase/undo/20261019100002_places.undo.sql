-- UNDO for 20261019100002_places.sql. Run only with Seun's approval, atomically:
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file   (one transaction; any error changes nothing)
-- Discards: the fotoai_places table (every saved spot and own pin).
-- Stops before any change while any saved spot exists.

do $$
begin
  if exists (select 1 from public.fotoai_places) then
    raise exception 'undo refused: saved spots exist in fotoai_places; export or remove them first';
  end if;
end $$;

drop table public.fotoai_places;
