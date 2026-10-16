-- SALES AT A GLANCE: A ROW HE HAS DEALT WITH, MARKED HANDLED.
--
-- "I've already handled this paid twice thing so I think we fixed that so
-- people can't pay twice so we can leave it there but I wanna [be able to]
-- mark as completed or so that it doesn't appear anymore after it's been
-- handled." (15 October 2026.)
--
-- One row per account and list, and nothing else:
--
--   account_id   whose it is
--   kind         which list it was on: 'twice' (Paid twice) or
--                'unconfirmed' (Paid, account never confirmed)
--   paid_until   the newest purchase that row was about when he marked it,
--                in RevenueCat's milliseconds; for 'unconfirmed' that takes
--                the card sales beside it in as well
--   bought_count how many real purchases the account had then, refunded
--                ones too (tests and hand grants aside)
--   near_count   for 'unconfirmed', how many card sales on the website, by
--                other addresses within a day of theirs, there were then,
--                one sale at a time and refunded ones too; 0 for 'twice'
--   handled_at   when he marked it
--
-- grant-access's Sales works the three out, puts them on the row, and the
-- page sends them back as they came. It leaves the row out only while
-- nothing is newer than paid_until AND there are no more purchases than
-- bought_count AND no more card sales beside it than near_count. The date
-- alone is not enough: a phone that bought before it signed in brings its
-- purchase onto the account later, with its own earlier date, and that is
-- the same person paying again. A card sale on the website beside a
-- never-confirmed row is newer than the mark, so its date brings the row
-- back, even when it is the same address paying again after a refund, or
-- the refunded buyer has dropped out of the paying accounts and so out of
-- near_count. A refund leaves a purchase in RevenueCat's list, marked
-- refunded, and adds no new date, so a refund never brings it back. Marking
-- the same account again moves each of the three forward, never back.
--
-- Hangs off the account (on delete cascade), so Delete account clears it with
-- nothing changed in the function that deletes. Row-level security on, no
-- policy, no grant to anon or authenticated, and both functions are
-- service_role only: grant-access calls them after its ADMINS lock. The same
-- two locks as waiting_grants and the setup emails' tables.
--
-- Applied on its own, it changes nothing anybody sees: Sales asks for the
-- marks and finds none. Before it is applied, a Sales that asks gets no
-- marks and shows every row, as it does today, and Handled says in words
-- that the database change has not been put live.

-- The foreign key below locks auth.users for a moment. If a slow write there
-- holds it, give up quickly and run the file again, rather than make every
-- sign-in wait behind it.
set lock_timeout = '5s';

create table if not exists public.sales_handled (
  account_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('twice', 'unconfirmed')),
  paid_until bigint not null check (paid_until >= 0),
  bought_count integer not null default 0 check (bought_count >= 0),
  near_count integer not null default 0 check (near_count >= 0),
  handled_at timestamptz not null default now(),
  primary key (account_id, kind)
);

alter table public.sales_handled enable row level security;
revoke all on table public.sales_handled from public, anon, authenticated;
grant all on table public.sales_handled to service_role;

-- Mark one row handled. `newest` is the newest purchase the row was about
-- (card sales beside it included), `bought` how many purchases it counted and
-- `near` how many card sales were beside it, one sale at a time; a second
-- mark on the same account and list keeps the larger of each.
create or replace function public.mark_sales_handled(uid uuid, what text, newest bigint, bought integer, near integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.sales_handled as h (account_id, kind, paid_until, bought_count, near_count, handled_at)
  select uid, what, greatest(coalesce(newest, 0), 0), greatest(coalesce(bought, 0), 0),
         case when what = 'unconfirmed' then greatest(coalesce(near, 0), 0) else 0 end, now()
  where uid is not null and what in ('twice', 'unconfirmed')
  on conflict (account_id, kind) do update
    set paid_until = greatest(h.paid_until, excluded.paid_until),
        bought_count = greatest(h.bought_count, excluded.bought_count),
        near_count = greatest(h.near_count, excluded.near_count),
        handled_at = now()
  returning true
$$;

-- Every mark, for Sales to leave those rows out. Account ids, times and
-- counts only: the addresses are already Sales' own.
create or replace function public.sales_handled_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', h.account_id, 'kind', h.kind, 'paid_until', h.paid_until,
      'bought_count', h.bought_count, 'near_count', h.near_count
    )),
    '[]'::jsonb
  )
  from public.sales_handled h
$$;

revoke all on function public.mark_sales_handled(uuid, text, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.sales_handled_list() from public, anon, authenticated;
grant execute on function public.mark_sales_handled(uuid, text, bigint, integer, integer) to service_role;
grant execute on function public.sales_handled_list() to service_role;
