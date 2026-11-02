-- Limits on the two emails anybody can make the app send, and none to Apple's
-- review login.
--
-- "Yes make the server changes" (Justin, 2 November 2026), to: "add limits so
-- nobody can flood the feedback form or the download-link emails, and stop
-- all emails to those two dead addresses".
--
-- WHY. Every email the app sends goes through one Resend account, and on its
-- Free plan that account stops at 100 a day. Sign-up confirmations and
-- password resets go through it too. Two things anybody can do without an
-- account each send one email, and nothing counted them across everybody:
--
--   a feedback row        public.feedback takes an insert from anyone (its
--                         policy "anyone can send feedback"), and each row's
--                         trigger asks feedback-email to email Justin. One
--                         bulk insert of 100 rows was 100 emails, in about a
--                         second.
--   a download link       note_download_link let each address have one every
--                         ten minutes, but name+1@, name+2@ … are a hundred
--                         addresses to it, and one Gmail address is many with
--                         its dots moved.
--
-- After either, nobody could confirm an account or reset a password until the
-- next day. Real use is nowhere near: in the month to 2 November the busiest
-- hour had 7 feedback reports (Justin's own, testing) and 2 download links,
-- and the busiest day 49 emails of every kind.
--
-- So: past 20 feedback reports in an hour the report is still saved, and still
-- shows in Developer -> Messages from users, but sends no email; past 20
-- download links in an hour across every address, and for any address already
-- sent one in the last ten minutes after its +tag (and, on Gmail, its dots)
-- is taken off, the link is not sent. download-link answers {sent: true}
-- either way (supabase/functions/download-link, `recently !== false`), as it
-- always has for the per-address limit, so a flood learns nothing and a
-- person sees no error.
--
-- AND NONE TO APPLE'S REVIEW LOGIN. The account Apple signs in with at every
-- review (App Store Connect → App Review Information) has an address on
-- newbold.cloud with no mailbox behind it: every download link sent to it
-- bounced, and bounces are what get a sending account paused (Resend asks
-- for under about 4%; the month to 2 November was 14%). Apple's reviewer still sees the app say the link went,
-- as before. Its setup emails were left out the same day by hand
-- (set_setup_left_out), and so were those of the one other address that
-- bounced every time, which is also on Resend's suppression list.
--
-- Applied to the live project on 2 November 2026 (apply_migration), and kept
-- here so the repository says what the database does. notify_feedback was
-- live only until now: this is its first copy in the repository, unchanged
-- but for the limit.

create or replace function public.notify_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_secret text;
  fn_url text := 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/feedback-email';
  lately integer;
begin
  -- THE FLOOD LIMIT. This row is already written and stays; only its email is
  -- held. An AFTER row trigger sees every row its statement wrote, so a bulk
  -- insert of 100 counts all 100 and sends none.
  select count(*) into lately
  from public.feedback f
  where f.created_at > now() - interval '1 hour';

  if lately > 20 then
    raise log 'notify_feedback: % reports in the last hour, so no email for this one (it is saved, and in Messages from users)', lately;
    return new;
  end if;

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

-- Claim a download-link send, or refuse it. Returns true when the caller may
-- send. It WRITES on the allowed path, so asking is claiming (see
-- 20260920_download_link_rate.sql, which this replaces).
create or replace function public.note_download_link(addr text, every_minutes integer default 10)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  norm text;
  local_part text;
  domain_part text;
  key text;
  allowed boolean;
  lately integer;
begin
  if addr is null or length(trim(addr)) = 0 then
    return false;
  end if;

  norm := lower(trim(addr));

  -- Apple's review login has no mailbox. Not sent, and nothing written. Named
  -- by its digest, so the repository, which is public, does not carry the
  -- address of the account Apple signs in with.
  if encode(extensions.digest(norm, 'sha256'), 'hex') = '132dcf3f4a48ad6cad50a6389e88c02c2f27a09e3ec89f92b67987a1d592acb9' then
    return false;
  end if;

  -- One person, one address: name+anything@ is name@, and on Gmail the dots
  -- in the name are nothing. A plain address hashes exactly as it always did,
  -- so its ten minutes carry over.
  local_part := substring(norm from '^(.*)@[^@]*$');
  domain_part := substring(norm from '@([^@]*)$');
  if local_part is not null and domain_part is not null then
    if position('+' in local_part) > 1 then
      local_part := split_part(local_part, '+', 1);
    end if;
    if domain_part in ('gmail.com', 'googlemail.com') then
      local_part := replace(local_part, '.', '');
      domain_part := 'gmail.com';
    end if;
    if length(local_part) > 0 then
      norm := local_part || '@' || domain_part;
    end if;
  end if;

  -- And twenty an hour across everybody. Held in turn, so two at once cannot
  -- both count nineteen.
  perform pg_advisory_xact_lock(hashtext('public.note_download_link'));
  select count(*) into lately
  from public.download_link_sends d
  where d.last_sent_at > now() - interval '1 hour';
  if lately >= 20 then
    raise log 'note_download_link: % sent in the last hour, so this one is not', lately;
    return false;
  end if;

  key := encode(extensions.digest(norm, 'sha256'), 'hex');

  insert into public.download_link_sends as d (addr_hash)
  values (key)
  on conflict (addr_hash) do update
    -- Only moves the clock when the window has passed. The `where` is what
    -- makes this atomic: a conflicting row inside the window updates nothing.
    set last_sent_at = now(),
        times = d.times + 1
    where d.last_sent_at < now() - make_interval(mins => greatest(1, every_minutes))
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

-- Unchanged from 20260920: only the function itself (service_role, from the
-- edge function) calls it.
revoke all on function public.note_download_link(text, integer) from public, anon, authenticated;
