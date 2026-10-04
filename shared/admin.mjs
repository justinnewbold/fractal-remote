/**
 * THE TOOLS ONLY JUSTIN SEES.
 *
 * "Yes, build that in and only when logged into the justinnewbold@icloud.com
 * account."
 *
 * The first is Give someone access: type a customer's email, see whether they
 * have the unlock, and give it to them — or take a hand-given one back — for
 * the day a purchase does not register.
 *
 * Then "Do number one and five for now":
 *
 *   Customer lookup     Check also says when they signed up, what they paid
 *                       for and where, which devices they have signed in on,
 *                       and which version of the app they were last on.
 *   Sales at a glance   sales today, in the last week and ever, per platform.
 *
 * The server answers in facts and dates; the words are made here, so the
 * phone and the browser say the same thing and a test can read them.
 *
 * Hidden from everybody else, but hiding is a convenience and not the lock:
 * supabase/functions/grant-access checks the caller's signed account itself
 * and refuses anybody not on this list. A hash rather than the address, for
 * the reason shared/owner-unlock.mjs gives — no inbox in a public repository.
 */
import { fold } from './owner-unlock.mjs'

/** fold('justinnewbold@icloud.com'). Copied into the server function; a test holds them equal. */
export const ADMINS = ['672e291a']

/** Whether the account signed in here is the one the tools are for. */
export const isAdmin = (email) => {
  const at = String(email || '').trim()
  return at.includes('@') && ADMINS.includes(fold(at))
}

/**
 * Ask the server to check, grant or revoke the unlock for an email.
 *
 * `token` is the signed-in session's access token — the server reads who is
 * asking out of it. Never throws: whatever happens comes back as
 * { ok, message }, with `found` and `unlocked` when there is an answer.
 */
