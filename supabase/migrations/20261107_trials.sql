-- THE SEVEN-DAY FREE TRIAL.
--
-- "Okay, let's get the seven-day trial built out." (Justin, 7 November 2026.)
-- One trial per account, ever, and one per device, of everything the full
-- version gives, with the player's own rig. Its length is TRIAL_DAYS in
-- shared/trial-rule.mjs; the server function that starts one
-- (supabase/functions/trial) works the end out from it and writes it here,
-- so nothing in this file counts days.
--
-- APPLY THIS BEFORE DEPLOYING `trial` AND THE NEW `entitlement`. Both call
-- the functions below; until they exist, `trial` answers that it could not
-- start one, and `entitlement` answers as it always has, with no trial.
--
-- WHAT IT NEVER TOUCHES: public.entitlements. A trial is its own row in its
-- own table, so it can neither overwrite nor shorten a purchase, and an
-- owner or a sale stays exactly what it was. The relay's one question,
-- is_entitled, is answered yes for a trial still running, and goes back to
-- no by itself the second it ends: nothing has to run on day 8.
--
-- SERVICE ROLE ONLY. Row level security on, no policy, nothing granted to
-- anon or authenticated: a client that could write here could give itself a
-- trial, and one that could read the device column could match devices.

-- ---------------------------------------------------------------- the trials

create table if not exists public.trials (
  account_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  -- The device's install number (the one the app's update check already
  -- sends to Expo, or the browser's made-up number), never as it was sent:
  -- a SHA-256 of it with the server's own salt (supabase/functions/trial).
  device_key text not null check (device_key ~ '^[0-9a-f]{64}$'),
  platform text not null check (platform in ('ios', 'android', 'web', 'computer')),
  -- 'app_store_trial': the App Store's free 7-Day Trial item was bought (an
  -- iPhone or iPad, Apple's guideline 3.1.1). 'server': asked for from
  -- Android, the website or the computer app, where no store item is needed.
  source text not null check (source in ('app_store_trial', 'server')),
  created_at timestamptz not null default now(),
  check (ends_at > started_at)
);

-- ONE PER DEVICE, among the accounts that exist.
create unique index if not exists trials_one_per_device on public.trials (device_key);

alter table public.trials enable row level security;
revoke all on table public.trials from public, anon, authenticated;

-- AND ONE PER DEVICE AFTER AN ACCOUNT IS DELETED. Deleting an account
-- deletes its trial (on delete cascade, above), and without this a device
-- could take a fresh trial on every account it made and deleted. Only the
-- salted hash and the day: nothing here names an account or a person.
create table if not exists public.trial_devices (
  device_key text primary key check (device_key ~ '^[0-9a-f]{64}$'),
  first_at timestamptz not null default now()
);

alter table public.trial_devices enable row level security;
revoke all on table public.trial_devices from public, anon, authenticated;

-- ---------------------------------------------------------------- starting one

-- Start a trial for `uid` on `device`, from `began` to `ends`, or say why
-- not. The decision about WHEN is the function's (shared/trial-rule.mjs
-- trialStart: an iPhone's begins when the free App Store item was bought);
-- this holds the three limits where two requests at once cannot both get
-- past them:
--
--   bought   the account has the full version: nothing to try
--   used     the account has had a trial, running or over. Never a second,
--            and never an end moved: asked again it answers the same row
--   device   this device has had one, on any account, living or deleted
--
-- Answers { ok, why, started_at, ends_at }.
create or replace function public.start_trial(
  uid uuid,
  device text,
  from_platform text,
  from_source text,
  began timestamptz,
  ends timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  had public.trials%rowtype;
begin
  if exists (select 1 from public.entitlements where account_id = uid and active) then
    return jsonb_build_object('ok', false, 'why', 'bought');
  end if;
  select * into had from public.trials where account_id = uid;
  if found then
    return jsonb_build_object('ok', false, 'why', 'used', 'started_at', had.started_at, 'ends_at', had.ends_at);
  end if;
  if exists (select 1 from public.trial_devices where device_key = device)
     or exists (select 1 from public.trials where device_key = device) then
    return jsonb_build_object('ok', false, 'why', 'device');
  end if;
  begin
    insert into public.trials (account_id, started_at, ends_at, device_key, platform, source)
    values (uid, began, ends, device, from_platform, from_source);
    insert into public.trial_devices (device_key) values (device) on conflict (device_key) do nothing;
  exception when unique_violation then
    -- Two at once: whichever landed first is the one, and this is told why.
    select * into had from public.trials where account_id = uid;
    if found then
      return jsonb_build_object('ok', false, 'why', 'used', 'started_at', had.started_at, 'ends_at', had.ends_at);
    end if;
    return jsonb_build_object('ok', false, 'why', 'device');
  end;
  return jsonb_build_object('ok', true, 'started_at', began, 'ends_at', ends);
end;
$$;

revoke all on function public.start_trial(uuid, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.start_trial(uuid, text, text, text, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------- reading one

-- This account's trial, running or over, or null: what `entitlement` sends
-- back to the app beside the purchase, so it can say how many days are left.
create or replace function public.trial_of(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('started_at', t.started_at, 'ends_at', t.ends_at, 'platform', t.platform, 'source', t.source)
  from public.trials t
  where t.account_id = uid
$$;

revoke all on function public.trial_of(uuid) from public, anon, authenticated;
grant execute on function public.trial_of(uuid) to service_role;

-- ---------------------------------------------------------------- the relay

-- THE ONE QUESTION THE RELAY ASKS, now with the trial in it: paid (or an
-- owner), or a trial still running. Ends by the clock, on the second.
-- Otherwise exactly as 20260923_entitlements.sql wrote it: security definer,
-- its path pinned, callable by a signed-in user and the service role only.
create or replace function public.is_entitled(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select active from public.entitlements where account_id = uid), false)
      or exists (select 1 from public.trials where account_id = uid and now() < ends_at)
$$;

revoke all on function public.is_entitled(uuid) from public;
grant execute on function public.is_entitled(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- Sales

-- Every trial, newest first, for Justin's Sales page (grant-access 'sales',
-- his account only): whose, when it started and ends, where, and whether the
-- account has bought since. Never the device column.
create or replace function public.owner_trials()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'email', u.email,
      'started_at', t.started_at,
      'ends_at', t.ends_at,
      'platform', t.platform,
      'source', t.source,
      'converted', coalesce(e.active, false) and e.source = 'revenuecat'
    ) order by t.started_at desc), '[]'::jsonb)
  from (select * from public.trials order by started_at desc limit 500) t
  join auth.users u on u.id = t.account_id
  left join public.entitlements e on e.account_id = t.account_id
$$;

revoke all on function public.owner_trials() from public, anon, authenticated;
grant execute on function public.owner_trials() to service_role;
