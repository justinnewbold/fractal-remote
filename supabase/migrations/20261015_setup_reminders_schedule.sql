-- THE HOURLY LOOK FOR SETUP EMAILS THAT ARE DUE.
--
-- In a file of its own, after 20261015_setup_reminders.sql, because it needs
-- pg_cron, which this project has never used: if creating the extension is
-- refused, only this file fails, and the tables, the list on the Developer
-- page and the switch are all still there.
--
-- If it IS refused: Supabase dashboard → Integrations → Cron (or Database →
-- Extensions → pg_cron), turn it on, and run this file again. Until then
-- nothing is sent at all, and `select public.run_setup_reminders();` by hand
-- does one run.
--
-- At 23 minutes past every hour, so the first email lands a day and up to an
-- hour after the full version was first seen, at about the time of day they
-- got it, and not on the hour with every other job in the world. The switch
-- (setup_reminder_switch, off to begin with) decides whether a run sends
-- anything; this only asks.
--
-- Scheduling under the same name again replaces the job rather than adding a
-- second one.
--
-- The two grants are the ones Supabase's own pg_cron steps give, so the
-- postgres role this file runs as can make the job. Where it has them
-- already they change nothing.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule('setup-reminders', '23 * * * *', $$select public.run_setup_reminders()$$);
