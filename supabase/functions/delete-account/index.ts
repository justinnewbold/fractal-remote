/**
 * Delete the account that is asking, for good.
 *
 * Apple rejected 1.86.8 under Guideline 5.1.1(v): an app that lets people
 * make an account has to let them delete it from inside the app, and turning
 * it off is not enough. Deleting a Supabase account needs the service-role
 * key, which can never be in an app, so the phone asks here.
 *
 * WHO IS DELETED IS NOT UP TO THE CALLER. As in entitlement, the account id
 * comes out of the caller's own session token, verified by Supabase, never out
 * of the request body. Anything else would let one person delete another.
 *
 * WHAT GOES WITH IT. Every table that holds somebody's data references
 * auth.users with `on delete cascade`: chats, chat_logs, stage_lists,
 * rig_lookups, user_memory, band_book, entitlements. Deleting the user deletes
 * those rows, and the database does it in one step. test/limits.mjs holds every
 * table that names a user to that rule, so a new one cannot quietly survive a
 * deletion. Sessions go too, so a signed-in computer is signed out the next
 * time it refreshes. The few rows keyed by an email address go first, below.
 *
 * The RevenueCat customer named after the account is deleted as well, when the
 * key is set. A purchase itself belongs to the buyer's Apple ID or Google
 * account rather than to us: Restore Purchases on a new account brings it back.
 *
 * The body must say {"confirm":"delete"}, so a stray or replayed call with a
 * valid token cannot delete anything by accident.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })

const DEFAULT_PROJECT = 'proj827190e9'

async function accountFrom(url: string, key: string, token: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const user = await res.json()
    const id = String(user?.id || '')
    return id ? { id, email: String(user?.email || '').trim().toLowerCase() } : null
  } catch (err) {
    console.error(`delete-account: could not verify the token (${err})`)
    return null
  }
}

/*
 * WHAT THE CASCADE CANNOT REACH. Three tables are keyed by an email address,
 * or were written before the account existed, so deleting the user leaves them:
 *
 *   feedback             bug reports sent while signed in (user_id), or that
 *                        gave this address to reply to (contact)
 *   waiting_grants       an unlock waiting for this address to sign up
 *   download_link_sends  the address the desktop link went to, stored as the
 *                        sha256 of the lower-cased, trimmed address (see
 *                        migrations/20260920_download_link_rate.sql)
 *
 * Deleted here with the service role, before the account goes. Best effort:
 * a failure is logged and the account is still deleted.
 */
async function forgetRows(url: string, service: string, who: { id: string; email: string }) {
  const rest = (path: string) =>
    fetch(`${url}/rest/v1/${path}`, {
      method: 'DELETE',
      headers: { apikey: service, Authorization: `Bearer ${service}`, Prefer: 'return=minimal' }
    })
      .then((r) => (r.ok ? null : console.error(`delete-account: ${path.split('?')[0]} answered ${r.status}`)))
      .catch((err) => console.error(`delete-account: ${path.split('?')[0]} unreachable (${err})`))
  const jobs = [rest(`feedback?user_id=eq.${who.id}`)]
  if (who.email) {
    const at = encodeURIComponent(who.email)
    /* ilike so a reply address typed in another case still matches, with its
       wildcards escaped so "a_b@x" can never match somebody else's "acb@x". */
    const like = encodeURIComponent(who.email.replace(/[\\%_]/g, (c) => `\\${c}`))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(who.email))
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    jobs.push(rest(`feedback?contact=ilike.${like}`), rest(`waiting_grants?email=eq.${at}`), rest(`download_link_sends?addr_hash=eq.${hash}`))
  }
  await Promise.all(jobs)
}

/* Best effort, and never in the way: an account is deleted whether or not
   RevenueCat answers. */
async function forgetCustomer(id: string) {
  const secret = Deno.env.get('REVENUECAT_SECRET')
  if (!secret) return
  const project = Deno.env.get('REVENUECAT_PROJECT') || DEFAULT_PROJECT
  try {
    const res = await fetch(`https://api.revenuecat.com/v2/projects/${project}/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secret}` }
    })
    if (!res.ok && res.status !== 404) console.error(`delete-account: RevenueCat answered ${res.status}`)
  } catch (err) {
    console.error(`delete-account: RevenueCat unreachable (${err})`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || service
  if (!url || !service || !anon) return json({ error: 'The account server is not set up.' }, 500)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'delete') return json({ error: 'Not confirmed.' }, 400)

  const who = token ? await accountFrom(url, anon, token) : null
  if (!who) return json({ error: 'Sign in again, then delete the account.' }, 401)
  const id = who.id

  await forgetRows(url, service, who)

  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: service, Authorization: `Bearer ${service}` }
  })
  if (!res.ok && res.status !== 404) {
    console.error(`delete-account: auth answered ${res.status} ${await res.text().catch(() => '')}`)
    return json({ error: 'The account could not be deleted. Try again in a minute.' }, 502)
  }

  await forgetCustomer(id)
  console.log(`delete-account: deleted ${id}`)
  return json({ deleted: true })
})
