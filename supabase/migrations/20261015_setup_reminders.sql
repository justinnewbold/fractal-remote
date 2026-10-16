-- PAID, AND NO COMPUTER YET: ONE FRIENDLY EMAIL, AND A LIST FOR JUSTIN.
--
-- "Get new buyers past 'no computer yet.' About 12 of your first 40 paying
-- customers never got the computer app signed in. Add a 'Send me the download
-- link' button on the three screens where they get stuck, one friendly email
-- a day after buying if no computer has signed in, and a 'paid but stuck' list
-- on your Developer page." Approved 15 October 2026, with: the email goes only
-- if no computer has signed in yet, replies come to Justin, and at most one
-- reminder after that.
--
-- WHAT IS NEW HERE, AND WHY IT HAS TO BE. The database keeps live sessions
-- only, so "has a computer EVER signed in with this account" cannot be
-- answered from what is already kept: a computer app signed out, or a session
-- that ran out, looks exactly like one never set up, and that customer would
-- be told to install something they already have. And nothing records when an
-- account FIRST had the full version: record_entitlement moves updated_at on
-- every app open. So three dates are kept from now on, and nothing else:
--
--   computer_seen     the first time a computer app was seen signed in
--   unlock_seen       the first time the account was seen with the full version
--   setup_reminders   when each setup email went, or was refused, and whether
--                     Justin left the account out
--
-- All three hang off the account (on delete cascade), so Delete account clears
-- them with nothing changed in the function that deletes.
--
-- FILLED BY LOOKING, NEVER BY A TRIGGER. note_setup_facts() snapshots what the
-- database already holds, every hour (the schedule beside this file) and every
-- time Justin opens the list. Nothing here is a trigger on public.entitlements
-- or on anything in auth: the relay's paid check and every sign-in stay
-- exactly as they were, and a mistake in this file cannot stop either.
--
-- SWITCHED OFF. setup_reminder_switch starts at off, and with it off the
-- function counts and sends nothing. It goes on only from the Developer page,
-- once Justin has read the two emails in his own inbox and left out the
-- accounts that should never get one (the store review's demo account, his
-- own test accounts).
--
-- Every function is security definer with an empty search_path and every
-- name qualified, and only service_role may call any of them; every table has
-- row-level security on, no policy, and no grant to anon or authenticated —
-- the same two locks as waiting_grants and download_link_sends.
--
-- The three tables' foreign keys lock auth.users for a moment. If a slow write
-- there holds it, give up quickly and run the file again, rather than make
-- every sign-in wait behind it.
set lock_timeout = '5s';

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------- the ledgers

create table if not exists public.computer_seen (
  account_id uuid primary key references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null
);

create table if not exists public.unlock_seen (
  account_id uuid primary key references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null,
  -- True for the accounts already unlocked when this was applied: their date
  -- is the entitlements row's last write, which can only be LATER than the
  -- day they got it, so an email is never early, only sometimes late.
  estimated boolean not null default false
);

create table if not exists public.setup_reminders (
  account_id uuid primary key references auth.users (id) on delete cascade,
  first_sent_at timestamptz,
  reminder_sent_at timestamptz,
  -- The mail service refused this person's address: a 400 or 422 whose
  -- answer is about the `to` field, and only that. Never tried again by
  -- itself, so one bad address cannot be mailed every hour; Justin's Try the
  -- email again (clear_setup_reminder_refusal) is the one way back. A 400 or
  -- 422 about anything else is the request (a key in the wrong shape, a
  -- mistyped sender), and so are a wrong key and a limit: none is written
  -- here. That claim is taken back instead (release_setup_reminder), and the
  -- next hour tries again. Nor is the service's own fault: that one may have
  -- gone, so its claim stays and it reads as sent.
  failed_at timestamptz,
  failed_kind text check (failed_kind in ('first', 'reminder')),
  left_out_at timestamptz
);

