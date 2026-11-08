-- A READ-ONLY DOOR TO THE BUG REPORTS.
--
-- "A read-only login for bug reports ... so I can open people's reports
-- myself instead of you forwarding the emails" (Justin said yes, 8 November
-- 2026). Until this, reading one meant scripts/report.mjs sending a SELECT
-- through the Management API with the full-account SUPABASE_TOKEN, a key
-- that can do anything at all to the project. The read-reports function
-- beside this answers two questions about public.feedback and nothing
-- else, to a caller whose x-reports-key header hashes to one kept here.
--
-- APPLY THIS BEFORE DEPLOYING read-reports. Until it is applied the
-- function cannot check a key, and answers 502 to every read.
--
-- WHAT IS KEPT: the SHA-256 of each key, in hex, and the day it was
-- enrolled. Never the key itself, which only the session's network proxy
-- holds (the credential Justin saves in its secure form). At most three:
-- one in use, room to roll one over, and no more (enroll_report_reader).
--
-- SERVICE ROLE ONLY. The table is in its own schema, which the API does
-- not serve, with row level security on, no policy, and nothing granted to
-- anon or authenticated; the four functions below are granted to
-- service_role alone. The anon key ships inside the app, so a door it
-- could reach would be open to everybody.

create schema if not exists private;

create table if not exists private.report_reader_keys (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table private.report_reader_keys enable row level security;
revoke all on table private.report_reader_keys from public, anon, authenticated;

comment on table private.report_reader_keys is
  'SHA-256 (hex) of each key the read-reports function accepts in x-reports-key. Never the key. Service role only, through report_reader_hashes() and enroll_report_reader().';

-- ---------------------------------------------------------------- the keys

-- Every kept hash, for the function to compare with the caller's in
-- constant time, all of them, with no early way out. Three at most, so
-- handing all of them over costs nothing and keeps the comparison in code
-- the tests can run, rather than in an index lookup.
create or replace function public.report_reader_hashes()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(k.hash order by k.created_at), '{}'::text[])
  from private.report_reader_keys k;
$$;

revoke all on function public.report_reader_hashes() from public, anon, authenticated;
grant execute on function public.report_reader_hashes() to service_role;

-- Keep one more key's hash, or say why not. The function calls this only
-- after the caller has given the one-time enrolment token
-- (READ_REPORTS_ENROLL), so nothing here checks who is asking.
--
--   enrolled   kept, answered with how many there are now
--   already    that key was kept before; nothing changed
--   full       three are kept already: take one back first (or replace)
--   bad hash   not 64 hex digits
--
-- replace_others: true keeps this key and takes back every other, in one
-- step, which is how a key is rolled over (supabase/README.md).
--
-- Every delete names its rows: a session that comes in through the API may
-- refuse a delete with no WHERE (pg-safeupdate), even inside a function.
create or replace function public.enroll_report_reader(key_hash text, replace_others boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept integer;
begin
  if key_hash is null or key_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'why', 'bad hash');
  end if;

  -- One enrolment at a time, so two at once cannot both slip under the cap.
  lock table private.report_reader_keys in share row exclusive mode;

  if coalesce(replace_others, false) then
    delete from private.report_reader_keys k where k.hash <> key_hash;
  end if;

  if exists (select 1 from private.report_reader_keys k where k.hash = key_hash) then
    select count(*) into kept from private.report_reader_keys;
    return jsonb_build_object('ok', true, 'why', 'already', 'keys', kept);
  end if;

  select count(*) into kept from private.report_reader_keys;
  if kept >= 3 then
    return jsonb_build_object('ok', false, 'why', 'full', 'keys', kept);
  end if;

  insert into private.report_reader_keys (hash) values (key_hash);
  return jsonb_build_object('ok', true, 'why', 'enrolled', 'keys', kept + 1);
end;
$$;

revoke all on function public.enroll_report_reader(text, boolean) from public, anon, authenticated;
grant execute on function public.enroll_report_reader(text, boolean) to service_role;

-- ---------------------------------------------------------------- the two questions

-- The two reads scripts/report.mjs used to send as SQL, word for word,
-- now fixed here, so nothing a caller sends becomes SQL. Each answers a
-- JSON array, newest first. Security invoker on purpose: they run as the
-- service role that calls them, which may read public.feedback anyway
-- (feedback-email does), and as nobody else.

-- The newest `most` reports, 1 to 50, one line's worth each.
create or replace function public.read_reports_latest(most integer)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if most is null or most < 1 or most > 50 then
    raise exception 'read_reports_latest: most is a whole number from 1 to 50';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at desc)
    from (
      select f.id, f.created_at, f.kind, left(f.message, 140) as message, f.contact,
        f.context ->> 'unit' as unit, f.context ->> 'version' as version, f.context ->> 'os' as os,
        length(f.log) as log_length
      from public.feedback f
      order by f.created_at desc
      limit most
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.read_reports_latest(integer) from public, anon, authenticated;
grant execute on function public.read_reports_latest(integer) to service_role;

-- One report in full, by its id or the start of it (8 to 36 hex digits and
-- dashes, as the email's Row line and the log's file name give it): the
-- newest two that start so, so the caller can say there was more than one.
create or replace function public.read_report(prefix text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if prefix is null or prefix !~ '^[0-9a-f-]{8,36}$' then
    raise exception 'read_report: an id is 8 to 36 hex digits and dashes';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at desc)
    from (
      select f.id, f.created_at, f.kind, f.message, f.contact, f.context, f.log
      from public.feedback f
      where f.id::text like prefix || '%'
      order by f.created_at desc
      limit 2
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.read_report(text) from public, anon, authenticated;
grant execute on function public.read_report(text) to service_role;
