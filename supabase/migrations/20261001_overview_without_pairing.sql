-- SIGN-UP TOTALS WITHOUT THE PAIRING ACCOUNTS.
--
-- Every phone and computer paired the old way holds a hidden account at
-- @pair.fractal.newbold.cloud (shared/pairing.mjs, PAIR_DOMAIN). They are not
-- people, and they were counted as sign-ups in Developer: a new phone paired
-- read as a new customer. The Everyone with an account list already leaves
-- them out (shared/admin.mjs); the three totals now do too.
--
-- Only the counts change. The buyers list is unchanged: a pairing account has
-- never bought anything.
create or replace function public.owner_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select u.id, u.created_at
    from auth.users u
    where coalesce(lower(u.email), '') not like '%@pair.fractal.newbold.cloud'
  )
  select jsonb_build_object(
    'accounts', (select count(*) from people),
    'accounts_day', (select count(*) from people where created_at > now() - interval '1 day'),
    'accounts_week', (select count(*) from people where created_at > now() - interval '7 days'),
    'buyers', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.account_id, 'email', u.email, 'active', e.active) order by e.updated_at desc)
      from public.entitlements e
      join auth.users u on u.id = e.account_id
      where e.source = 'revenuecat' and e.active
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.owner_overview() from public, anon, authenticated;
grant execute on function public.owner_overview() to service_role;