export async function accessAction({ url, anonKey, token, action, email, fetchImpl }) {
  if (!token) return { ok: false, message: 'Sign in first.' }
  try {
    /* Looked up when used, not as a default: some places this runs have no
       global fetch until the app sets one up. */
    const res = await (fetchImpl || globalThis.fetch)(`${url}/functions/v1/grant-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action, email })
    })
    const body = await res.json().catch(() => ({}))
    return {
      ...body,
      ok: Boolean(body?.ok),
      message: body?.message || (res.ok ? 'Done.' : `The server answered ${res.status}.`)
    }
  } catch (err) {
    return { ok: false, message: `Could not reach the server (${err?.message || err}).` }
  }
}

/* ------------------------------------------------------------------------ */
/* The words                                                                 */
/* ------------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A timestamp in milliseconds or an ISO string, as a Date — or null. */
const dateOf = (at) => {
  if (at === null || at === undefined || at === '') return null
  const d = new Date(typeof at === 'number' ? at : String(at))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Midnight at the start of `d`'s day, in this device's own time zone. */
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "Sep 12, 2026". Spelt out by hand: not every phone's JavaScript has dates in words. */
export const dayOf = (at) => {
  const d = dateOf(at)
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : 'unknown'
}

/** "today", "yesterday", "3 days ago", or the date. */
export const ago = (at, now = Date.now()) => {
  const d = dateOf(at)
  if (!d) return 'unknown'
  const days = Math.round((dayStart(new Date(now)) - dayStart(d)) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return dayOf(d)
}

/** Where a purchase was made, in his words rather than RevenueCat's. */
export const STORES = {
  app_store: 'iPhone',
  play_store: 'Android',
  rc_billing: 'Website',
  stripe: 'Website',
  paddle: 'Website',
  paypal: 'Website',
  test_store: 'Test store',
  promotional: 'Given by hand'
}
export const storeName = (store) => STORES[store] || 'Somewhere else'

/** Where somebody has signed in, from the kinds supabase/migrations/20260923_owner_lookup.sql sorts sessions into. */
export const DEVICES = {
  'iphone-app': 'iPhone app',
  'android-app': 'Android app',
  computer: 'Computer app',
  'web-iphone': 'Website, on an iPhone',
  'web-android': 'Website, on Android',
  'web-mac': 'Website, on macOS',
  'web-windows': 'Website, on Windows',
  'web-other': 'Website',
  unknown: 'Something else'
}

const money = (n) => `$${n.toFixed(2)}`

/**
 * CUSTOMER LOOKUP: the rows under the answer to Check, Give access or Take it
 * back. `answer` is what accessAction returned; an answer without details
 * (no account, or an older server) gives no rows.
 */
export function lookupRows(answer, now = Date.now()) {
  const d = answer?.details
  if (!answer?.found || !d) return []
  const bought = Array.isArray(d.purchases) ? d.purchases.filter((p) => p.store !== 'promotional') : null
  const kept = bought ? bought.filter((p) => !p.refunded) : []
  const refunded = bought ? bought.filter((p) => p.refunded) : []

  let unlock
  /* An owner row unlocks the relay whatever RevenueCat says, so it comes first. */
  if (d.owner) unlock = 'Unlocked as an owner account'
  else if (answer.unlocked && kept.length) {
    /* The first purchase that still stands: RevenueCat does not promise an order. */
    const p = kept.reduce((a, b) => ((b.at ?? Infinity) < (a.at ?? Infinity) ? b : a))
    unlock = `Paid, on ${storeName(p.store)}, ${dayOf(p.at)}${p.sandbox ? ' (a test purchase, no money taken)' : ''}`
  } else if (answer.unlocked) unlock = bought ? 'Given by hand' : 'Unlocked'
  else if (refunded.length) unlock = `Not unlocked. Refunded (bought on ${storeName(refunded[0].store)}, ${dayOf(refunded[0].at)})`
  else unlock = 'Not unlocked'
  if (!bought && !d.owner) unlock += '. RevenueCat did not say what they bought.'

  const rows = [
    { label: 'Unlock', value: unlock },
    { label: 'Signed up', value: dayOf(d.signedUp) },
    {
      label: 'Email confirmed',
      value: d.confirmed ? 'Yes' : 'Not yet. They have not tapped the link in the email we sent.'
    },
    { label: 'Last signed in', value: d.lastSignIn ? ago(d.lastSignIn, now) : 'Never' }
  ]
  const devices = Array.isArray(d.devices) ? d.devices : []
  rows.push({
    label: 'Signed in on',
    value: devices.length
      ? devices.map((x) => `${DEVICES[x.kind] || DEVICES.unknown}, ${ago(x.last_seen, now)}`).join('\n')
      : 'Nothing right now. They are signed out everywhere.'
  })
  const seen = d.seen
  if (seen?.version) {
    const on = [seen.platform, seen.platformVersion].filter(Boolean).join(' ')
    rows.push({
      label: 'App version',
      value: `${seen.version}${on ? ` on ${on}` : ''}${seen.last ? `, last opened ${ago(seen.last, now)}` : ''}`
    })
  }
  return rows
}

/**
 * SALES AT A GLANCE: what the 'sales' action answered, as sections of rows.
 *
 * Counted here rather than on the server so that "today" is today where the
 * phone is. Test purchases and refunds are kept out of the totals and given a
 * line each, so a Play Store test on his own card never looks like a customer.
 */
export function salesSections(answer, now = Date.now()) {
  if (!answer?.ok) return []
  const all = Array.isArray(answer.sales) ? answer.sales : []
  const real = all.filter((s) => !s.sandbox && !s.refunded)
  const today = dayStart(new Date(now))
  const week = now - 7 * 86400000
  const count = (list, since) => list.filter((s) => (dateOf(s.at)?.getTime() || 0) >= since).length

  const perStore = {}
  for (const s of real) perStore[storeName(s.store)] = (perStore[storeName(s.store)] || 0) + 1
  const gross = real.reduce((sum, s) => sum + (typeof s.gross === 'number' ? s.gross : 0), 0)

  const totals = [
    { label: 'Today', value: String(count(real, today)) },
    { label: 'Last 7 days', value: String(count(real, week)) },
    { label: 'All time', value: String(real.length) }
  ]
  if (gross > 0) totals.push({ label: 'Money in, all time', value: `${money(gross)}, before the stores take their cut` })

  const platforms = ['iPhone', 'Android', 'Website', ...Object.keys(perStore).filter((k) => !['iPhone', 'Android', 'Website'].includes(k))]
  const where = platforms.map((p) => ({ label: p, value: String(perStore[p] || 0) }))

  const other = [
    { label: 'Given by hand', value: String(answer.givenByHand || 0) },
    { label: 'Test purchases', value: `${all.filter((s) => s.sandbox && !s.refunded).length}, not counted above` },
    { label: 'Refunded', value: `${all.filter((s) => s.refunded).length}, not counted above` }
  ]

  const accounts = [
    { label: 'Accounts', value: String(answer.accounts || 0) },
    { label: 'New in the last 7 days', value: String(answer.accountsWeek || 0) },
    { label: 'New today', value: String(answer.accountsDay || 0) }
  ]

  const sections = [
    { title: 'Sales', rows: totals },
    { title: 'Where they bought', rows: where },
    { title: 'Not sales', rows: other },
    { title: 'Accounts', rows: accounts }
  ]
  const recent = real.slice(0, 10).map((s) => ({ label: dayOf(s.at), value: `${s.email}, ${storeName(s.store)}` }))
  if (recent.length) sections.push({ title: 'Latest sales', rows: recent })

  const notes = []
  if (answer.unanswered) notes.push(`RevenueCat did not answer for ${answer.unanswered} of them, so the numbers may be short.`)
  if (answer.more) notes.push(`Only the latest ${answer.unlocked} unlocked accounts were counted. ${answer.more} more were left out.`)
  if (notes.length) sections.push({ title: 'Note', rows: notes.map((n) => ({ label: '', value: n })) })
  return sections
}

/**
 * Everyone with an account, as sections of facts.
 *
 * "How do I see a list of who has set up an account?" Newest first, one line
 * each: the address, when they signed up, when they were last on, and whether
 * they are unlocked. `filter` narrows it to addresses containing what was
 * typed. The waiting list — addresses given access before they signed up —
 * comes after, so both kinds of person are on one screen.
 */
export function accountSections(answer, filter = '', now = Date.now()) {
  if (!answer?.ok) return []
  const want = String(filter || '').trim().toLowerCase()
  const match = (email) => !want || String(email || '').toLowerCase().includes(want)
  /*
   * Not the hidden accounts the old pairing codes stood for
   * (…@pair.fractal.newbold.cloud): they are devices, not people, and on the
   * play test two of them sat in the list as sign-ups who had never confirmed
   * an email. The same test as shared/pairing.mjs's isPairAccount.
   */
  const everyone = Array.isArray(answer.accounts) ? answer.accounts : []
  const devices = everyone.filter((a) => /@pair\.fractal\.newbold\.cloud$/i.test(String(a?.email || '')))
  const people = everyone.filter((a) => !devices.includes(a)).filter((a) => match(a.email))
  const waiting = (Array.isArray(answer.waiting) ? answer.waiting : []).filter((w) => match(w.email))

  const unlock = (a) => {
    if (!a.unlocked) return 'Not unlocked'
    return a.source === 'owner' ? 'Unlocked, owner account' : 'Unlocked'
  }
  const line = (a) =>
    [
      `Signed up ${ago(a.signed_up, now)}`,
      a.confirmed ? (a.last_sign_in ? `last on ${ago(a.last_sign_in, now)}` : 'never signed in') : 'has not confirmed their email yet',
      unlock(a)
    ].join(', ')

  const total = Math.max(people.length, (Number(answer.total) || people.length) - devices.length)
  const sections = [
    {
      title: want ? `Accounts matching "${want}" (${people.length})` : `Everyone with an account (${total})`,
      rows: people.length
        ? people.map((a) => ({ label: '', value: `${a.email}\n${line(a)}`, email: a.email, line: line(a), unlocked: !!a.unlocked, owner: a.source === 'owner' }))
        : [{ label: '', value: want ? 'Nobody with an account matches that.' : 'Nobody has made an account yet.' }]
    }
  ]
  if (waiting.length) {
    sections.push({
      title: `Waiting for them to sign up (${waiting.length})`,
      rows: waiting.map((w) => {
        const said = `Given access ${ago(w.added, now)}. Unlocked the first time they sign in.`
        return { label: '', value: `${w.email}\n${said}`, email: w.email, line: said, unlocked: false, waiting: true }
      })
    })
  }
  if (!want && total > people.length) {
    sections.push({ title: 'Note', rows: [{ label: '', value: `Only the newest ${people.length} of ${total} accounts are shown.` }] })
  }
  return sections
}

/**
 * WHAT A TAP ON SOMEBODY IN THE LIST OFFERS.
 *
 * "Can you make it so I can copy and paste off of this page? Or that I can
 * click on it to give them access from that screen?" Both: a tap opens the
 * person, with their email to copy and the one change that makes sense for
 * them — Give access when they are not unlocked, Take it back when they are
 * (or are waiting). The same server as Give someone access does the work;
 * it refuses to take back an unlock somebody paid for, and says so.
 *
 * The owner's own account offers neither: it is unlocked by being his.
 */
export function accountChoices(row) {
  if (!row?.email) return { give: false, takeBack: false }
  if (row.owner) return { give: false, takeBack: false }
  if (row.waiting) return { give: false, takeBack: true }
  return { give: !row.unlocked, takeBack: !!row.unlocked }
}

/* ------------------------------------------------------------------------ */
/* Messages from users                                                       */
/* ------------------------------------------------------------------------ */

/**
 * MESSAGES FROM USERS. "Everything people send through Troubleshooting →
 * 'tell us', readable inside the app with the log they attached, instead of
 * only arriving by email." The server is supabase/functions/owner-messages,
 * with the same lock as grant-access. `action` is 'list', or 'message' with
 * the report's `id` for one report and its log. Never throws.
 */
export async function messagesAction({ url, anonKey, token, action = 'list', id, fetchImpl }) {
  if (!token) return { ok: false, message: 'Sign in first.' }
  try {
    const res = await (fetchImpl || globalThis.fetch)(`${url}/functions/v1/owner-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, id })
    })
    const body = await res.json().catch(() => ({}))
    return { ...body, ok: Boolean(body?.ok), ...(body?.ok ? {} : { message: body?.message || `The server answered ${res.status}.` }) }
  } catch (err) {
    return { ok: false, message: `Could not reach the server (${err?.message || err}).` }
  }
}

