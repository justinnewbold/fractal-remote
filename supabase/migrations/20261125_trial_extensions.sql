-- MORE TIME ON A FREE TRIAL, ONE EMAIL NEAR ITS END, AND A RECORD OF BOTH.
--
-- A trial started and never used again tells Justin nothing. So (25 November
-- 2026): one friendly email from him on a trial's last day asking how it is
-- going; a week more, by itself, for somebody who never got a unit connected
-- (never on an iPhone or iPad's trial, see below); a button on his Developer
-- page that gives any trial more days; and every extension written down, so
-- he can see what the email and the extra time did.
--
-- Applied after 20261107_trials.sql, 20261015_setup_reminders.sql and
-- 20261101_bluetooth_seen.sql, whose tables it reads.
--
-- APPLY THIS BEFORE DEPLOYING `trial-nudge` AND THE NEW `grant-access`.
-- Until it is applied, grant-access's new actions answer that the database
-- does not have this yet, and the Trials page lists the trials as before.
--
-- THE ONE THING THAT MOVES A TRIAL'S END IS extend_trial(), and it only ever
-- moves it later. start_trial (20261107_trials.sql) still never writes a
-- second trial and never moves an end. Each copy of the app hears the new
-- end from `entitlement` the next time it asks (trial_of reads the row), and
-- keeps it (shared/trial-rule.mjs keptTrial).
--
-- AN iPHONE OR iPAD'S TRIAL IS NEVER EXTENDED BY ITSELF. Apple's guideline
-- 3.1.1 allows a free trial in an app that is not a subscription only as an
-- item named for its length ("7-Day Trial"). That rule is the email
-- function's (shared/trial-rule.mjs nudgePlan); this file only refuses a
-- second automatic week for anybody.
--
-- WHAT IT NEVER TOUCHES: public.entitlements. A trial given more days is
-- still only a trial, and a purchase still wins over it.
--
-- SWITCHED OFF. trial_nudge_switch starts at off, and with it off the email
-- function counts and sends nothing, and extends nobody. It goes on only
-- from the Developer page, once Justin has read both emails in his own inbox.
--
-- SERVICE ROLE ONLY. Every table has row level security on, no policy, and
-- nothing granted to anon or authenticated; every function is security
-- definer with an empty search_path and every name qualified, and only
-- service_role may call any of them. A client that could call extend_trial
-- could give itself a trial for good.
set lock_timeout = '5s';

create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------ the record

-- Every extension, as it was made: whose, how many days, who gave it
-- ('owner' is Justin's button, 'auto' the email's week), and the end before
-- and after. Hangs off the account, so Delete account clears it.
create table if not exists public.trial_extensions (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users (id) on delete cascade,
  days integer not null check (days between 1 and 30),
  "by" text not null check ("by" in ('owner', 'auto')),
  old_ends_at timestamptz not null,
  new_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists trial_extensions_by_account on public.trial_extensions (account_id, created_at desc);

alter table public.trial_extensions enable row level security;
revoke all on table public.trial_extensions from public, anon, authenticated;
grant all on table public.trial_extensions to service_role;

-- When the trial email went (or was claimed to go), and which one:
--   'ask'      how is it going, reply for more time
--   'extend'   a week was added, and the email says so
--   'refused'  the mail service refused this person's address; never tried again
alter table public.trials add column if not exists nudged_at timestamptz;
alter table public.trials add column if not exists nudge_kind text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trials_nudge_kind_check') then
    alter table public.trials add constraint trials_nudge_kind_check check (nudge_kind is null or nudge_kind in ('ask', 'extend', 'refused'));
  end if;
end $$;

-- One row. Off until Justin turns it on.
create table if not exists public.trial_nudge_switch (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  changed_at timestamptz not null default now()
);
insert into public.trial_nudge_switch (id, enabled) values (true, false) on conflict (id) do nothing;

alter table public.trial_nudge_switch enable row level security;
revoke all on table public.trial_nudge_switch from public, anon, authenticated;
grant all on table public.trial_nudge_switch to service_role;

-- ------------------------------------------------------------ more time

-- Give `uid`'s trial `days` more, or say why not:
--
--   bad      days outside 1 to 30, or `who` not 'owner' or 'auto'
--   none     the account has no trial to extend
--   bought   the account has the full version: nothing to extend
--   had      'auto' only: this account has had its automatic week already.
--            Justin's own button ('owner') has no such limit.
--
-- The new end is counted from now for a trial that is over, and from its end
-- for one still running, so "7 more days" is seven days of use either way.
-- It is always later than the old end, so ends_at > started_at stays true.
--
-- The trial's row is locked first, so two calls at once take their turns:
-- the second sees what the first wrote, and two automatic weeks cannot both
-- get past the 'had' check.
--
-- Answers { ok, why, ends_at, old_ends_at }.
create or replace function public.extend_trial(uid uuid, days integer, who text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.trials%rowtype;
  new_end timestamptz;
begin
  if uid is null or days is null or days < 1 or days > 30 or who is null or who not in ('owner', 'auto') then
    return jsonb_build_object('ok', false, 'why', 'bad');
  end if;
  select * into t from public.trials tr where tr.account_id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'why', 'none');
  end if;
  if exists (select 1 from public.entitlements e where e.account_id = uid and e.active) then
    return jsonb_build_object('ok', false, 'why', 'bought');
  end if;
  if who = 'auto' and exists (select 1 from public.trial_extensions x where x.account_id = uid and x."by" = 'auto') then
    return jsonb_build_object('ok', false, 'why', 'had', 'ends_at', t.ends_at);
  end if;
  new_end := greatest(now(), t.ends_at) + make_interval(days => days);
  update public.trials tr set ends_at = new_end where tr.account_id = uid;
  insert into public.trial_extensions (account_id, days, "by", old_ends_at, new_ends_at)
  values (uid, days, who, t.ends_at, new_end);
  return jsonb_build_object('ok', true, 'ends_at', new_end, 'old_ends_at', t.ends_at);
end;
$$;

-- ------------------------------------------------------------ the switch

create or replace function public.trial_nudge_sending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select w.enabled from public.trial_nudge_switch w where w.id), false)
$$;

