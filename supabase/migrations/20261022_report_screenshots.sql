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
--   - nobody signed in may write only into anon/;
--   - and only while there is room, in its folder's share and in the bucket
--     (report_shots_room, below).
--
-- No select rule, so nothing can be read or listed back through the app's key,
-- not even by the person who put it there. No update or delete rule, so a
-- picture cannot be replaced or removed through it either (the app uploads
-- with upsert off, which needs only this one). Delete account removes an
-- account's pictures through the service key (functions/delete-account).
--
-- ROOM, AND HOW LONG A PICTURE STAYS (review, 23 October 2026). The app's key
-- is in every copy of the app and the repository is public, so anybody can
-- put JPEGs under anon/, as anybody can add a row to public.feedback. Without
-- a limit a script could fill the project's storage (1 GB on the Free plan)
-- in minutes, and a project over its quota can be restricted, which would take
-- sign-in, the relay and purchases down with it. So:
--
--   - at most 15 pictures go into any one folder in an hour (five reports
--     with three each; the busiest hour so far had two reports): an
--     account's own, or anon/, which everybody signed out shares; anon/
--     never holds more than 100 MB, and the bucket never more than 200 MB.
--     Past any of those, a picture is refused, and the report goes without
--     it, saying so, as for any refused picture. A share each (second
--     review, 23 October 2026), because one count for everybody let a
--     stranger with the app's key hold it shut: thirty tiny pictures an
--     hour, or the bucket kept full, and nobody's screenshot went. Signed
--     out, a stranger can now fill only anon/'s share, never an account's;
--   - each picture is deleted 7 days after it went in, and one that no report
--     of its own names an hour after (report_shots_due, below): named by a
--     row from its own folder's sender, among the first three that row
--     names, which are all the app writes and all the email reads. So one
--     row listing a hundred pictures keeps three, not a hundred, and the
--     week's keep costs a stranger a report, and an email to the developer,
--     for every three pictures. The email function asks for that list
--     and deletes it through Storage's own API (the database refuses a delete
--     straight from storage.objects) every time a report comes in, and
--     20261022_report_shots_sweep.sql asks it to once a day besides;
--   - and the email function attaches a picture to one email only: a row
--     naming a picture another row already named gets a line instead, so a
--     picture put in once cannot be mailed, and read out of storage, again
--     and again.
--
-- The guard is counted from what is in the bucket, and nothing in it is
-- deleted inside the hour it counts (the sweep takes nothing younger than an
-- hour, the email function deletes nothing it sends), so deleting cannot make
-- room under it.
--
-- AND THE TRIGGER'S PATIENCE. notify_feedback() gave the email function five
-- seconds. With pictures to read and send, the function can take longer than
-- that (it keeps itself under 55), so the request is given sixty. pg_net sends
-- it after the insert has finished, so nobody waits for any of it: the row is
-- in the table, and somebody's phone has said "Sent", before the email has
-- begun. The function is otherwise exactly as migrations/20260905_feedback_email.sql
-- left it (checked against the live definition on 22 October 2026).
--
-- APPLIED BEFORE THE APP THAT USES IT, ideally. Nothing breaks either way: an
-- app that sends pictures to a project without this bucket is refused them,
-- says "One screenshot couldn't be added, so the report went without it", and
-- the report goes; an older app never sends any. The email function should be
-- deployed after this file: before it, the trigger stops waiting after five
-- seconds, and the function's tidying asks for report_shots_due, which is
-- here (until then it only writes a line in its own log).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-shots', 'report-shots', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "a report's screenshots, put in by whoever sends it" on storage.objects;

-- Whether one more picture may go into `folder` (an account's id, or anon):
-- fewer than 15 in that folder in the last hour, less than 100 MB in anon/
-- when it is anon/, and less than 200 MB in the bucket. Security definer
-- because nobody who uploads can read storage.objects, and the count has to
-- see everybody's; it answers only yes or no. Empty search_path and every
-- name qualified, as in the first feedback migration.
create or replace function public.report_shots_room(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from storage.objects o
      where o.bucket_id = 'report-shots'
        and split_part(o.name, '/', 1) = folder
        and o.created_at > now() - interval '1 hour') < 15
    and (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.bucket_id = 'report-shots') < 200 * 1024 * 1024
    and (folder <> 'anon' or (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.bucket_id = 'report-shots'
        and split_part(o.name, '/', 1) = 'anon') < 100 * 1024 * 1024);
$$;

revoke all on function public.report_shots_room(text) from public;
-- The rule below runs it as whoever is uploading, so they need to be able to.
grant execute on function public.report_shots_room(text) to anon, authenticated;

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
    and public.report_shots_room((storage.foldername(name))[1])
  );

-- The pictures due to go: every one older than 7 days, and every one older
-- than an hour that no report of its own names, which is a row from the
-- folder's own sender (its account, or nobody signed in for anon/) naming it
-- among its first three. `->> n` is null for anything that is not a list, so
-- a row whose screenshots are something else keeps nothing and breaks
-- nothing. The email function deletes them through Storage's API; only the
-- service key may ask. A couple of hundred at a time, oldest first.
create or replace function public.report_shots_due()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'report-shots'
    and (
      o.created_at < now() - interval '7 days'
      or (
        o.created_at < now() - interval '1 hour'
        and not exists (
          select 1 from public.feedback f
          where coalesce(f.user_id::text, 'anon') = split_part(o.name, '/', 1)
            and o.name in (f.context -> 'screenshots' ->> 0, f.context -> 'screenshots' ->> 1, f.context -> 'screenshots' ->> 2)
        )
      )
    )
  order by o.created_at
  limit 200;
$$;

revoke all on function public.report_shots_due() from public, anon, authenticated;
grant execute on function public.report_shots_due() to service_role;

-- The trigger's function, with sixty seconds for the email instead of five.
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
      timeout_milliseconds := 60000
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