-- One row. Off until Justin turns it on.
create table if not exists public.setup_reminder_switch (
  id boolean primary key default true check (id),
  sending boolean not null default false,
  changed_at timestamptz not null default now()
);
insert into public.setup_reminder_switch (id, sending) values (true, false) on conflict (id) do nothing;

alter table public.computer_seen enable row level security;
alter table public.unlock_seen enable row level security;
alter table public.setup_reminders enable row level security;
alter table public.setup_reminder_switch enable row level security;

revoke all on table public.computer_seen from public, anon, authenticated;
revoke all on table public.unlock_seen from public, anon, authenticated;
revoke all on table public.setup_reminders from public, anon, authenticated;
revoke all on table public.setup_reminder_switch from public, anon, authenticated;
grant all on table public.computer_seen to service_role;
grant all on table public.unlock_seen to service_role;
grant all on table public.setup_reminders to service_role;
grant all on table public.setup_reminder_switch to service_role;

-- ------------------------------------------------------- looking, and the rule

-- What a computer is: the computer app's device server (its user agent starts
-- "node", the same test account_has_computer uses) or the computer app's own
-- window (Electron; account_details sorts it as 'computer' too). Counting both
-- means fewer emails, never more.
create or replace function public.note_setup_facts()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.computer_seen (account_id, first_seen_at)
  select s.user_id, min(s.created_at)
  from auth.sessions s
  where s.user_id is not null
    and (s.user_agent like 'node%' or s.user_agent ilike '%electron%')
  group by s.user_id
  on conflict (account_id) do nothing;

  insert into public.unlock_seen (account_id, first_seen_at, estimated)
  select e.account_id, e.updated_at, false
  from public.entitlements e
  where e.active and e.source = 'revenuecat'
  on conflict (account_id) do nothing;
$$;

-- THE ONE RULE, for the email and for the list alike: has the full version
-- (bought, or given by hand, which are both 'revenuecat'; never an owner row),
-- is a person (not a pairing code's hidden account, not deleted, has an
-- address), and no computer app has ever been seen on it — neither in the
-- ledger nor signed in right now.
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
$$;

