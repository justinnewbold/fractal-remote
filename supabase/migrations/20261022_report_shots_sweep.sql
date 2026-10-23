-- THE DAILY TIDY OF THE SCREENSHOTS' BUCKET.
--
-- In a file of its own, after 20261022_report_screenshots.sql, because it
-- needs pg_cron, which this project does not have turned on yet (checked on
-- 23 October 2026: 20261015_setup_reminders_schedule.sql, which needs it too,
-- has not been applied): if creating the extension is refused, only this file
-- fails, and the bucket, its rule and the trigger are all still there.
--
-- If it IS refused: Supabase dashboard → Integrations → Cron (or Database →
-- Extensions → pg_cron), turn it on, and run this file again. Until then the
-- tidying still happens every time a report comes in (the email function does
-- it on its way), so a picture is only kept past its week when no report at
-- all arrives after it.
--
-- APPLY IT ONLY AFTER THE NEW feedback-email IS DEPLOYED. The function before
-- 23 October 2026 takes any body for a report, so it would read
-- `{"sweep": true}` as a blank one and email "Bug: (no message)" every morning.
--
-- What it does: once a day it asks the email function to delete the pictures
-- that are due (public.report_shots_due: older than 7 days, or older than an
-- hour and named by no report). Through the function, because the database
-- refuses a delete straight from storage.objects, and the function has the
-- service key Storage's own API wants. It sends the same hook secret the
-- trigger sends, and `{"sweep": true}` in place of a report, so no email goes.
--
-- At 4:17 in the morning (UTC), off the hour. Scheduling under the same name
-- again replaces the job rather than adding a second one. The two grants are
-- the ones Supabase's own pg_cron steps give, as in the setup reminders' file.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.sweep_report_shots()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_secret text;
  fn_url text := 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/feedback-email';
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'feedback_hook_secret'
  limit 1;

  if hook_secret is null then
    raise log 'sweep_report_shots: no feedback_hook_secret in vault, nothing asked';
    return;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', hook_secret
    ),
    body := jsonb_build_object('sweep', true),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.sweep_report_shots() from public, anon, authenticated;

select cron.schedule('report-shots-sweep', '17 4 * * *', $$select public.sweep_report_shots()$$);
