-- Refactor 2E-2b: the coach chat history, and the AI check on a confirmed photo. Additive. Apply
-- to production only with Seun's approval (after 20261019100005_photos.sql):
--   psql -1 -v ON_ERROR_STOP=1 -f - < this file
-- Coach messages are written once and never edited (no update grant); the owner may delete them
-- (clear history). context is what the client sent with a user message (the screen and ids);
-- proposal is what the coach proposed in an assistant message and what the server did with it.
-- Verify: select count(*) from public.fotoai_coach_messages;  -- 0 right after the apply
--         select count(*) from public.fotoai_photos where checked_at is not null;  -- 0
-- Undo:   supabase/undo/20261019100006_coach_and_photo_checks.undo.sql

create table public.fotoai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  context jsonb check (octet_length(context::text) <= 2000),
  proposal jsonb check (octet_length(proposal::text) <= 8000),
  created_at timestamptz not null default now()
);

create index fotoai_coach_messages_user_created_idx on public.fotoai_coach_messages (user_id, created_at desc);

-- Owner-only rows, used with the user's own token. No update: a message is never edited.
alter table public.fotoai_coach_messages enable row level security;
revoke all on table public.fotoai_coach_messages from anon, authenticated;
grant select, insert, delete on table public.fotoai_coach_messages to authenticated;
create policy fotoai_coach_messages_select on public.fotoai_coach_messages
  for select to authenticated using (user_id = auth.uid());
create policy fotoai_coach_messages_insert on public.fotoai_coach_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy fotoai_coach_messages_delete on public.fotoai_coach_messages
  for delete to authenticated using (user_id = auth.uid());

-- The photo check: is it safe, does it match the plan step's brief, and its genre.
alter table public.fotoai_photos
  add column check_safe boolean,
  add column check_matches text check (check_matches in ('yes', 'no', 'unclear')),
  add column check_genre text check (char_length(check_genre) <= 40),
  add column checked_at timestamptz,
  add column check_prompt text check (char_length(check_prompt) <= 80);
