-- HAS ANY COMPUTER EVER SIGNED IN WITH THIS ACCOUNT? SO THE PHONE CAN SAY SO.
--
-- About twelve of the first forty paid accounts had never signed in on a
-- computer at all, and when the phone could not find one it told them
-- "Open the Fractal Remote app on the computer and make sure the computer is
-- awake" — advice about a computer that does not exist. What was promised
-- instead: "Clearer help for new customers. 'No computer is signed in with
-- this account yet, here's the download' instead of 'make sure it's awake.'"
-- (approved 13 October 2026).
--
-- The account server can tell. The computer app's device server keeps a
-- session of its own (user agent "node"; see 20260923_computer_elsewhere.sql
-- for why that is its signature, and what else uses it), and a session stays
-- in auth.sessions until that computer signs out. So: does the caller's own
-- account hold one?
--
-- YES OR NO ABOUT THE CALLER, AND NOTHING ELSE. Only auth.uid()'s own
-- sessions are looked at; there is no argument, so nobody can ask about any
-- other account, and nothing comes back but the one boolean — not when, not
-- where from, not how many. Null when there is no caller at all, which the
-- apps read as "can't tell", never as a no.
--
-- No time limit, unlike computer_elsewhere's ninety minutes, on purpose. That
-- question is "why is it silent tonight"; this one is "has a computer ever
-- been set up", and a computer asleep since last week is still set up. A
-- yes that is too generous only keeps today's words ("make sure the computer
-- is awake"); a no that is wrong would tell somebody with a computer to go
-- and install one.

drop function if exists public.account_has_computer();

create or replace function public.account_has_computer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else exists (
      select 1
      from auth.sessions s
      where s.user_id = auth.uid()
        and s.user_agent like 'node%'
    )
  end
$$;

revoke all on function public.account_has_computer() from public, anon;
grant execute on function public.account_has_computer() to authenticated;
