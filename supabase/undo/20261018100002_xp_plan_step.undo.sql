-- UNDO for 20261018100002_xp_plan_step.sql. Run only with Seun's approval.
-- Fails (on purpose) if any plan_step XP events exist; resolve those first.
alter table public.fotoai_xp_events drop constraint fotoai_xp_events_source_kind_check;
alter table public.fotoai_xp_events
  add constraint fotoai_xp_events_source_kind_check
  check (source_kind in ('challenge_complete', 'submission', 'critique_bonus'));

create or replace function public.fotoai_award_skill_xp(
  p_user_id uuid,
  p_skill_id text,
  p_xp_amount integer,
  p_source_kind text,
  p_source_id uuid,
  p_xp_to_learn integer,
  p_xp_to_practice integer,
  p_xp_to_master integer,
  p_prerequisite_skills text[]
) returns public.fotoai_xp_award_result
language plpgsql
security invoker
set search_path = public, pg_temp
as $fotoai_fn$
declare
  r public.fotoai_xp_award_result;
  v_event_id uuid;
  v_prev_xp integer;
  v_prev_status text;
  v_new_xp integer;
  v_new_status text;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;
  if p_xp_amount is null or p_xp_amount <= 0 then
    raise exception 'xp_amount must be > 0' using errcode = '22023';
  end if;
  if p_source_kind not in ('challenge_complete', 'submission', 'critique_bonus') then
    raise exception 'invalid source_kind %', p_source_kind using errcode = '22023';
  end if;
  if p_source_id is null then
    raise exception 'source_id is required for idempotent awards' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('fotoai_award_skill_xp'), hashtext(p_user_id::text));

  if coalesce(array_length(p_prerequisite_skills, 1), 0) > 0 then
    if exists (
      select 1
      from unnest(p_prerequisite_skills) as pre(skill_id)
      left join public.fotoai_user_skills us
        on us.user_id = p_user_id and us.skill_id = pre.skill_id
      where us.status is null
         or us.status not in ('learned', 'practiced', 'mastered')
    ) then
      select coalesce(us.current_xp, 0), coalesce(us.status, 'locked')
        into v_prev_xp, v_prev_status
      from (select 1) x
      left join public.fotoai_user_skills us
        on us.user_id = p_user_id and us.skill_id = p_skill_id;
      r := row('locked', null, p_skill_id, 0, v_prev_xp, v_prev_status, false)::public.fotoai_xp_award_result;
      return r;
    end if;
  end if;

  insert into public.fotoai_xp_events (user_id, skill_id, xp_amount, source_kind, source_id)
  values (p_user_id, p_skill_id, p_xp_amount, p_source_kind, p_source_id)
  on conflict (user_id, skill_id, source_kind, source_id) where source_id is not null
  do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select coalesce(us.current_xp, 0), coalesce(us.status, 'available')
      into v_prev_xp, v_prev_status
    from (select 1) x
    left join public.fotoai_user_skills us
      on us.user_id = p_user_id and us.skill_id = p_skill_id;
    r := row('duplicate', null, p_skill_id, 0, v_prev_xp, v_prev_status, false)::public.fotoai_xp_award_result;
    return r;
  end if;

  select us.current_xp, us.status into v_prev_xp, v_prev_status
  from public.fotoai_user_skills us
  where us.user_id = p_user_id and us.skill_id = p_skill_id;
  v_prev_xp := coalesce(v_prev_xp, 0);
  v_prev_status := coalesce(v_prev_status, 'available');
  v_new_xp := v_prev_xp + p_xp_amount;
  v_new_status := case
    when v_new_xp >= p_xp_to_master then 'mastered'
    when v_new_xp >= p_xp_to_practice then 'practiced'
    when v_new_xp >= p_xp_to_learn then 'learned'
    else 'available'
  end;

  insert into public.fotoai_user_skills (user_id, skill_id, current_xp, status, last_xp_date, updated_at)
  values (p_user_id, p_skill_id, v_new_xp, v_new_status, now(), now())
  on conflict (user_id, skill_id) do update
    set current_xp = excluded.current_xp,
        status = excluded.status,
        last_xp_date = excluded.last_xp_date,
        updated_at = excluded.updated_at;

  r := row('applied', v_event_id, p_skill_id, p_xp_amount, v_new_xp, v_new_status,
           v_new_status <> v_prev_status)::public.fotoai_xp_award_result;
  return r;
end
$fotoai_fn$;
