-- HOW MANY PEOPLE, DAY BY DAY.
--
-- "A day-by-day history of how many people use the app, on your Developer
-- page" (Justin, approved 4 November 2026, "Go with your picks").
-- Developer → Customers → People counts who used the app today, in the last
-- 7 days and in the last 30, from what is kept anyway: when each account last
-- signed in, when each signed-in device last checked in (auth.sessions), and
-- when RevenueCat last saw the app open. Each of those keeps only the LATEST
-- time, so a day can only be counted on that day. So once a day, a few
-- minutes before midnight UTC, the database asks grant-access to count the
-- day exactly as People counts it (shared/usage-count.mjs), and keeps the
-- totals here.
--
-- ONLY TOTALS. One row a day: how many people, and how many in each of four
-- places, on each app version and on each phone system. No account, no id, no
-- address: nothing in a row names anybody, and nothing new is collected from
-- anybody to make it. The breakdowns are held to that shape by the table
-- itself (usage_breakdown_ok, below), and an app version to a version number,
-- so not even a copy of the app that sent words in its place can put a name
-- in one. (With few customers a count can be 1, one person on one system
-- that day; that is no more than his Customer lookup already shows.)
--
-- READ ONLY THROUGH grant-access, on Justin's account: row level security
-- on, no policy, and nothing granted to anon or authenticated. The function
-- reads it with owner_usage_days(), which only service_role may call.
--
-- Kept two years: every firing of the nightly job deletes the older days
-- first, before it asks for anything, so it holds even on a night the count
-- itself fails (run_usage_day). If the job is ever taken off the schedule,
-- empty or drop the table in the same change, or "then deleted" on the
-- privacy page stops being true.
--
-- The schedule is in a file of its own, 20261104_usage_days_schedule.sql,
-- applied after grant-access is deployed with the usage-day hook.

-- ---------------------------------------------------------------- the shape

-- A breakdown is {"day": {label: count}, "month": {label: count}}: at most
-- 40 labels in each, none longer than 40 letters, every count a whole number
-- of people, nought or more, and, when `shape` is given, every label matching
-- it. Anything else is refused.
create or replace function public.usage_breakdown_ok(b jsonb, shape text default null)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  part record;
  entry record;
begin
  if b is null or jsonb_typeof(b) <> 'object' then
    return false;
  end if;
  for part in select key, value from jsonb_each(b) loop
    if part.key not in ('day', 'month') or jsonb_typeof(part.value) <> 'object' then
      return false;
    end if;
    if (select count(*) from jsonb_object_keys(part.value)) > 40 then
      return false;
    end if;
    for entry in select key, value from jsonb_each(part.value) loop
      if length(entry.key) not between 1 and 40
        or (shape is not null and entry.key !~ shape)
        or jsonb_typeof(entry.value) <> 'number'
        or (entry.value #>> '{}')::numeric < 0
        or (entry.value #>> '{}')::numeric <> trunc((entry.value #>> '{}')::numeric) then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

-- ---------------------------------------------------------------- the table

create table if not exists public.usage_days (
  day date primary key,
  active_day integer not null check (active_day >= 0),
  active_7 integer not null check (active_7 >= 0),
  active_30 integer not null check (active_30 >= 0),
  accounts integer not null check (accounts >= 0),
  counted integer not null check (counted >= 0),
  unanswered integer not null default 0 check (unanswered >= 0),
  places jsonb not null default '{}'::jsonb check (public.usage_breakdown_ok(places)),
  -- A version number, or Other: VERSION_LABEL in shared/usage-count.mjs, which folds anything else into Other first.
  versions jsonb not null default '{}'::jsonb check (public.usage_breakdown_ok(versions, '^([0-9]{1,6}(\.[0-9]{1,6}){0,3}|Other)$')),
  systems jsonb not null default '{}'::jsonb check (public.usage_breakdown_ok(systems)),
  computed_at timestamptz not null default now()
);

comment on table public.usage_days is
  'How many people used the app each UTC day: counts only, one row a day, naming nobody. Read only through grant-access.';

alter table public.usage_days enable row level security;
revoke all on table public.usage_days from public, anon, authenticated;

-- ------------------------------------------------------- keeping a day

-- The night's count, from grant-access. Only TODAY (UTC) can be written: the
-- times it is counted from keep only the latest, so a day that has passed
-- could only be counted wrong, and no run may rewrite one.
--
-- Safe to run twice, or two at once: the day is the key. A later count
-- replaces the day's row, because it has seen more of the day:
--
--   - always, when the one kept was made before the night's counts begin
--     (23:43 UTC, COUNT_HOUR_UTC and COUNT_MINUTES_UTC in
--     shared/usage-count.mjs): a count asked for by hand during the day is
--     only a first look, and the night's replaces it whatever it found;
--   - when it saw more people that day, even if RevenueCat failed to answer
--     about more of them (the misses are kept with it, and the page says so);
--   - and otherwise only when RevenueCat failed to answer about no more
--     people than in the one kept, so a busy minute at RevenueCat never
--     overwrites a fuller count.
--
-- True when this count is the one kept.
create or replace function public.record_usage_day(d date, counts jsonb)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  kept boolean;
begin
  if d is null or d <> (now() at time zone 'utc')::date then
    raise exception 'record_usage_day: only today (UTC) can be counted, and % is not today', d;
  end if;
  if counts is null or jsonb_typeof(counts) <> 'object' then
    raise exception 'record_usage_day: the counts are not an object';
  end if;

  insert into public.usage_days as u (
    day, active_day, active_7, active_30, accounts, counted, unanswered, places, versions, systems, computed_at
  ) values (
    d,
    (counts ->> 'active_day')::integer,
    (counts ->> 'active_7')::integer,
    (counts ->> 'active_30')::integer,
    (counts ->> 'accounts')::integer,
    (counts ->> 'counted')::integer,
    coalesce((counts ->> 'unanswered')::integer, 0),
    coalesce(counts -> 'places', '{}'::jsonb),
    coalesce(counts -> 'versions', '{}'::jsonb),
    coalesce(counts -> 'systems', '{}'::jsonb),
    now()
  )
  on conflict (day) do update set
    active_day = excluded.active_day,
    active_7 = excluded.active_7,
    active_30 = excluded.active_30,
    accounts = excluded.accounts,
    counted = excluded.counted,
    unanswered = excluded.unanswered,
    places = excluded.places,
    versions = excluded.versions,
    systems = excluded.systems,
    computed_at = excluded.computed_at
  where u.computed_at < (d + time '23:43') at time zone 'utc'
    or excluded.active_day > u.active_day
    or excluded.unanswered <= u.unanswered
  returning true into kept;

  return coalesce(kept, false);
end;
$$;

-- The days for the page, newest first: the last `most` (31 for the page, at
-- most 800). Every column, and nothing else.
create or replace function public.owner_usage_days(most integer default 31)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', u.day,
    'active_day', u.active_day,
    'active_7', u.active_7,
    'active_30', u.active_30,
    'accounts', u.accounts,
    'counted', u.counted,
    'unanswered', u.unanswered,
    'places', u.places,
    'versions', u.versions,
    'systems', u.systems,
    'computed_at', u.computed_at
  ) order by u.day desc), '[]'::jsonb)
  from (
    select * from public.usage_days
    order by day desc
    limit greatest(1, least(coalesce(most, 31), 800))
  ) u
