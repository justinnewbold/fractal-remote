-- A PROFILE PHOTO ON AN ACCOUNT.
--
-- "Let's also add an ability to add a profile photo that also puts a little
-- profile photo up next to [the Live pill] ... in the top header bar with
-- the little circle." (Justin, 7 November 2026, who approved setting up the
-- storage for it.)
--
-- The phone's Settings → your account → Add a photo picks one picture in the
-- phone's own photo picker, crops it square, makes it a small JPEG (256
-- pixels a side, 100 KB at most: shared/profile-photo.mjs PHOTO_EDGE and
-- PHOTO_BYTES) and puts it here. The top bar draws it in a small circle
-- beside the Live pill, from a copy the phone keeps so it shows with no
-- signal. Nothing about it goes into a table: the file is the whole record.
--
-- THE BUCKET: `profile-photos`, private (no public address), JPEG only, and
-- 128 KB a file, a little over the app's own cap, so a photo the app lets
-- through is never one this turns away.
--
-- ONE PLACE PER ACCOUNT, `<account id>/photo.jpg` (PHOTO_PATH in
-- shared/profile-photo.mjs; a test holds the two, and Delete account, to each
-- other). The account's own folder, named by its id, and a fixed name in it,
-- so changing the photo replaces it and an account can never hold more than
-- one.
--
-- FOUR RULES, ONE FOR EACH THING THE APP DOES, every one for a signed-in
-- account and its own place only (the name is exactly its own id, then
-- /photo.jpg, so the folder is auth.uid() and nothing else):
--
--   - putting it in (insert), while the bucket has room (below);
--   - replacing it (update), which Change photo does by uploading over it;
--   - reading it back (select), which the phone does at sign-in to keep its
--     copy, and which a replace needs as well;
--   - removing it (delete), for Remove photo.
--
-- Nothing at all for anybody signed out: there is no rule `to anon`, so the
-- app's public key can neither put a picture here nor read or list one. And
-- no account can reach another's: every rule asks for its own id.
--
-- ROOM. Only a signed-in account can put a picture here, one each, at most
-- 128 KB, so the bucket grows by one small file per account that adds a
-- photo. As a backstop against a script with many accounts, a picture is
-- refused once the bucket holds 250 MB (about ten thousand photos at their
-- usual size, two thousand at the cap), and the phone says the photo could
-- not be saved. Raise it here when real photos ever come near it.
--
-- DELETE ACCOUNT removes the photo through the service key, before the
-- account goes (functions/_shared/forget-account.ts, which delete-account
-- and Developer → Accounts' Delete share), so both of those are deployed
-- again after this file.
--
-- APPLIED BEFORE THE APP THAT USES IT. Nothing breaks either way: an app
-- that sends a photo to a project without this bucket is refused it and says
-- "The photo couldn't be saved", and the top bar keeps the plain circle.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 131072, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "a profile photo, put in by its own account" on storage.objects;
drop policy if exists "a profile photo, replaced by its own account" on storage.objects;
drop policy if exists "a profile photo, read by its own account" on storage.objects;
drop policy if exists "a profile photo, removed by its own account" on storage.objects;

-- Whether one more photo may go in: the bucket holds less than 250 MB.
-- Security definer because the account putting it in can read only its own
-- file, and the sum has to see everybody's; it answers only yes or no.
-- Empty search_path and every name qualified, as in the report buckets.
create or replace function public.profile_photos_room()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 250 * 1024 * 1024
  from storage.objects o
  where o.bucket_id = 'profile-photos';
$$;

revoke all on function public.profile_photos_room() from public, anon;
-- The insert rule runs it as whoever is putting the photo in, so they need to be able to.
grant execute on function public.profile_photos_room() to authenticated;

create policy "a profile photo, put in by its own account"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and name = (select auth.uid())::text || '/photo.jpg'
    and public.profile_photos_room()
  );

create policy "a profile photo, replaced by its own account"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = (select auth.uid())::text || '/photo.jpg'
  )
  with check (
    bucket_id = 'profile-photos'
    and name = (select auth.uid())::text || '/photo.jpg'
  );

create policy "a profile photo, read by its own account"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = (select auth.uid())::text || '/photo.jpg'
  );

create policy "a profile photo, removed by its own account"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = (select auth.uid())::text || '/photo.jpg'
  );
