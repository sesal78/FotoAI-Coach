-- Refactor 2B: where a challenge came from, and a status for challenges replaced on purpose.
-- Additive. Apply to production only with Seun's approval (psql -1 -v ON_ERROR_STOP=1).
-- Verify: select source, count(*) from public.fotoai_daily_challenges group by 1 order by 1;
-- Undo:   supabase/undo/20261018100001_challenge_source.undo.sql

alter table public.fotoai_daily_challenges add column source text not null default 'dashboard';

update public.fotoai_daily_challenges set source = 'chat' where challenge_type = 'CHATBOT_GENERATED';

alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_source_check check (source in ('dashboard', 'chat', 'plan', 'job'));

alter table public.fotoai_daily_challenges drop constraint fotoai_daily_challenges_status_check;
alter table public.fotoai_daily_challenges
  add constraint fotoai_daily_challenges_status_check
  check (status in ('pending', 'accepted', 'skipped', 'completed', 'superseded'));
