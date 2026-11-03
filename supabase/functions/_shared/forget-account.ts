/**
 * DELETING ONE ACCOUNT FOR GOOD, AND EVERYTHING THAT GOES WITH IT, in one
 * place for the two functions that do it:
 *
 *   delete-account  a person deleting their own account in the app (Apple's
 *                   Guideline 5.1.1(v), which rejected 1.86.8 for want of it)
 *   grant-access    Justin deleting somebody's from Developer → Accounts:
 *                   "how do I remove accounts altogether like the irecon one
 *                   that's misspelled?" (2 November 2026)
 *
 * Both used to be one function's. They share this file rather than each
 * keeping a copy, so an account deleted from his page goes exactly the way
 * one deleted by its owner does, and a table or a bucket added to one list
 * is added to both. Supabase's own layout for that: a folder whose name
 * starts with an underscore is not a function of its own, and
 * `supabase functions deploy <name>` bundles what the function imports from
 * it, so each of the two still deploys on its own (supabase/README.md says
 * which deploys this touches).
 *
 * WHO IS DELETED IS NEVER DECIDED HERE. The caller has already proved it:
 * delete-account from the person's own verified token, grant-access from
 * Justin's, then by looking the account up and refusing his own and Apple's
 * review login. This file is handed an account id and its address, and
 * deletes that.
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
 * Nothing here reads the request: Deno and fetch are looked up when each
 * function runs, so the tests can stand in for both.
 */

export type Who = { id: string; email: string }

/** Which function is deleting, for its log lines and the note's first words. */
export type By = 'delete-account' | 'grant-access'

const DEFAULT_PROJECT = 'proj827190e9'

/*
 * WHAT THE CASCADE CANNOT REACH. Three tables are keyed by an email address,
 * or were written before the account existed, so deleting the user leaves them:
 *
 *   feedback             bug reports sent while signed in (user_id), or that
 *                        gave this address to reply to (contact)
 *   waiting_grants       an unlock waiting for this address to sign up
 *   download_link_sends  the address the desktop link went to, stored as the
 *                        sha256 of the address: lower-cased and trimmed until
 *                        2 November 2026 (migrations/20260920_download_link_rate.sql),
 *                        and since then with its +tag and, on Gmail, its dots
 *                        taken off too (20261102_email_limits.sql). Both are
 *                        deleted, so neither kind of row outlives the account.
 *
 * Deleted here with the service role, before the account goes. Best effort:
 * a failure is logged and the account is still deleted.
 */

/**
 * An address as note_download_link files it since 2 November 2026
 * (supabase/migrations/20261102_email_limits.sql), rule for rule: lower-cased
 * and trimmed; then, when it has an @, the part before the last @ loses
 * everything from its first + (unless the + comes first), and on gmail.com
 * or googlemail.com its dots, the domain becoming gmail.com; an empty name
 * leaves the address as it was. test/server.mjs holds the two together.
 */
export function downloadLinkAddress(addr: string): string {
  let norm = String(addr || '').trim().toLowerCase()
  const m = norm.match(/^(.*)@([^@]*)$/)
  if (m) {
    let local = m[1]
    let domain = m[2]
    if (local.indexOf('+') > 0) local = local.split('+')[0]
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      local = local.replace(/\./g, '')
      domain = 'gmail.com'
    }
    if (local.length > 0) norm = `${local}@${domain}`
  }
  return norm
}

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Every addr_hash a download link to this address may have been filed under: the old way and the new. */
export async function downloadLinkHashes(email: string): Promise<string[]> {
  const plain = String(email || '').trim().toLowerCase()
  return [...new Set([await sha256(plain), await sha256(downloadLinkAddress(plain))])]
}

/*
 * THE REPLY-ADDRESS MATCH (review of 3 November 2026). PostgREST turns every
 * `*` in a like or ilike value into `%`, and has no way to escape one; the
 * account service takes a `*` before the @. So an account made as
 * `*@gmail.com`, deleted from Developer → Accounts, matched every report
 * that gave a Gmail address to reply to. The lookup is now only a search for
 * candidates, with each `*` sent as `_` (one character, never a run), and
 * a report is this account's only when its reply address, trimmed and
 * lower-cased, IS this address (`sameContact`). The reports are then deleted
 * by their ids, from that checked list, so nothing goes that the developer's
 * note does not name.
 */
export const contactPattern = (email: string): string =>
  encodeURIComponent(String(email || '').trim().replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '_'))

export const sameContact = (contact: unknown, email: string): boolean =>
  typeof contact === 'string' && contact.trim().toLowerCase() === String(email || '').trim().toLowerCase()

