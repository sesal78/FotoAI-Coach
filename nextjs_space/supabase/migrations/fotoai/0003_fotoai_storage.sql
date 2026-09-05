-- FotoAI migration 0003: private Storage bucket (collision-first)
--
-- Creates the single private bucket fotoai-submissions and ONE insert policy on
-- storage.objects named fotoai_submissions_insert. No select/update/delete
-- policy exists on purpose: browser roles can only upload under their own
-- user-id prefix. Reading (signed URLs) and deleting are done by the server
-- with the service role after it has verified ownership in
-- fotoai_challenge_submissions (see lib/fotoai/photos.ts).
--
-- Shared-object note: storage.objects and storage.buckets are shared tables.
-- This file only ADDS one bucket row and one policy, both named fotoai_*.
-- It changes no existing bucket, policy, or setting.
--
-- Rules: no DROP, no IF NOT EXISTS, no ON CONFLICT, no GRANT. Aborts if the
-- bucket id/name or any fotoai_ storage policy already exists.
--
-- Apply later (not run by the build worker):
--   psql "$FOTOAI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -1 -f 0003_fotoai_storage.sql

begin;

do $fotoai_guard$
declare
  v_hit text;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'buckets'
  ) then
    raise exception 'FOTOAI_PRECONDITION: storage.buckets is missing; Storage is not installed'
      using errcode = '42P01';
  end if;

  if exists (select 1 from storage.buckets b where b.id = 'fotoai-submissions' or b.name = 'fotoai-submissions') then
    raise exception 'FOTOAI_COLLISION: storage bucket fotoai-submissions already exists'
      using errcode = '23505';
  end if;

  select string_agg(p.policyname, ', ') into v_hit
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'fotoai\_%';
  if v_hit is not null then
    raise exception 'FOTOAI_COLLISION: fotoai_ storage policies already exist: %', v_hit
      using errcode = '42710';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'foldername'
  ) then
    raise exception 'FOTOAI_PRECONDITION: storage.foldername() is missing'
      using errcode = '42883';
  end if;
end
$fotoai_guard$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotoai-submissions',
  'fotoai-submissions',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
    'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
    'image/x-olympus-orf', 'image/x-panasonic-rw2', 'image/x-pentax-pef',
    'image/x-samsung-srw', 'image/x-dcraw', 'application/octet-stream'
  ]
);

-- Owner-prefixed upload only. The key pattern is identical to the check
-- constraint in 0001 and to lib/fotoai/object-keys.ts.
create policy fotoai_submissions_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotoai-submissions'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'
  );

commit;
