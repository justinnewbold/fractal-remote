-- CONNECTED OVER BLUETOOTH: ONE DATE, SO THE SETUP EMAILS LEAVE THEM ALONE.
--
-- "Is there a way to do that now only if they haven't connected a computer
-- or Bluetooth? Because now that we have Bluetooth support, some people might
-- use that, but I still think we should send it out to the 12 that never did"
-- (Justin, 1 November 2026). Applied after 20261015_setup_reminders.sql,
-- whose rule it extends.
--
-- The account server sees a computer app sign in (computer_seen); it never
-- sees a phone talk to a unit over Bluetooth, which goes from the phone to
-- the adapter and nowhere else. So the phone says so, the first time the unit
-- answers over Bluetooth while signed in (mobile/src/lib/bluetoothSeen.js),
-- by calling note_bluetooth_connected(). It takes no argument: only the
-- caller's own account is written, only the first date is kept, and nothing
-- else about the connection (not the unit, the adapter, the phone, or how
-- often) is sent or stored. Said on the privacy page under "Help getting
-- connected".
--
-- The ledger hangs off the account (on delete cascade), like the other three,
-- so Delete account clears it with nothing changed in the function that
-- deletes.
set lock_timeout = '5s';

create table if not exists public.bluetooth_seen (
  account_id uuid primary key references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null
);

alter table public.bluetooth_seen enable row level security;
revoke all on table public.bluetooth_seen from public, anon, authenticated;
grant all on table public.bluetooth_seen to service_role;

-- THE ONE CALL A PHONE MAY MAKE HERE. Security definer so it can write a
-- table nobody else can touch; no argument, so nobody can write for anybody
-- else; null when there is no caller, which the phone reads as "ask again".
create or replace function public.note_bluetooth_connected()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.bluetooth_seen (account_id, first_seen_at)
  values (auth.uid(), now())
  on conflict (account_id) do nothing;
  return true;
end;
$$;

revoke all on function public.note_bluetooth_connected() from public, anon;
grant execute on function public.note_bluetooth_connected() to authenticated;

-- THE RULE, AGAIN, with Bluetooth in it: has the full version, is a person,
-- no computer app has ever been seen on it, and it has never connected over
-- Bluetooth. Everything else is 20261015_setup_reminders.sql's, word for word.
create or replace function public.setup_stuck()
returns table (
  account_id uuid,
  email text,
  confirmed boolean,
  unlocked_at timestamptz,
  estimated boolean,
  signed_up timestamptz,
  last_sign_in timestamptz,
  first_sent_at timestamptz,
  reminder_sent_at timestamptz,
  failed_at timestamptz,
  failed_kind text,
  left_out boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    u.email_confirmed_at is not null,
    l.first_seen_at,
    l.estimated,
    u.created_at,
    u.last_sign_in_at,
    r.first_sent_at,
    r.reminder_sent_at,
    r.failed_at,
    r.failed_kind,
    r.left_out_at is not null
  from public.entitlements e
  join auth.users u on u.id = e.account_id
  join public.unlock_seen l on l.account_id = e.account_id
  left join public.setup_reminders r on r.account_id = e.account_id
  where e.active
    and e.source = 'revenuecat'
    and u.deleted_at is null
    and coalesce(u.email, '') <> ''
    and lower(u.email) not like '%@pair.fractal.newbold.cloud'
    and not exists (select 1 from public.computer_seen c where c.account_id = e.account_id)
    and not exists (
      select 1 from auth.sessions s
      where s.user_id = e.account_id
        and (s.user_agent like 'node%' or s.user_agent ilike '%electron%')
    )
    and not exists (select 1 from public.bluetooth_seen b where b.account_id = e.account_id)
$$;

-- The Developer page's list, with "set up after the email" counting a
-- computer or Bluetooth, whichever came first after it.
create or replace function public.owner_setup_stuck()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  answer jsonb;
begin
  perform public.note_setup_facts();
  select jsonb_build_object(
    'sending', public.setup_reminder_sending(),
    'due_first', (select count(*) from public.setup_due() d where d.kind = 'first'),
    'due_reminder', (select count(*) from public.setup_due() d where d.kind = 'reminder'),
    -- Emailed, and connected since, by a computer or over Bluetooth: the email doing its job.
    'set_up_after', (
      select count(*)
      from public.setup_reminders r
      where r.first_sent_at is not null
        and (
          exists (select 1 from public.computer_seen c where c.account_id = r.account_id and c.first_seen_at > r.first_sent_at)
          or exists (select 1 from public.bluetooth_seen b where b.account_id = r.account_id and b.first_seen_at > r.first_sent_at)
        )
    ),
    'stuck', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.account_id,
        'email', s.email,
        'confirmed', s.confirmed,
        'unlocked_at', s.unlocked_at,
        'estimated', s.estimated,
        'signed_up', s.signed_up,
        'last_sign_in', s.last_sign_in,
        'first_sent_at', s.first_sent_at,
        'reminder_sent_at', s.reminder_sent_at,
        'failed_at', s.failed_at,
        'failed_kind', s.failed_kind,
        'left_out', s.left_out
      ) order by s.unlocked_at desc)
      from public.setup_stuck() s
    ), '[]'::jsonb)
  ) into answer;
  return answer;
end;
$$;

revoke all on function public.setup_stuck() from public, anon, authenticated;
revoke all on function public.owner_setup_stuck() from public, anon, authenticated;
grant execute on function public.setup_stuck() to service_role;
grant execute on function public.owner_setup_stuck() to service_role;