async function forgetRows(url: string, service: string, who: Who, reports: Report[], by: By) {
  const rest = (path: string) =>
    fetch(`${url}/rest/v1/${path}`, {
      method: 'DELETE',
      headers: { apikey: service, Authorization: `Bearer ${service}`, Prefer: 'return=minimal' }
    })
      .then((r) => (r.ok ? null : console.error(`${by}: ${path.split('?')[0]} answered ${r.status}`)))
      .catch((err) => console.error(`${by}: ${path.split('?')[0]} unreachable (${err})`))
  const jobs = [rest(`feedback?user_id=eq.${who.id}`)]
  /* Sent signed out, or from another account, giving this address to reply to: by id, the rows checked in reportsOf. */
  const ids = reports.filter((r) => r.user_id !== who.id).map((r) => encodeURIComponent(String(r.id)))
  for (let i = 0; i < ids.length; i += 100) jobs.push(rest(`feedback?id=in.(${ids.slice(i, i + 100).join(',')})`))
  if (who.email) {
    const at = encodeURIComponent(who.email)
    const hashes = await downloadLinkHashes(who.email)
    jobs.push(rest(`waiting_grants?email=eq.${at}`), rest(`download_link_sends?addr_hash=in.(${hashes.join(',')})`))
  }
  await Promise.all(jobs)
}

/*
 * THE REPORTS IT SENT, read before they go: their ids, who sent each, and the
 * screenshots each names. The rows matched are the ones forgetRows deletes:
 * sent while signed in to this account, or giving exactly its address to
 * reply to (the reply-address match, above); forgetRows takes the second
 * kind by the ids found here, never by a match of its own.
 *
 * Null when either lookup could not be done, and then nothing is deleted
 * (second review, 23 October 2026): a row taken that no lookup listed was a
 * report whose email the developer was never told about.
 */
type Report = { id: string; user_id: string | null; contact?: string | null; context: Record<string, unknown> | null }

async function reportsOf(url: string, service: string, who: Who, by: By): Promise<Report[] | null> {
  const headers = { apikey: service, Authorization: `Bearer ${service}` }
  const found = new Map<string, Report>()
  const look = async (query: string) => {
    try {
      const res = await fetch(`${url}/rest/v1/feedback?select=id,user_id,contact,context&${query}`, { headers })
      if (!res.ok) {
        console.error(`${by}: feedback lookup answered ${res.status}`)
        return false
      }
      /* Its own, or one whose reply address is exactly this one (the reply-address match, above). */
      for (const report of await res.json()) {
        if (report?.id && (report.user_id === who.id || sameContact(report.contact, who.email))) found.set(String(report.id), report)
      }
      return true
    } catch (err) {
      console.error(`${by}: feedback lookup unreachable (${err})`)
      return false
    }
  }
  const lookups = [look(`user_id=eq.${who.id}`)]
  if (who.email) lookups.push(look(`contact=ilike.${contactPattern(who.email)}`))
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

/*
 * AND A REPORT'S VIDEO (29 October 2026), in the private bucket
 * `report-videos` beside the pictures' (migrations/20261029_report_videos.sql),
 * by the same rule: one in the account's own folder, or one under anon/ named
 * by a report it sent signed out.
 */
const VIDEO_BUCKET = 'report-videos'
const VIDEO_PATH =
  /^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-video\.(mp4|mov|webm|3gp)$/

/** The video a report names, when this account may delete it. */
export function ownVideo(report: Report, id: string): string[] {
  const path = String(report?.context?.video ?? '')
  if (!VIDEO_PATH.test(path)) return []
  const folder = path.split('/')[0]
  return folder === id || (folder === 'anon' && !report.user_id) ? [path] : []
}

async function forgetShots(url: string, service: string, who: Who, reports: Report[], by: By) {
  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
  const paths = new Set<string>(reports.flatMap((r) => ownShots(r, who.id)))
  /* And the account's own folder, whatever is in it. */
  await fetch(`${url}/storage/v1/object/list/${SHOT_BUCKET}`, { method: 'POST', headers, body: JSON.stringify({ prefix: who.id, limit: 1000, offset: 0 }) })
    .then(async (res) => {
      if (!res.ok) return console.error(`${by}: screenshot folder answered ${res.status}`)
      for (const file of await res.json()) {
        const path = `${who.id}/${String(file?.name || '')}`
        if (SHOT_PATH.test(path)) paths.add(path)
      }
    })
    .catch((err) => console.error(`${by}: screenshot folder unreachable (${err})`))
  if (!paths.size) return
  try {
    const res = await fetch(`${url}/storage/v1/object/${SHOT_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: [...paths] }) })
    if (!res.ok) console.error(`${by}: screenshots answered ${res.status}`)
  } catch (err) {
    console.error(`${by}: screenshots unreachable (${err})`)
  }
}

/* The videos, the pictures' way: what the reports name, and the account's own folder. */
async function forgetVideos(url: string, service: string, who: Who, reports: Report[], by: By) {
  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
  const paths = new Set<string>(reports.flatMap((r) => ownVideo(r, who.id)))
  await fetch(`${url}/storage/v1/object/list/${VIDEO_BUCKET}`, { method: 'POST', headers, body: JSON.stringify({ prefix: who.id, limit: 1000, offset: 0 }) })
    .then(async (res) => {
      if (!res.ok) return console.error(`${by}: video folder answered ${res.status}`)
      for (const file of await res.json()) {
        const path = `${who.id}/${String(file?.name || '')}`
        if (VIDEO_PATH.test(path)) paths.add(path)
      }
    })
    .catch((err) => console.error(`${by}: video folder unreachable (${err})`))
  if (!paths.size) return
  try {
    const res = await fetch(`${url}/storage/v1/object/${VIDEO_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: [...paths] }) })
    if (!res.ok) console.error(`${by}: videos answered ${res.status}`)
  } catch (err) {
    console.error(`${by}: videos unreachable (${err})`)
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
 *
 * Deleted from his own page, it is the same note to the same inbox, opening
 * with who did it, so he does not read it as a customer having left.
 */
const DEFAULT_TO = 'justinnewbold@gmail.com'
const DEFAULT_FROM = 'Fractal Remote <noreply@newbold.cloud>'

export function deletedReportsEmail(ids: string[], by: By = 'delete-account') {
  const n = ids.length
  const rows = ids.map((id) => `Row ${id}`)
  const who = by === 'grant-access' ? 'You deleted an account from Developer → Accounts.' : 'An account was deleted in the app.'
  return {
    from: Deno.env.get('FEEDBACK_FROM') || DEFAULT_FROM,
    to: [Deno.env.get('FEEDBACK_TO') || DEFAULT_TO],
    subject: `Account deleted: delete its ${n} report email${n === 1 ? '' : 's'}`,
    text: [
      `${who} ${n === 1 ? 'One report it sent was' : `${n} reports it sent were`} emailed here, with ${n === 1 ? 'its' : 'their'} log and screenshots.`,
      `The ${n === 1 ? 'report and its screenshots are' : 'reports and their screenshots are'} gone from the database. The email${n === 1 ? ' is' : 's are'} not: search this inbox for each line below and delete ${n === 1 ? 'that email' : 'those emails'} too. The privacy page tells the person they will be.`,
      '',
      ...rows
    ].join('\n')
  }
}

async function tellDeveloper(ids: string[], accountId: string, by: By) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key || !ids.length) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      /* The one key for either way of deleting: an account is only deleted once, so its note goes once. */
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `delete-account/${accountId}` },
      body: JSON.stringify(deletedReportsEmail(ids, by)),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) console.error(`${by}: the note about its report emails answered ${res.status}`)
  } catch (err) {
    console.error(`${by}: the note about its report emails did not go (${err})`)
  }
}