-- WHO IS DUE AN EMAIL NOW, and which one. Only a confirmed address (an
-- unconfirmed one may be mistyped, or somebody else's), never anybody left
-- out, never after a refusal, and never more than two: the first a day after
-- the full version was first seen, the reminder at least four days after the
-- first, and nothing once the reminder has gone.
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
    and s.unlocked_at <= now() - interval '24 hours'
    and (s.first_sent_at is null or s.first_sent_at <= now() - interval '4 days')
$$;

-- What the hourly run asks for: looks first, then the due list, oldest first,
-- a few at a time.
create or replace function public.setup_reminders_due(at_most integer default 25)
returns table (account_id uuid, email text, kind text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.note_setup_facts();
  return query
    select d.account_id, d.email, d.kind
    from public.setup_due() d
    join public.unlock_seen l on l.account_id = d.account_id
    order by l.first_seen_at
    limit least(greatest(coalesce(at_most, 25), 0), 50);
end;
$$;

-- ASKING IS CLAIMING, like note_download_link: true means this email may go
-- now, and the row already says it went. Checked against the rule above at the
-- moment of asking (a computer that signed in since the list was read stops
-- it), and the write itself only lands on a row that has not had this email,
-- so two runs at once cannot both be told yes. Claimed before sending, so a
-- crash between the two is one email missed, never one sent twice.
--
-- And the switch, read again here, at every email: a run reads it once when it
-- starts, so turned off while that run is sending, this is what stops the rest
-- of it. At most the one email already on its way still goes.
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
        and r.first_sent_at <= now() - interval '4 days'
        and r.reminder_sent_at is null
        and r.failed_at is null
        and r.left_out_at is null
    returning true into claimed;
  end if;

  return coalesce(claimed, false);
end;
$$;

-- The mail service refused this person's address (the function only says so
-- when Resend's answer names the `to` field): the date that said it went is
-- taken back (it did not go), and the refusal is kept, which stops every
-- email after it to that account until Justin asks for it to be tried again.
create or replace function public.note_setup_reminder_failed(uid uuid, which text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.setup_reminders r
    set failed_at = now(),
        failed_kind = which,
        first_sent_at = case when which = 'first' then null else r.first_sent_at end,
        reminder_sent_at = case when which = 'reminder' then null else r.reminder_sent_at end
    where r.account_id = uid
      and which in ('first', 'reminder')
$$;

-- The mail service did not take it at all — the key refused, a limit
-- reached, the request itself turned down (a key in the wrong shape, a
-- mistyped sender) — so it did not go, and that says nothing about the person. The
-- claim's date is taken back and nothing is kept against them: the next hour
-- asks again. Never for the service's own fault (5xx), which can come back
-- after the email was taken. Only a claim of the last fifteen minutes (the
-- run that made it, seconds ago), and never once a refusal is written, so an
-- email that went can never be made to look unsent.
create or replace function public.release_setup_reminder(uid uuid, which text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.setup_reminders r
    set first_sent_at = case when which = 'first' then null else r.first_sent_at end,
        reminder_sent_at = case when which = 'reminder' then null else r.reminder_sent_at end
    where r.account_id = uid
      and which in ('first', 'reminder')
      and r.failed_at is null
      and (case when which = 'first' then r.first_sent_at else r.reminder_sent_at end) > now() - interval '15 minutes'
$$;

-- TRY THE EMAIL AGAIN, from Justin's Developer page, for somebody whose
-- address was refused: the refusal is forgotten, and the one email it
-- stopped is due again by the same rule as ever (still no computer,
-- confirmed, not left out, the reminder still four days after the first).
-- Never a second copy: a refused email never went, and its date was emptied
-- when the refusal was written. Never a third email: the first and the
-- reminder are still the only two, each claimed only where its date is
-- empty. True if there was a refusal to forget.
create or replace function public.clear_setup_reminder_refusal(uid uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cleared boolean;
begin
  update public.setup_reminders r
    set failed_at = null,
        failed_kind = null
    where r.account_id = uid
      and r.failed_at is not null
    returning true into cleared;
  return coalesce(cleared, false);
end;
$$;

-- ------------------------------------------------------------------ the switch

create or replace function public.setup_reminder_sending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select w.sending from public.setup_reminder_switch w where w.id), false)
$$;

create or replace function public.set_setup_reminder_switch(turn_on boolean)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.setup_reminder_switch as w (id, sending, changed_at)
  values (true, coalesce(turn_on, false), now())
  on conflict (id) do update set sending = excluded.sending, changed_at = now()
  returning w.sending
$$;

-- Leave an account out of the emails for good, or put it back. Putting it back
-- never resends anything: the dates of what already went stay.
create or replace function public.set_setup_left_out(uid uuid, leave_out boolean)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.setup_reminders as r (account_id, left_out_at)
  values (uid, case when coalesce(leave_out, true) then now() end)
  on conflict (account_id) do update
    set left_out_at = case when coalesce(leave_out, true) then coalesce(r.left_out_at, now()) end
  returning r.left_out_at is not null
$$;

-- His own account, left out from the start. The id is shared/admin.mjs's
-- ADMINS, and a test holds the two equal.
insert into public.setup_reminders as r (account_id, left_out_at)
select u.id, now() from auth.users u where u.id = '7dfe6912-e43b-49bf-84e4-b56afbd442b1'
on conflict (account_id) do update set left_out_at = coalesce(r.left_out_at, now());

-- ------------------------------------------------------------------- the list

-- PAID BUT NO COMPUTER YET, for Justin's Developer page through grant-access,
-- which checks it is him before asking. Looks first, so the list is today's
-- even with the schedule not running. Newest first. Names come out only here,
-- to him: the email function itself is never handed this.
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
    -- Emailed, and a computer has signed in since: the email doing its job.
    'set_up_after', (
      select count(*)
      from public.setup_reminders r
      join public.computer_seen c on c.account_id = r.account_id
      where r.first_sent_at is not null and c.first_seen_at > r.first_sent_at
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

-- ------------------------------------------------- the hourly call to the email

-- The shared secret between the schedule and the setup-reminder function,
-- generated here and read back by the function, exactly as the feedback email
-- does it (20260905_feedback_email.sql): nothing for anybody to type twice.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'setup_reminder_hook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'setup_reminder_hook_secret',
      'Shared between the setup-reminders schedule and the setup-reminder function.'
    );
  end if;
end $$;

create or replace function public.setup_reminder_hook_secret()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s text;
begin
  select decrypted_secret into s
  from vault.decrypted_secrets
  where name = 'setup_reminder_hook_secret'
  limit 1;
  return s;
end;
$$;

-- What the schedule runs. `net.http_post`, never extensions.net.http_post
-- (the three-part name is a cross-database reference and raises; see the
-- feedback migration), inside an exception block so nothing on the way to an
-- inbox can fail the schedule.
--
-- Two minutes to answer. A full run is up to 25 emails, each claimed, sent
-- and followed by a short gap, which can come near half a minute; if the call
-- were given up while the function was still sending, the email claimed at
-- that moment would read as sent and never have gone.
create or replace function public.run_setup_reminders()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hook_secret text;
  fn_url text := 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/setup-reminder';
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'setup_reminder_hook_secret'
  limit 1;

  if hook_secret is null then
    raise log 'run_setup_reminders: no setup_reminder_hook_secret in vault, nothing asked';
    return;
  end if;

  begin
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', hook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  exception when others then
    raise log 'run_setup_reminders: could not queue the call: %', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------- who may call them

revoke all on function public.note_setup_facts() from public, anon, authenticated;
revoke all on function public.setup_stuck() from public, anon, authenticated;
revoke all on function public.setup_due() from public, anon, authenticated;
revoke all on function public.setup_reminders_due(integer) from public, anon, authenticated;
revoke all on function public.claim_setup_reminder(uuid, text) from public, anon, authenticated;
revoke all on function public.note_setup_reminder_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.release_setup_reminder(uuid, text) from public, anon, authenticated;
revoke all on function public.clear_setup_reminder_refusal(uuid) from public, anon, authenticated;
revoke all on function public.setup_reminder_sending() from public, anon, authenticated;
revoke all on function public.set_setup_reminder_switch(boolean) from public, anon, authenticated;
revoke all on function public.set_setup_left_out(uuid, boolean) from public, anon, authenticated;
revoke all on function public.owner_setup_stuck() from public, anon, authenticated;
revoke all on function public.setup_reminder_hook_secret() from public, anon, authenticated;
revoke all on function public.run_setup_reminders() from public, anon, authenticated;

grant execute on function public.note_setup_facts() to service_role;
grant execute on function public.setup_stuck() to service_role;
grant execute on function public.setup_due() to service_role;
grant execute on function public.setup_reminders_due(integer) to service_role;
grant execute on function public.claim_setup_reminder(uuid, text) to service_role;
grant execute on function public.note_setup_reminder_failed(uuid, text) to service_role;
grant execute on function public.release_setup_reminder(uuid, text) to service_role;
grant execute on function public.clear_setup_reminder_refusal(uuid) to service_role;
grant execute on function public.setup_reminder_sending() to service_role;
grant execute on function public.set_setup_reminder_switch(boolean) to service_role;
grant execute on function public.set_setup_left_out(uuid, boolean) to service_role;
grant execute on function public.owner_setup_stuck() to service_role;
grant execute on function public.setup_reminder_hook_secret() to service_role;
grant execute on function public.run_setup_reminders() to service_role;

-- THE FIRST LOOK, as the accounts stand today. Unlock dates from before this
-- are estimates (see unlock_seen), so mark them; computers seen today count.
insert into public.unlock_seen (account_id, first_seen_at, estimated)
select e.account_id, e.updated_at, true
from public.entitlements e
where e.active and e.source = 'revenuecat'
on conflict (account_id) do nothing;

select public.note_setup_facts();
