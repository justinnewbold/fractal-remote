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
 * key is set. A store purchase belongs to the buyer's Apple ID or Google
 * account rather than to us: Restore Purchases on a new account brings it back.
 * A website purchase or a grant lives on that customer, and goes with it.
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

/*
 * THE REPORTS IT SENT, read before they go: their ids, who sent each, and the
 * screenshots each names. The rows matched are the ones forgetRows deletes:
 * sent while signed in to this account, or giving its address to reply to.
 *
 * Null when either lookup could not be done, and then nothing is deleted
 * (second review, 23 October 2026): forgetRows deletes by the same match
 * whether or not it was read, so a row it took that no lookup listed was a
 * report whose email the developer was never told about.
 */
type Report = { id: string; user_id: string | null; context: Record<string, unknown> | null }

async function reportsOf(url: string, service: string, who: { id: string; email: string }): Promise<Report[] | null> {
  const headers = { apikey: service, Authorization: `Bearer ${service}` }
  const found = new Map<string, Report>()
  const look = async (query: string) => {
    try {
      const res = await fetch(`${url}/rest/v1/feedback?select=id,user_id,context&${query}`, { headers })
      if (!res.ok) {
        console.error(`delete-account: feedback lookup answered ${res.status}`)
        return false
      }
      for (const report of await res.json()) if (report?.id) found.set(String(report.id), report)
      return true
    } catch (err) {
      console.error(`delete-account: feedback lookup unreachable (${err})`)
      return false
    }
  }
  const lookups = [look(`user_id=eq.${who.id}`)]
  if (who.email) {
    const like = encodeURIComponent(who.email.replace(/[\\%_]/g, (c) => `\\${c}`))
    lookups.push(look(`contact=ilike.${like}`))
  }
  const done = await Promise.all(lookups)
  return done.every(Boolean) ? [...found.values()] : null
}

/*
 * THE SCREENSHOTS A REPORT CARRIED (22 October 2026). They sit in the private
 * bucket `report-shots`, under the account's id, or under `anon` for a report
 * sent signed out that gave this address to reply to. Storage keeps its files
 * apart from the table, so deleting a report row leaves its pictures; they are
 * deleted here first, through Storage's own API (the database refuses a
 * delete straight from storage.objects): every picture the reports about to
 * go name, and anything else in the account's own folder, such as a picture
 * whose report never arrived. Best effort, like the rows.
 *
 * Only pictures that are this account's to delete: one in its own folder, or
 * one under anon/ named by a report sent signed out. A row matched by its
 * reply address can be written by anybody, naming any path at all, and
 * another account's picture is not this one's to remove.
 */
const SHOT_BUCKET = 'report-shots'
const SHOT_PATH =
  /^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-3]\.jpg$/

/** The pictures a report names that this account may delete. */
export function ownShots(report: Report, id: string): string[] {
  const named = Array.isArray(report?.context?.screenshots) ? (report.context!.screenshots as unknown[]) : []
  return named
    .map((p) => String(p ?? ''))
    .filter((p) => SHOT_PATH.test(p))
    .filter((p) => {
      const folder = p.split('/')[0]
      return folder === id || (folder === 'anon' && !report.user_id)
    })
}

async function forgetShots(url: string, service: string, who: { id: string; email: string }, reports: Report[]) {
  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
  const paths = new Set<string>(reports.flatMap((r) => ownShots(r, who.id)))
  /* And the account's own folder, whatever is in it. */
  await fetch(`${url}/storage/v1/object/list/${SHOT_BUCKET}`, { method: 'POST', headers, body: JSON.stringify({ prefix: who.id, limit: 1000, offset: 0 }) })
    .then(async (res) => {
      if (!res.ok) return console.error(`delete-account: screenshot folder answered ${res.status}`)
      for (const file of await res.json()) {
        const path = `${who.id}/${String(file?.name || '')}`
        if (SHOT_PATH.test(path)) paths.add(path)
      }
    })
    .catch((err) => console.error(`delete-account: screenshot folder unreachable (${err})`))
  if (!paths.size) return
  try {
    const res = await fetch(`${url}/storage/v1/object/${SHOT_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: [...paths] }) })
    if (!res.ok) console.error(`delete-account: screenshots answered ${res.status}`)
  } catch (err) {
    console.error(`delete-account: screenshots unreachable (${err})`)
  }
}

/*
 * AND THE EMAILS OF THEM (review, 23 October 2026). Every report was emailed
 * to the developer when it came in (functions/feedback-email), with its log
 * and its screenshots, and deleting a row cannot reach an inbox. So the
 * developer is told, in one short email, which reports went: by their row
 * ids only, which every report email carries at its foot ("Row <id>"), so a
 * search finds each one to delete. Nothing else about the account goes in it,
 * not even its address. With no RESEND_API_KEY, or no reports, nothing is
 * sent. Best effort, with a deadline: the account is deleted whatever happens
 * here, and the privacy page says this is how the emailed copies go.
 */
const DEFAULT_TO = 'justinnewbold@gmail.com'
const DEFAULT_FROM = 'Fractal Remote <noreply@newbold.cloud>'

export function deletedReportsEmail(ids: string[]) {
  const n = ids.length
  const rows = ids.map((id) => `Row ${id}`)
  return {
    from: Deno.env.get('FEEDBACK_FROM') || DEFAULT_FROM,
    to: [Deno.env.get('FEEDBACK_TO') || DEFAULT_TO],
    subject: `Account deleted: delete its ${n} report email${n === 1 ? '' : 's'}`,
    text: [
      `An account was deleted in the app. ${n === 1 ? 'One report it sent was' : `${n} reports it sent were`} emailed here, with ${n === 1 ? 'its' : 'their'} log and screenshots.`,
      `The ${n === 1 ? 'report and its screenshots are' : 'reports and their screenshots are'} gone from the database. The email${n === 1 ? ' is' : 's are'} not: search this inbox for each line below and delete ${n === 1 ? 'that email' : 'those emails'} too. The privacy page tells the person they will be.`,
      '',
      ...rows
    ].join('\n')
  }
}

async function tellDeveloper(ids: string[], accountId: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key || !ids.length) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `delete-account/${accountId}` },
      body: JSON.stringify(deletedReportsEmail(ids)),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) console.error(`delete-account: the note about its report emails answered ${res.status}`)
  } catch (err) {
    console.error(`delete-account: the note about its report emails did not go (${err})`)
  }
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

  /* The reports first, to know what they name; then the pictures, before the rows that name them. */
  const reports = await reportsOf(url, service, who)
  if (!reports) return json({ error: 'The account could not be deleted. Try again in a minute.' }, 502)
  await forgetShots(url, service, who, reports)
  await forgetRows(url, service, who)
  /*
   * The emailed copies of its reports are the developer's to delete; he is
   * told which, as soon as the rows have gone and whatever the account's own
   * delete then answers: a try again after a refusal finds no rows to list.
   */
  await tellDeveloper(reports.map((r) => r.id), id)

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