/* Best effort, and never in the way: an account is deleted whether or not
   RevenueCat answers. */
async function forgetCustomer(id: string, by: By) {
  const secret = Deno.env.get('REVENUECAT_SECRET')
  if (!secret) return
  const project = Deno.env.get('REVENUECAT_PROJECT') || DEFAULT_PROJECT
  try {
    const res = await fetch(`https://api.revenuecat.com/v2/projects/${project}/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secret}` }
    })
    if (!res.ok && res.status !== 404) console.error(`${by}: RevenueCat answered ${res.status}`)
  } catch (err) {
    console.error(`${by}: RevenueCat unreachable (${err})`)
  }
}

/**
 * THE WHOLE OF IT, IN ITS ORDER. `{ ok: true }` once the account is gone (or
 * was already: a 404 from the account service is a deletion that happened);
 * `{ ok: false, why }` when it is still there, and then the caller says try
 * again. A lookup that could not be done stops it before anything is deleted
 * ('lookup'); a refusal of the account's own delete comes after the rows have
 * gone ('auth'), and the note about them has gone too, since a try again
 * finds no rows to list.
 */
export async function forgetAccount(url: string, service: string, who: Who, by: By): Promise<{ ok: true } | { ok: false; why: 'lookup' | 'auth' }> {
  /* The reports first, to know what they name; then the pictures, before the rows that name them. */
  const reports = await reportsOf(url, service, who, by)
  if (!reports) return { ok: false, why: 'lookup' }
  await forgetShots(url, service, who, reports, by)
  await forgetVideos(url, service, who, reports, by)
  await forgetRows(url, service, who, reports, by)
  /*
   * The emailed copies of its reports are the developer's to delete; he is
   * told which, as soon as the rows have gone and whatever the account's own
   * delete then answers: a try again after a refusal finds no rows to list.
   */
  await tellDeveloper(reports.map((r) => r.id), who.id, by)

  const res = await fetch(`${url}/auth/v1/admin/users/${who.id}`, {
    method: 'DELETE',
    headers: { apikey: service, Authorization: `Bearer ${service}` }
  })
  if (!res.ok && res.status !== 404) {
    console.error(`${by}: auth answered ${res.status} ${await res.text().catch(() => '')}`)
    return { ok: false, why: 'auth' }
  }

  await forgetCustomer(who.id, by)
  return { ok: true }
}
