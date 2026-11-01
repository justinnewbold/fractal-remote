-- THE SETUP EMAILS' TIMING: TWO DAYS, THEN A WEEK.
--
-- "Let's change the check to 48 hours after first purchase, and then one
-- week after that. Some people that are going to be using Bluetooth might
-- decide to order it on Amazon, and they're not gonna connect until they get
-- their devices delivered. That way we give them plenty of time to get their
-- stuff set up before we send them an email" (Justin, 1 November 2026).
--
-- So the first email waits 48 hours after the full version is first seen
-- (it waited 24), and the reminder at least 7 days after the first (it
-- waited 4). Applied after 20261101_bluetooth_seen.sql. setup_due and
-- claim_setup_reminder are 20261015_setup_reminders.sql's word for word but
-- for those two numbers; the claim checks the same rule again, so the two
-- cannot disagree about when a reminder is due. test/server.mjs holds both.
set lock_timeout = '5s';

create or replace function public.setup_due()
returns table (account_id uuid, email text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.account_id,
    s.email,
    case when s.first_sent_at is null then 'first' else 'reminder' end
  from public.setup_stuck() s
  where s.confirmed
    and not s.left_out
    and s.failed_at is null
    and s.reminder_sent_at is null
    and s.unlocked_at <= now() - interval '48 hours'
    and (s.first_sent_at is null or s.first_sent_at <= now() - interval '7 days')
$$;

create or replace function public.claim_setup_reminder(uid uuid, which text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if uid is null or which is null or which not in ('first', 'reminder') then
    return false;
  end if;
  if not public.setup_reminder_sending() then
    return false;
  end if;
  if not exists (select 1 from public.setup_due() d where d.account_id = uid and d.kind = which) then
    return false;
  end if;

  if which = 'first' then
    insert into public.setup_reminders as r (account_id, first_sent_at)
    values (uid, now())
    on conflict (account_id) do update
      set first_sent_at = now()
      where r.first_sent_at is null
        and r.reminder_sent_at is null
        and r.failed_at is null
        and r.left_out_at is null
    returning true into claimed;
  else
    update public.setup_reminders r
      set reminder_sent_at = now()
      where r.account_id = uid
        and r.first_sent_at is not null
        and r.first_sent_at <= now() - interval '7 days'
        and r.reminder_sent_at is null
        and r.failed_at is null
        and r.left_out_at is null
    returning true into claimed;
  end if;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.setup_due() from public, anon, authenticated;
revoke all on function public.claim_setup_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.setup_due() to service_role;
grant execute on function public.claim_setup_reminder(uuid, text) to service_role;