$$;

-- ------------------------------------------------- the nightly call to count

-- The shared secret between the schedule and grant-access's usage-day hook,
-- made here and read back by the function, exactly as the setup emails do it
-- (20261015_setup_reminders.sql). Its own secret, so a leak opens this one
-- door and no other.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'usage_day_hook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'usage_day_hook_secret',
      'Shared between the usage-days schedule and grant-access''s usage-day hook.'
    );
  end if;
end $$;

create or replace function public.usage_day_hook_secret()
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
  where name = 'usage_day_hook_secret'
  limit 1;
  return s;
end;
$$;

-- What the schedule runs, and what to run by hand for one count of today:
--
--   select public.run_usage_day();
--
-- It deletes the days over two years old first, at every firing, before it
-- asks for anything: the privacy page's "kept two years, then deleted" holds
-- whether or not grant-access, RevenueCat or the call itself then works.
--
-- `net.http_post`, never extensions.net.http_post (the three-part name is a
-- cross-database reference and raises; see the feedback migration), inside an
-- exception block so nothing on the way can fail the schedule.
--
-- grant-access keeps verify_jwt on, so the gateway wants a project key: the
-- PUBLIC one, the same the app ships in mobile/src/lib/project.js (a test
-- holds the two equal). It opens nothing by itself: the function's own lock
-- turns it away, and only the secret opens the hook.
--
-- Two minutes to answer: the count asks about as much as opening People once.
create or replace function public.run_usage_day()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hook_secret text;
  fn_url text := 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/grant-access';
  public_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpem53cnFlY2t2aWF3anVodnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjIyNDksImV4cCI6MjEwMzQ5ODI0OX0.WT2K6kxqy5cMc1tL-Lr3JgTwwhFYY2t-NJsOXNJXgVU';
begin
  -- Two years, then gone.
  delete from public.usage_days where day < (now() at time zone 'utc')::date - 730;

  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'usage_day_hook_secret'
  limit 1;

  if hook_secret is null then
    raise log 'run_usage_day: no usage_day_hook_secret in vault, nothing asked';
    return;
  end if;

  begin
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public_key,
        'apikey', public_key,
        'x-hook-secret', hook_secret
      ),
      body := jsonb_build_object('action', 'usage-day'),
      timeout_milliseconds := 120000
    );
  exception when others then
    raise log 'run_usage_day: could not queue the call: %', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------- who may call them

revoke all on function public.usage_breakdown_ok(jsonb, text) from public, anon, authenticated;
revoke all on function public.record_usage_day(date, jsonb) from public, anon, authenticated;
revoke all on function public.owner_usage_days(integer) from public, anon, authenticated;
revoke all on function public.usage_day_hook_secret() from public, anon, authenticated;
revoke all on function public.run_usage_day() from public, anon, authenticated;

grant execute on function public.usage_breakdown_ok(jsonb, text) to service_role;
grant execute on function public.record_usage_day(date, jsonb) to service_role;
grant execute on function public.owner_usage_days(integer) to service_role;
grant execute on function public.usage_day_hook_secret() to service_role;
grant execute on function public.run_usage_day() to service_role;
