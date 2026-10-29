-- WHAT WORKS: WHICH GEAR CONNECTED, FROM THE PEOPLE WHO SAID YES.
--
-- "Build the analytics opt-in, opt out, and whatever needs to be built so
-- that we can collect which devices have been connected and tested for all
-- devices, whether they're computers, Bluetooth devices, so that it helps us
-- put together a list of everything that works." (26 October 2026.)
--
-- One row is one short note from a phone or tablet whose owner tapped "Yes,
-- share" on "Help make Fractal Remote better?" (mobile/src/lib/
-- gear-share-rules.js says what goes in it, and when): which unit and its
-- firmware, through a computer or Bluetooth, the adapter's name or the
-- computer app's version, whether the unit answered, the kind of device and
-- its system, and the app's version. The phone sends a combination at most
-- once in 30 days, and counts that on the phone.
--
-- ANONYMOUS ON PURPOSE. There is no account column and no install number,
-- and the phone sends it with no session at all, so nothing here can say
-- whose rig it was: the privacy label can say "not linked to you" and mean
-- it. Nor is the address it came from kept: nothing below records one.
--
-- WHO MAY DO WHAT. Anybody may add a row (the key that ships in the app is
-- public, and the phone sends signed out), each field checked for length and
-- the two closed lists checked for their words. Nobody may read one back
-- through the API: no select policy, and the grant taken away as well, the
-- second lock download_link_sends explains. Justin reads them through
-- supabase/functions/gear-reports, as the service role, after it has checked
-- his account. Nobody may change or delete one but the sweep below.

create table if not exists public.gear_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  via text not null check (via in ('computer', 'bluetooth')),
  unit text not null check (length(unit) between 1 and 40),
  firmware text check (length(firmware) <= 40),
  adapter text check (length(adapter) <= 80),
  outcome text not null check (outcome in ('answered', 'not answering')),
  computer_os text check (length(computer_os) <= 40),
  computer_version text check (length(computer_version) <= 24),
  phone_os text check (length(phone_os) <= 16),
  phone_os_version text check (length(phone_os_version) <= 24),
  phone_model text check (length(phone_model) <= 80),
  app_version text check (length(app_version) <= 24)
);

create index if not exists gear_reports_created_at on public.gear_reports (created_at desc);

alter table public.gear_reports enable row level security;

-- Insert, and only insert. A row may not choose its own id or time: those are
-- the table's, so a sender cannot back-date a note past the sweep.
revoke all on table public.gear_reports from anon, authenticated;
grant insert (via, unit, firmware, adapter, outcome, computer_os, computer_version, phone_os, phone_os_version, phone_model, app_version)
  on table public.gear_reports to anon, authenticated;

drop policy if exists "anyone: add a gear note" on public.gear_reports;
create policy "anyone: add a gear note" on public.gear_reports
  for insert to anon, authenticated
  with check (true);

comment on table public.gear_reports is
  'Opt-in, anonymous notes of which gear connected (no account, no install id). Read only by the gear-reports edge function. Kept 2 years.';

-- KEPT TWO YEARS, as public/privacy.html says. The sweep deletes anything
-- older. The edge function asks for it every time the page is opened, and a
-- daily schedule asks too once pg_cron is on (20261026_gear_reports_sweep.sql,
-- in a file of its own for the reason report_shots_sweep's is).
create or replace function public.sweep_gear_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from public.gear_reports where created_at < now() - interval '2 years';
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.sweep_gear_reports() from public, anon, authenticated;
grant execute on function public.sweep_gear_reports() to service_role;
