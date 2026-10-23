-- SCREENSHOTS IN A REPORT.
--
-- "Is this all the information the logs send? Where's the space to enter a
-- message and upload photos? Let's get it all set up if it's not already."
-- (Justin, 22 October 2026, holding the email Send logs to developer made.)
--
-- The log screen, the Debug log and the Feedback form take up to three
-- screenshots now. The app makes each one smaller (1.5 MB at most, a JPEG;
-- shared/report-rules.mjs SHOT_BYTES says why), puts it here, and writes where
-- it went into the report's own row, inside `context` as `screenshots`: a list
-- of paths. Inside context rather than a column of its own, so the row every
-- app inserts is the row it always inserted, and public.feedback is not
-- touched at all. The feedback-email function reads the pictures back with the
-- service key and attaches them to the email.
--
-- THE BUCKET: `report-shots`, private (no public address, no read rule for
-- anybody), JPEG only, 2 MB a file (a little over the app's own cap, so a
-- picture the app lets through is never one this turns away).
--
-- ONE RULE, FOR PUTTING A PICTURE IN, and none for anything else:
--
--   - the path is the sender's folder, then the report's own random key and
--     which of the three it is: `<account id>/<key>-<1..3>.jpg`, or
--     `anon/<key>-<1..3>.jpg` for somebody not signed in (the same pattern as
--     SHOT_PATH in shared/report-rules.mjs and in the email function; a test
--     holds the three to each other);
--   - a signed-in sender may write only into their own account's folder, or
--     into anon/ (a report whose account could not be read at that moment goes
--     as an anonymous one, as its row does);
--   - nobody signed in may write only into anon/.
--
-- No select rule, so nothing can be read or listed back through the app's key,
-- not even by the person who put it there. No update or delete rule, so a
-- picture cannot be replaced or removed through it either (the app uploads
-- with upsert off, which needs only this one). Delete account removes an
-- account's pictures through the service key (functions/delete-account).
--
-- The same exposure as the feedback table itself, said plainly: anybody with
-- the app's key can put JPEGs under anon/, up to 2 MB each, as anybody can add
-- a row to public.feedback. The bucket is not readable, so it cannot be used
-- to share anything; at worst it fills up, and it is visible in the dashboard.
--
-- AND THE TRIGGER'S PATIENCE. notify_feedback() gave the email function five
-- seconds. With pictures to read and send, the function can take longer than
-- that, so the request is given thirty. pg_net sends it after the insert has
-- finished, so nobody waits for any of it: the row is in the table, and
-- somebody's phone has said "Sent", before the email has begun. The function is
-- otherwise exactly as migrations/20260905_feedback_email.sql left it (checked
-- against the live definition on 22 October 2026).
--
-- APPLIED BEFORE THE APP THAT USES IT, ideally. Nothing breaks either way: an
-- app that sends pictures to a project without this bucket is refused them,
-- says "One screenshot couldn't be added, so the report went without it", and
-- the report goes; an older app never sends any. The email function can be
-- deployed before or after this file; before it, the email carries the log and
-- no pictures, because no row names any.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-shots', 'report-shots', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "a report's screenshots, put in by whoever sends it" on storage.objects;

create policy "a report's screenshots, put in by whoever sends it"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'report-shots'
    and name ~ '^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-3]\.jpg$'
    and (
      (storage.foldername(name))[1] = 'anon'
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

-- The trigger's function, with thirty seconds for the email instead of five.
-- Empty search_path and every name qualified, for the reasons the first
-- migration gives; the exception block so nothing on the way to an inbox can
-- cost somebody their report.
create or replace function public.notify_feedback()
returns trigger
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
    raise log 'notify_feedback: no feedback_hook_secret in vault, nothing sent';
    return new;
  end if;

  begin
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-hook-secret', hook_secret
      ),
      body := to_jsonb(new),
      timeout_milliseconds := 30000
    );
  exception when others then
    -- The row is what matters and it is already written. Anything that goes
    -- wrong on the way to an inbox is a line in the log, never a lost report.
    raise log 'notify_feedback: could not queue the email: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_feedback() from public, anon, authenticated;
