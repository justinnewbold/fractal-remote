-- FIVE SCREENSHOTS IN A REPORT, NOT THREE.
--
-- "Let's make it so a user can upload up to five photos instead of three. And
-- one video, Max." (Justin, 7 November 2026.) One video is already the rule
-- (20261029_report_videos.sql), so only the pictures move: SHOTS_MAX in
-- shared/report-rules.mjs goes from 3 to 5, and a picture's place in the
-- bucket from `<key>-<1..3>.jpg` to `<key>-<1..5>.jpg`.
--
-- 20261022_report_screenshots.sql is already applied and is not edited; this
-- file replaces the two things in it that count to three, each otherwise word
-- for word as it was:
--
--   - the bucket's one insert rule, "a report's screenshots, put in by
--     whoever sends it", dropped and made again with `-[1-5]\.jpg` (the same
--     pattern as SHOT_PATH in shared/report-rules.mjs, in the email function
--     and in functions/_shared/forget-account.ts; a test holds the four to
--     each other). The folder rule and the room check are as they were;
--   - public.report_shots_due(), which keeps a picture named by a row from
--     its own folder's sender among the first FIVE that row names (`->> 0`
--     to `->> 4`), all the app writes now and all the email reads. Without
--     this, a report's fourth and fifth would be deleted an hour after they
--     went in, as if no report named them.
--
-- WHAT DOES NOT CHANGE. The bucket (private, JPEG only, 2 MB a file), and
-- public.report_shots_room(), so the room is counted as before: fewer than 15
-- pictures an hour into any one folder, anon/ under 100 MB, the bucket under
-- 200 MB. At five a report, 15 an hour is three full reports an hour from one
-- account, or from everybody signed out together (anon/ is one folder), where
-- it was five; the busiest hour so far had two reports. A picture past the
-- room is refused and its report goes without it, saying so, as before. Five
-- at the app's 1.5 MB cap is 7.5 MB, so anon/'s 100 MB holds about fourteen
-- such reports at once (a week's, since a picture its report names stays a
-- week), and the bucket's 200 MB about twenty-eight, where it was about
-- twenty-three and forty-six; a phone's screenshot is usually a few hundred
-- kilobytes, far under the cap.
--
-- APPLY THIS BEFORE THE APP THAT SENDS FIVE IS MERGED, with the email
-- function and every function that imports _shared/forget-account.ts
-- deployed after it (supabase/README.md, "Five screenshots"). Nothing breaks
-- applied early: every app out today sends three at most, which this takes
-- as the old rule did. Merged before it, the app's fourth and fifth are
-- refused by the bucket, and the report goes without them, saying "2
-- screenshots couldn't be added, so the report went without them."
--
-- Were 20261022_report_screenshots.sql ever run again, it would put back the
-- rule and the tidy for three: run this file again after it.

drop policy if exists "a report's screenshots, put in by whoever sends it" on storage.objects;

create policy "a report's screenshots, put in by whoever sends it"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'report-shots'
    and name ~ '^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-5]\.jpg$'
    and (
      (storage.foldername(name))[1] = 'anon'
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
    and public.report_shots_room((storage.foldername(name))[1])
  );

-- The pictures due to go: every one older than 7 days, and every one older
-- than an hour that no report of its own names, which is a row from the
-- folder's own sender (its account, or nobody signed in for anon/) naming it
-- among its first five. `->> n` is null for anything that is not a list, so
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
            and o.name in (f.context -> 'screenshots' ->> 0, f.context -> 'screenshots' ->> 1, f.context -> 'screenshots' ->> 2, f.context -> 'screenshots' ->> 3, f.context -> 'screenshots' ->> 4)
        )
      )
    )
  order by o.created_at
  limit 200;
$$;

revoke all on function public.report_shots_due() from public, anon, authenticated;
grant execute on function public.report_shots_due() to service_role;
