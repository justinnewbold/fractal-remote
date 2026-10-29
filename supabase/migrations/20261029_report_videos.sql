-- A VIDEO IN A REPORT.
--
-- "Then a box to type out a message, upload a photo or video, and have the
-- log sent with what devices they're using." (Justin, 29 October 2026, on
-- the phone's report screen.)
--
-- The phone's report screen takes one video now, picked from the phone's own
-- picker. A screenshot is small enough to ride in the email
-- (20261022_report_screenshots.sql); a video is not, so it goes here, and the
-- email carries a link to it signed for 7 days (functions/feedback-email). Its
-- place goes into the report's row inside `context`, as `video`, as the
-- screenshots' do, so public.feedback is not touched.
--
-- THE BUCKET: `report-videos`, private (no public address, no read rule for
-- anybody), the four kinds a phone hands over (an iPhone's .mp4 once it has
-- made it 720p, or its .mov; an Android's .mp4, .webm or .3gp), and 50 MB a
-- file: the project's own cap on any one upload, and the app's
-- (shared/report-rules.mjs VIDEO_BYTES).
--
-- ONE RULE, FOR PUTTING A VIDEO IN, the screenshots' rule with a video's place:
--
--   - the path is the sender's folder, then the report's own random key:
--     `<account id>/<key>-video.<kind>`, or `anon/<key>-video.<kind>` for a
--     report sent signed out or anonymously (VIDEO_PATH in
--     shared/report-rules.mjs and in the email function; a test holds the
--     three to each other);
--   - a signed-in sender may write only into their own folder, or into anon/;
--     nobody signed in, only into anon/;
--   - and only while there is room (report_videos_room, below).
--
-- No select, update or delete rule, so nothing can be read, listed, replaced
-- or removed through the app's key. Delete account removes an account's
-- videos through the service key (functions/delete-account).
--
-- ROOM, AND HOW LONG A VIDEO STAYS. Anybody can put files under anon/ with
-- the app's key, as anybody can add a report, so:
--
--   - at most 2 videos go into any one folder in an hour (an account's own,
--     or anon/, which everybody signed out shares); anon/ never holds more
--     than 500 MB, and the bucket never more than 1 GB. Past any of those a
--     video is refused, and the report goes without it, saying so;
--   - each video is deleted 7 days after it went in, which is when the
--     email's link stops working, and one that no report of its own names an
--     hour after (report_videos_due, below): named by a row from its own
--     folder's sender, as its `video`. The email function asks for that list
--     and deletes it through Storage's own API every time a report comes in,
--     and once a day when the screenshots' sweep calls it
--     (20261022_report_shots_sweep.sql), which tidies both buckets now.
--
-- The guard is counted from what is in the bucket, and nothing in it is
-- deleted inside the hour it counts, so deleting cannot make room under it.
--
-- APPLIED BEFORE THE APP THAT USES IT. Nothing breaks either way: an app that
-- sends a video to a project without this bucket is refused it, says "The
-- video couldn't be added, so the report went without it", and the report
-- goes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-videos', 'report-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "a report's video, put in by whoever sends it" on storage.objects;

-- Whether one more video may go into `folder` (an account's id, or anon):
-- fewer than 2 in that folder in the last hour, less than 500 MB in anon/
-- when it is anon/, and less than 1 GB in the bucket. Security definer
-- because nobody who uploads can read storage.objects; it answers only yes
-- or no. Empty search_path and every name qualified.
create or replace function public.report_videos_room(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from storage.objects o
      where o.bucket_id = 'report-videos'
        and split_part(o.name, '/', 1) = folder
        and o.created_at > now() - interval '1 hour') < 2
    and (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.bucket_id = 'report-videos') < 1024 * 1024 * 1024
    and (folder <> 'anon' or (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.bucket_id = 'report-videos'
        and split_part(o.name, '/', 1) = 'anon') < 500 * 1024 * 1024);
$$;

revoke all on function public.report_videos_room(text) from public;
-- The rule below runs it as whoever is uploading, so they need to be able to.
grant execute on function public.report_videos_room(text) to anon, authenticated;

create policy "a report's video, put in by whoever sends it"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'report-videos'
    and name ~ '^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-video\.(mp4|mov|webm|3gp)$'
    and (
      (storage.foldername(name))[1] = 'anon'
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
    and public.report_videos_room((storage.foldername(name))[1])
  );

-- The videos due to go: every one older than 7 days, and every one older than
-- an hour that no report of its own names: a row from the folder's own
-- sender (its account, or nobody for anon/) whose `video` is it. The email
-- function deletes them through Storage's API; only the service key may ask.
-- A hundred at a time, oldest first.
create or replace function public.report_videos_due()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'report-videos'
    and (
      o.created_at < now() - interval '7 days'
      or (
        o.created_at < now() - interval '1 hour'
        and not exists (
          select 1 from public.feedback f
          where coalesce(f.user_id::text, 'anon') = split_part(o.name, '/', 1)
            and f.context ->> 'video' = o.name
        )
      )
    )
  order by o.created_at
  limit 100;
$$;

revoke all on function public.report_videos_due() from public, anon, authenticated;
grant execute on function public.report_videos_due() to service_role;