create or replace function public.set_trial_nudge_switch(turn_on boolean)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.trial_nudge_switch as w (id, enabled, changed_at)
  values (true, coalesce(turn_on, false), now())
  on conflict (id) do update set enabled = excluded.enabled, changed_at = now()
  returning w.enabled
$$;

-- ------------------------------------------------------------ who is due

-- Has this account ever connected a unit, as far as the server can know: a
-- computer app seen signed in (computer_seen, or signed in right now), or
-- the phone's own word that a unit answered over Bluetooth (bluetooth_seen).
create or replace function public.trial_connected(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.computer_seen c where c.account_id = uid)
      or exists (select 1 from public.bluetooth_seen b where b.account_id = uid)
      or exists (
        select 1 from auth.sessions s
        where s.user_id = uid
          and (s.user_agent like 'node%' or s.user_agent ilike '%electron%')
      )
$$;

-- WHO IS DUE THE TRIAL EMAIL NOW. One email a trial, ever (nudged_at), and
-- only to a person: a confirmed address (an unconfirmed one may be mistyped,
-- or somebody else's), not deleted, not a pairing code's hidden account, and
-- not somebody who has the full version. Due on the trial's last day: it
-- ends within the next 24 hours and has not ended.
--
-- And one more case, so a week that was added is never added in silence:
-- an automatic week given in the last two days whose email did not go (the
-- mail service turned the request away and the claim was taken back). That
-- trial no longer ends within a day, but its email is still owed; the
-- function says the week as added and adds nothing more (nudgePlan's
-- 'extended').
create or replace function public.trial_nudge_due()
returns table (account_id uuid, email text, platform text, connected boolean, ends_at timestamptz, auto_extended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.account_id,
    u.email::text,
    t.platform,
    public.trial_connected(t.account_id),
    t.ends_at,
    x.at
  from public.trials t
  join auth.users u on u.id = t.account_id
  left join lateral (
    select max(e.created_at) as at
    from public.trial_extensions e
    where e.account_id = t.account_id and e."by" = 'auto'
  ) x on true
  where t.nudged_at is null
    and t.ends_at > now()
    and (t.ends_at <= now() + interval '24 hours' or x.at > now() - interval '2 days')
    and u.deleted_at is null
    and u.email_confirmed_at is not null
    and coalesce(u.email, '') <> ''
    and lower(u.email) not like '%@pair.fractal.newbold.cloud'
    and not exists (select 1 from public.entitlements p where p.account_id = t.account_id and p.active)
$$;

-- What the hourly run asks for: looks first (so "has a computer ever signed
-- in" is today's), then the due list, the trial ending soonest first, a few
-- at a time.
create or replace function public.trial_nudges_due(at_most integer default 25)
returns table (account_id uuid, email text, platform text, connected boolean, ends_at timestamptz, auto_extended_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.note_setup_facts();
  return query
    select d.account_id, d.email, d.platform, d.connected, d.ends_at, d.auto_extended_at
    from public.trial_nudge_due() d
    order by d.ends_at
    limit least(greatest(coalesce(at_most, 25), 0), 50);
end;
$$;

-- ASKING IS CLAIMING, like claim_setup_reminder: true means this email may
-- go now, and the row already says it went. The switch is read again here,
-- at every email, so turned off in the middle of a run it stops the rest of
-- it. The rule is checked again at the moment of asking (somebody who bought
-- since the list was read gets nothing), and the write only lands on a row
-- that has not been emailed, so two runs at once cannot both be told yes.
-- Claimed before sending, so a crash between the two is one email missed,
-- never one sent twice.
create or replace function public.claim_trial_nudge(uid uuid, which text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if uid is null or which is null or which not in ('ask', 'extend') then
    return false;
  end if;
  if not public.trial_nudge_sending() then
    return false;
  end if;
  if not exists (select 1 from public.trial_nudge_due() d where d.account_id = uid) then
    return false;
  end if;
  update public.trials t
    set nudged_at = now(), nudge_kind = which
    where t.account_id = uid and t.nudged_at is null
    returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

-- What became of a claimed email, when it is not what the claim said: 'ask'
-- when the week could not be added after all and the email only asked, and
-- 'refused' when the mail service refused this person's address (kept, so
-- it is never tried again). Only on a row already claimed.
create or replace function public.note_trial_nudge_kind(uid uuid, which text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.trials t
    set nudge_kind = which
    where t.account_id = uid
      and t.nudged_at is not null
      and which in ('ask', 'extend', 'refused')
$$;

-- The mail service did not take it at all (the key refused, a limit
-- reached, the request itself turned down), or the account turned out to
-- have bought: the claim is taken back and nothing is held against them.
-- Only a claim of the last fifteen minutes (the run that made it, seconds
-- ago), and never once a refusal is written, so an email that went can
-- never be made to look unsent.
create or replace function public.release_trial_nudge(uid uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.trials t
    set nudged_at = null, nudge_kind = null
    where t.account_id = uid
      and t.nudged_at > now() - interval '15 minutes'
      and t.nudge_kind is distinct from 'refused'
$$;

-- ------------------------------------------------------------ the list

-- Every trial, newest first, for Justin's Trials page and Sales
-- (grant-access, his account only), replacing 20261107_trials.sql's. As
-- before: whose (the email, never the account's id), when, where, and
-- whether the account has bought since; never the device column. And now:
--
--   connected      a computer or Bluetooth has ever been seen on the account
--   nudged_at      when the trial email went, and nudge_kind which one
--   extended_days  every extension's days, added up
--   extended_by    who gave the latest ('owner' or 'auto')
--   extended_at    when the latest was given
--
-- Looks first (note_setup_facts), so "connected" is today's even with no
-- schedule running; a failure there never stops the list.
create or replace function public.owner_trials()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  answer jsonb;
begin
  begin
    perform public.note_setup_facts();
  exception when others then
    raise log 'owner_trials: could not look for computers first: %', sqlerrm;
  end;
  select coalesce(jsonb_agg(jsonb_build_object(
      'email', u.email,
      'started_at', t.started_at,
      'ends_at', t.ends_at,
      'platform', t.platform,
      'source', t.source,
      'converted', coalesce(e.active, false) and e.source = 'revenuecat',
      'connected', public.trial_connected(t.account_id),
      'nudged_at', t.nudged_at,
      'nudge_kind', t.nudge_kind,
      'extended_days', coalesce(x.days, 0),
      'extended_by', x.latest_by,
      'extended_at', x.latest_at
    ) order by t.started_at desc), '[]'::jsonb)
  into answer
  from (select * from public.trials order by started_at desc limit 500) t
  join auth.users u on u.id = t.account_id
  left join public.entitlements e on e.account_id = t.account_id
  left join lateral (
    select
      sum(n.days)::integer as days,
      (array_agg(n."by" order by n.created_at desc))[1] as latest_by,
      max(n.created_at) as latest_at
    from public.trial_extensions n
    where n.account_id = t.account_id
  ) x on true;
  return answer;
end;
$$;

-- ------------------------------------------------- the hourly call to the email

-- The shared secret between the schedule and the trial-nudge function, made
-- here and read back by the function, exactly as the setup emails do it
-- (20261015_setup_reminders.sql): nothing for anybody to type twice.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'trial_nudge_hook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'trial_nudge_hook_secret',
      'Shared between the trial-nudges schedule and the trial-nudge function.'
    );
  end if;
end $$;

create or replace function public.trial_nudge_hook_secret()
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
  where name = 'trial_nudge_hook_secret'
  limit 1;
  return s;
end;
$$;

-- What the schedule runs. `net.http_post`, never extensions.net.http_post,
-- inside an exception block so nothing on the way to an inbox can fail the
-- schedule; two minutes to answer, as run_setup_reminders has and for its
-- reason (a call given up mid-run would leave an email claimed and unsent).
create or replace function public.run_trial_nudges()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hook_secret text;
  fn_url text := 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/trial-nudge';
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'trial_nudge_hook_secret'
  limit 1;

  if hook_secret is null then
    raise log 'run_trial_nudges: no trial_nudge_hook_secret in vault, nothing asked';
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
    raise log 'run_trial_nudges: could not queue the call: %', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------- who may call them

revoke all on function public.extend_trial(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.trial_nudge_sending() from public, anon, authenticated;
revoke all on function public.set_trial_nudge_switch(boolean) from public, anon, authenticated;
revoke all on function public.trial_connected(uuid) from public, anon, authenticated;
revoke all on function public.trial_nudge_due() from public, anon, authenticated;
revoke all on function public.trial_nudges_due(integer) from public, anon, authenticated;
revoke all on function public.claim_trial_nudge(uuid, text) from public, anon, authenticated;
revoke all on function public.note_trial_nudge_kind(uuid, text) from public, anon, authenticated;
revoke all on function public.release_trial_nudge(uuid) from public, anon, authenticated;
revoke all on function public.owner_trials() from public, anon, authenticated;
revoke all on function public.trial_nudge_hook_secret() from public, anon, authenticated;
revoke all on function public.run_trial_nudges() from public, anon, authenticated;

grant execute on function public.extend_trial(uuid, integer, text) to service_role;
grant execute on function public.trial_nudge_sending() to service_role;
grant execute on function public.set_trial_nudge_switch(boolean) to service_role;
grant execute on function public.trial_connected(uuid) to service_role;
grant execute on function public.trial_nudge_due() to service_role;
grant execute on function public.trial_nudges_due(integer) to service_role;
grant execute on function public.claim_trial_nudge(uuid, text) to service_role;
grant execute on function public.note_trial_nudge_kind(uuid, text) to service_role;
grant execute on function public.release_trial_nudge(uuid) to service_role;
grant execute on function public.owner_trials() to service_role;
grant execute on function public.trial_nudge_hook_secret() to service_role;
grant execute on function public.run_trial_nudges() to service_role;

-- ------------------------------------------------------------ the schedule

-- THE HOURLY LOOK FOR TRIAL EMAILS THAT ARE DUE, at 41 minutes past (the
-- setup emails look at 23 past, and nothing here lands on the hour). The
-- switch above decides whether a run sends anything; this only asks.
-- Scheduling under the same name again replaces the job rather than adding
-- a second one. pg_cron is on in this project (the setup emails and the
-- sweeps use it); where it is not, this says so and the rest of the file
-- still applies: turn it on in the dashboard (Integrations → Cron) and run
-- the one `cron.schedule` line by hand. Until the job exists nothing is
-- sent at all.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('trial-nudges', '41 * * * *', 'select public.run_trial_nudges()');
  else
    raise notice 'pg_cron is not on: the trial-nudges job was not scheduled';
  end if;
end $$;