const KIND = { bug: 'Something broken', idea: 'Suggestion' }

/** Where a report came from, in one line: the app, the unit, the phone. */
const fromLine = (ctx = {}) =>
  [
    ctx.version ? `v${ctx.version}` : null,
    ctx.macVersion ? `computer v${ctx.macVersion}` : null,
    ctx.unit || null,
    ctx.platform || ctx.os || null
  ]
    .filter(Boolean)
    .join(' · ')

/** The list: newest first, one row a report, tappable by its id. */
export function messageSections(answer, now = Date.now()) {
  if (!answer?.ok) return []
  const list = Array.isArray(answer.messages) ? answer.messages : []
  if (!list.length) return [{ title: 'Messages from users', rows: [{ label: '', value: 'Nobody has sent anything yet.' }] }]
  return [
    {
      title: `Messages from users (${list.length})`,
      rows: list.map((m) => {
        const first = String(m.message || '').trim().replace(/\s+/g, ' ')
        const head = `${KIND[m.kind] || 'Message'} · ${ago(m.created_at, now)}${m.has_log ? ' · log attached' : ''}`
        const who = m.contact ? `Reply to ${m.contact}` : m.user_id ? 'From a signed-in account' : 'No reply address'
        return {
          label: '',
          id: m.id,
          value: `${head}\n${first.length > 140 ? `${first.slice(0, 140)}…` : first}\n${who}`
        }
      })
    }
  ]
}

/** One report opened: everything it carried, the log last, as text to read or copy. */
export function messageDetail(m, now = Date.now()) {
  if (!m) return null
  const ctx = m.context && typeof m.context === 'object' ? m.context : {}
  const facts = [
    { label: 'What', value: KIND[m.kind] || 'Message' },
    { label: 'When', value: `${dayOf(m.created_at)} (${ago(m.created_at, now)})` },
    { label: 'Reply to', value: m.contact || 'They did not give an address' },
    { label: 'From', value: fromLine(ctx) || 'Not said' },
    ...(ctx.device ? [{ label: 'Device', value: String(ctx.device) }] : []),
    ...(ctx.screen ? [{ label: 'Screen', value: String(ctx.screen) }] : []),
    ...(ctx.lastError ? [{ label: 'Last error', value: String(ctx.lastError) }] : [])
  ]
  return { message: String(m.message || ''), facts, log: m.log ? String(m.log) : '' }
}
