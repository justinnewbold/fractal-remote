-- THE DAILY TIDY OF THE GEAR NOTES: anything over two years old is deleted.
--
-- In a file of its own, after 20261026_gear_reports.sql, because it needs
-- pg_cron, which this project may not have turned on yet (see
-- 20261022_report_shots_sweep.sql): if creating the extension is refused,
-- only this file fails, and the table is still there. Until it runs, the
-- gear-reports function sweeps every time the What works page is opened, so
-- the two years still hold whenever anybody is looking.
--
-- At 4:41 in the morning (UTC), off the hour and away from the shots' sweep.
-- Scheduling under the same name again replaces the job.


-- pg_cron is already on (20261015_setup_reminders_schedule.sql set it up, with its grants):
-- granting again fails with "dependent privileges exist" (28 October 2026), so only the job is added.
select cron.schedule('gear-reports-sweep', '41 4 * * *', $$select public.sweep_gear_reports()$$);
