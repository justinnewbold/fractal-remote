-- WHAT WORKS, 4 NOVEMBER 2026: A USB CABLE, AND HOW LONG THINGS TAKE.
--
-- Two changes to public.gear_reports (20261026_gear_reports.sql), both
-- agreed by Justin:
--
--   "Yes, add the cable connection server change." A unit plugged into the
--   phone by USB cable is its own kind of connection, 'usb', with the
--   cable's name where an adapter's goes. Before, the phone sent no note at
--   all for a cable, rather than call it Bluetooth.
--
--   "Go with your picks", on recording how long things take: connect_ms,
--   from the moment the link starts trying (computer, Bluetooth or cable) to
--   the unit's first answer on it, and tap_ms, through a computer, the
--   middle of how long the player's own taps (presets, scenes, effects) took
--   to come back in that connection. In milliseconds, rounded by the phone
--   (connect_ms to 100, tap_ms to 10) so neither is the exact gap between
--   two lines of a debug log, and measured only from what the phone does
--   anyway: nothing new is ever asked of a unit for them. Null when there is
--   none to say (a unit that did not answer, a connection with no taps, and
--   tap_ms over Bluetooth or a cable, where a write has no answer to time).
--
-- STILL ANONYMOUS. Nothing here says whose note it was: no account, no
-- install number, no address, as before. The two numbers are times, not
-- identifiers, and the phone leaves them out of what it counts as one
-- combination of gear, so a different time is never a new note.
--
-- Apply this, and deploy gear-reports, before the app update that sends
-- them is merged (supabase/README.md, What works). Until then such a note is
-- refused, the phone logs it, and it goes again later.

alter table public.gear_reports
  drop constraint if exists gear_reports_via_check,
  add constraint gear_reports_via_check check (via in ('computer', 'bluetooth', 'usb'));

alter table public.gear_reports
  add column if not exists connect_ms integer check (connect_ms between 0 and 600000),
  add column if not exists tap_ms integer check (tap_ms between 0 and 600000);

-- Insert, and only insert, as before: the two new columns join the list a
-- sender may fill. Still no select, update or delete for anybody but the
-- service role (gear-reports, and the two-year sweep).
grant insert (connect_ms, tap_ms) on table public.gear_reports to anon, authenticated;

comment on table public.gear_reports is
  'Opt-in, anonymous notes of which gear connected, through a computer, Bluetooth or a USB cable, with how long it took to connect and, through a computer, how quickly the unit answered a tap (no account, no install id). Read only by the gear-reports edge function. Kept 2 years.';
