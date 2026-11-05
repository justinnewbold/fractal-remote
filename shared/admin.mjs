/**
 * THE TOOLS ONLY JUSTIN SEES.
 *
 * "Yes, build that in and only when logged into the [his iCloud address]
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
 * and refuses anybody not on this list. An account id, not a hash of the
 * address, for the reason shared/owner-unlock.mjs gives: the eight-character
 * hash this used to be could be matched by a made-up address in a second, and
 * that would have opened every customer's details to whoever made it.
 */
import { accountId } from './owner-unlock.mjs'
import { COUNT_HOUR_UTC, COUNT_MINUTES_UTC, PLACES, byVersion, bySystem, countsAt, nightEnds, nightStarts, utcDay, utcDayStart } from './usage-count.mjs'

/**
 * His account's id. Copied into grant-access and owner-messages; a test holds
 * all three equal. It follows the ACCOUNT, not the address: if his account is
 * ever deleted and made again, the new one has a new id, and every tool on
 * both ends is gone until that id is put here and in both functions, and the
 * two are deployed again.
 */
export const ADMINS = ['7dfe6912-e43b-49bf-84e4-b56afbd442b1']

/** Whether the account signed in here (by its id) is the one the tools are for. */
export const isAdmin = (id) => {
  const at = accountId(id)
  return Boolean(at) && ADMINS.includes(at)
}

/**
 * APPLE'S REVIEW LOGIN, the account Apple signs in with at every review
 * (App Store Connect → App Review Information, and the same in Google Play's
 * App access). "I didn't add the appreview email, I think you did that so
 * Apple had a login. How do I remove it?" (Justin, 2 November 2026.) He
 * can't, and shouldn't: Apple's Guideline 2.1 wants a working demo account
 * for the signed-in screens, and one that has gone, or lost its full
 * version, gets the next version rejected at the purchase page.
 *
 * So Developer → Accounts labels it and offers no Delete (and no Take it
 * back) on it, and grant-access refuses to delete it whatever is asked.
 *
 * NAMED BY ITS DIGEST, never its address: the sha256 of the address,
 * trimmed and in lower case. This repository is public and the account is
 * the one Apple signs in with, so the address is kept out of it, as
 * supabase/migrations/20261102_email_limits.sql keeps it out when it stops
 * the download link to it. The page never works the digest out itself (a
 * phone has no sha256 to hand): grant-access marks the row `review` in the
 * list it sends. Copied into grant-access and setup-reminder; a test holds
 * the copies equal.
 */
export const REVIEW_LOGINS = ['132dcf3f4a48ad6cad50a6389e88c02c2f27a09e3ec89f92b67987a1d592acb9']

/** What its row on Everyone with an account says first. */
export const REVIEW_LOGIN_LINE = 'Apple’s review login: keep it, Apple signs in with it for every review.'

/**
 * Ask the server to check, grant or revoke the unlock for an email, or to
 * confirm that email by hand ('confirm').
 *
 * `token` is the signed-in session's access token — the server reads who is
 * asking out of it. Never throws: whatever happens comes back as
 * { ok, message }, with `found` and `unlocked` when there is an answer.
 *
 * `extra` is what one action needs besides an email: { on } for 'reminders',
 * { out } for 'leave-out', and for 'delete' the account's id the server's
 * own look handed back and { confirm: 'delete' } (accountDeleteAsk, below).
 * It can never change which action is asked, or about whom.
 */
export async function accessAction({ url, anonKey, token, action, email, extra, fetchImpl }) {
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
      body: JSON.stringify({ ...(extra && typeof extra === 'object' ? extra : {}), action, email })
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
/* How somebody paid, for Paid twice: the card is the one RevenueCat can refund. */
const CARD = ['rc_billing', 'stripe', 'paddle']
const paidBy = (store) =>
  store === 'app_store'
    ? 'on the App Store'
    : store === 'play_store'
      ? 'on Google Play'
      : CARD.includes(store)
        ? 'by card on the website'
        : `on ${storeName(store)}`

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
      value: d.confirmed
        ? 'Yes'
        : 'Not yet. They have not tapped the link in the email we sent. It may be in their Spam, Junk or Promotions folder.'
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

  /*
   * PAID TWICE. A customer bought it on his iPhone and again by card on the
   * website, and nothing here said so. The server names anybody with more
   * than one real purchase; an older server sends no list, and then there is
   * no section.
   *
   * Each row carries what Handled needs (see handledAsk below): whose it is,
   * which list, the newest purchase it is about (handledUntil), and how many
   * (handledCounts), as the server worked them out.
   */
  const twice = Array.isArray(answer.twice) ? answer.twice : []
  const paidTwice = twice.map((t) => {
    const ways = (t.stores || []).map((store, i) => `${paidBy(store)}, ${dayOf(t.at?.[i])}`)
    const card = (t.stores || []).some((store) => CARD.includes(store))
    const said = ways.length > 2 ? `${ways.slice(0, -1).join('; ')}; and ${ways[ways.length - 1]}` : ways.join(', and ')
    return {
      label: t.email,
      value: `Paid ${said}.${card ? ' The card one can be refunded in RevenueCat.' : ''}`,
      email: t.email,
      kind: 'twice',
      until: handledUntil(t),
      ...handledCounts(t)
    }
  })

  /*
   * AND A PURCHASE ON AN ACCOUNT NEVER CONFIRMED: a phone that paid before
   * it had an account puts the purchase on the account made on it, and if
   * that one is never confirmed, nothing else ever sees the purchase. A card
   * sale on the website the same day, to another address, is named beside
   * it: maybe the same person, twice. An older server sends no list, and
   * then there is no section.
   */
  const quiet = (Array.isArray(answer.unconfirmed) ? answer.unconfirmed : []).map((u) => {
    const ways = (u.stores || []).map((store, i) => `${paidBy(store)}, ${dayOf(u.at?.[i])}`)
    const near = Array.isArray(u.near) ? u.near : []
    return {
      label: u.email,
      value:
        `Paid ${ways.join(', and ')}, but never confirmed this account, so the computer and the website can’t see the purchase.` +
        (near.length ? ` A card sale on the website that day went to ${near.join(' and ')}: maybe the same person, who paid twice.` : ''),
      email: u.email,
      kind: 'unconfirmed',
      until: handledUntil(u),
      ...handledCounts(u)
    }
  })

  /*
   * THE SALES FIRST, AND THE TWO LISTS TO SORT OUT AFTER THEM. They were on
   * top, because each one was money to give back; once he had dealt with the
   * first: "I've already handled this paid twice thing ... And probably
   * doesn't need to be at the top of the list you know." (15 October 2026.)
   */
  const sections = [
    { title: 'Sales', rows: totals },
    { title: 'Where they bought', rows: where },
    { title: 'Not sales', rows: other },
    { title: 'Accounts', rows: accounts }
  ]
  const recent = real.slice(0, 10).map((s) => ({ label: dayOf(s.at), value: `${s.email}, ${storeName(s.store)}` }))
  if (recent.length) sections.push({ title: 'Latest sales', rows: recent })
  if (paidTwice.length) sections.push({ title: 'Paid twice', rows: paidTwice })
  if (quiet.length) sections.push({ title: 'Paid, account never confirmed', rows: quiet })

  const notes = []
  if (answer.unanswered) notes.push(`RevenueCat did not answer for ${answer.unanswered} of them, so the numbers may be short.`)
  if (answer.more) notes.push(`Only the latest ${answer.unlocked} unlocked accounts were counted. ${answer.more} more were left out.`)
  /* The rows he marked handled, which the server left out: a count, quietly. */
  const handled = answer.handled && typeof answer.handled === 'object' ? answer.handled : {}
  for (const [kind, title] of [['twice', 'Paid twice'], ['unconfirmed', 'Paid, account never confirmed']]) {
    const n = Number(handled[kind]) || 0
    if (n > 0) notes.push(`${title}: ${n} handled earlier.`)
  }
  if (notes.length) sections.push({ title: 'Note', rows: notes.map((n) => ({ label: '', value: n })) })
  return sections
}

/* ------------------------------------------------------------------------ */
/* Handled, on Sales at a glance                                             */
/* ------------------------------------------------------------------------ */

/*
 * "I've already handled this paid twice thing ... I wanna [be able to] mark
 * as completed or so that it doesn't appear anymore after it's been handled."
 * (15 October 2026.) Every row of Paid twice and of Paid, account never
 * confirmed has a Handled button. The server keeps the mark
 * (supabase/migrations/20261015_sales_handled.sql) by the account, the list,
 * and what that row showed: the newest purchase it is about, how many
 * purchases, and how many card sales were beside it. It leaves the row out
 * from then on only while there is nothing newer and no more of either, so
 * the same person paying again shows again: a purchase with a later date,
 * one with an earlier date that a phone brought across after the mark, or a
 * card sale on the website, to another address or to the same one again.
 * For a never-confirmed row the newest purchase takes the card sales beside
 * it in, so a new one is newer than the mark even when the one it replaces
 * was refunded and is no longer counted. A refund adds no new purchase, so
 * it never brings a row back, and never hides the next payment.
 *
 * The server works those three out and puts them on each row; the page
 * sends them back as they came (handledUntil, handledCounts), so a mark is
 * exactly what the server compares.
 *
 * The two kinds are the names of the two lists in the server's answer.
 */
export const HANDLED_KINDS = ['twice', 'unconfirmed']

/* The newest purchase time in a row, in milliseconds; 0 when none says when. grant-access counts it the same way. */
export function newestPaid(at) {
  const times = (Array.isArray(at) ? at : []).filter((t) => typeof t === 'number' && Number.isFinite(t))
  return times.length ? Math.max(0, ...times) : 0
}

/**
 * The newest purchase a row of the server's answer is about, as the server
 * compares it with a mark: its own `until`, which for a never-confirmed row
 * takes the card sales beside it in. An answer without one counts the row's
 * own purchases.
 */
export function handledUntil(x) {
  return typeof x?.until === 'number' && Number.isFinite(x.until) && x.until >= 0 ? x.until : newestPaid(x?.at)
}

/**
 * How many purchases a row of the server's answer counts, refunded ones too,
 * and how many card sales were beside it (sales, not addresses), as the
 * server compares them with a mark. An answer without them counts what the
 * row lists.
 */
export function handledCounts(x) {
  const whole = (n, or) => (Number.isInteger(n) && n >= 0 ? n : or)
  return {
    count: whole(x?.count, Array.isArray(x?.at) ? x.at.length : 0),
    nearCount: whole(x?.nearCount, Array.isArray(x?.near) ? x.near.length : 0)
  }
}

/** The short question before a row is marked handled, or null for a row that cannot be. */
export function handledAsk(row) {
  if (!row?.email || !HANDLED_KINDS.includes(row.kind)) return null
  return {
    title: `Mark ${row.email} as handled?`,
    message: `It won’t show here again unless they pay ${row.kind === 'twice' ? 'twice again' : 'again'}.`,
    cancel: 'Not yet',
    confirm: 'Handled'
  }
}

/**
 * The page's answer with that row gone, as soon as the server says it is
 * marked, rather than asking RevenueCat about every buyer again. Counted
 * with the ones handled earlier. Only the purchases he saw, by the server's
 * own rule and the server's own numbers: a row with a newer one by now, or
 * more of them, or another card sale beside it, stays.
 */
export function withHandled(answer, row) {
  if (!answer?.ok || !row?.email || !HANDLED_KINDS.includes(row.kind)) return answer
  const list = Array.isArray(answer[row.kind]) ? answer[row.kind] : []
  const marked = { until: Number(row.until) || 0, ...handledCounts(row) }
  const isMarked = (x) => {
    const has = handledCounts(x)
    return x?.email === row.email && handledUntil(x) <= marked.until && has.count <= marked.count && has.nearCount <= marked.nearCount
  }
  const left = list.filter((x) => !isMarked(x))
  if (left.length === list.length) return answer
  const was = answer.handled && typeof answer.handled === 'object' ? answer.handled : {}
  return { ...answer, [row.kind]: left, handled: { ...was, [row.kind]: (Number(was[row.kind]) || 0) + (list.length - left.length) } }
}

/**
 * Handled's trouble, in plain words. A server that has not had this part put
 * live answers "Unknown action."; a database without its table makes the
 * server's question about it fail. Anything else is said as it came.
 */
export function handledProblem(answer) {
  if (!answer || answer.ok) return null
  const said = String(answer.message || '')
  if (said === 'Unknown action.') {
    return 'Nothing was marked. The server doesn’t know Handled yet: it needs the server update that goes with it, which hasn’t been put live.'
  }
  if (/mark_sales_handled|sales_handled|PGRST202/.test(said)) {
    return 'Nothing was marked. The database has nowhere to keep it yet: it needs the database change that goes with it, which hasn’t been put live.'
  }
  return said || 'Something went wrong, and nothing was marked.'
}

/**
 * HOW MANY PEOPLE, as sections of facts.
 *
 * "Is there a way for me to see how many users are actively using the app?"
 * `answer` is grant-access's 'usage': one entry per account, naming nobody,
 * with when they last signed in, when each signed-in device last checked in,
 * and what RevenueCat last saw. Somebody counts as using it on the newest of
 * those. "Today" is the start of this device's day, so it is Justin's today.
 * The counting itself is shared/usage-count.mjs, which the night's count
 * for Day by day uses too, so the two can never count one day two ways.
 *
 * Nothing in here was recorded for this: no hours, no screens. A phone left
 * open and signed in checks in about once an hour, which is as fine-grained as
 * it gets — and the note at the bottom says so, so nobody reads more into it.
 */
const headCount = (n) => `${n} ${n === 1 ? 'person' : 'people'}`

/** The phone systems' section, and what it is read from. */
export const SYSTEMS_TITLE = 'System versions, last 30 days'
export const SYSTEMS_NOTE =
  'From the phone app only: the system RevenueCat last saw on each person’s phone or tablet. iPhones and iPads both show as iOS. The computer app and the website don’t say.'

export function usageSections(answer, now = Date.now()) {
  if (!answer?.ok) return []
  const people = Array.isArray(answer.people) ? answer.people : []
  const counts = countsAt(answer, { dayStart: dayStart(new Date(now)), now })

  const used = [
    { label: 'Today', value: String(counts.active_day) },
    { label: 'Last 7 days', value: String(counts.active_7) },
    { label: 'Last 30 days', value: String(counts.active_30) },
    { label: 'Everyone with an account', value: String(answer.total || people.length) }
  ]

  const sections = [
    { title: 'People who used it', rows: used },
    { title: 'Where, in the last 30 days', rows: PLACES.map((p) => ({ label: p, value: String(counts.places.month[p] || 0) })) }
  ]
  const versions = counts.versions.month
  const list = Object.keys(versions).sort(byVersion)
  if (list.length) {
    sections.push({
      title: 'Phone app versions, last 30 days',
      rows: list.map((v) => ({ label: v, value: headCount(versions[v]) }))
    })
  }
  /* "How do I tell which iPhone and iPad system versions people run?" (3 November 2026.) From what RevenueCat already keeps, so it is there from the first day. */
  const systems = counts.systems.month
  const kinds = Object.keys(systems).sort(bySystem)
  if (kinds.length) {
    sections.push({
      title: SYSTEMS_TITLE,
      rows: [...kinds.map((k) => ({ label: k, value: headCount(systems[k]) })), { label: '', value: SYSTEMS_NOTE }]
    })
  }
  const notes = [
    'Counted from when each account last signed in or last opened the app. Nothing new is recorded about anybody for this: once a day only that day’s totals are kept, so there are no hours or screens to show.',
    'Somebody using two phones is still one person. Somebody using the website without signing in is not counted.'
  ]
  if ((answer.total || 0) > people.length) notes.push(`Only the newest ${people.length} of ${answer.total} accounts were counted.`)
  if (counts.unanswered) notes.push(`RevenueCat didn’t answer about ${headCount(counts.unanswered)} just now, so these may be a little low. Refresh to ask again.`)
  sections.push({ title: 'Note', rows: notes.map((n) => ({ label: '', value: n })) })
  return sections
}

/* ------------------------------------------------------------------------ */
/* Day by day                                                                */
/* ------------------------------------------------------------------------ */

/*
 * HOW MANY PEOPLE, DAY BY DAY. "A day-by-day history of how many people use
 * the app, on your Developer page" (approved 4 November 2026). The server
 * writes each UTC day's totals down a few minutes before the day ends
 * (supabase/migrations/20261104_usage_days.sql), and 'usage' hands back the
 * last 31 as `days`, newest first. These are the rules the page draws them
 * by: the last 30 days as bars, today on the right; a day from before the
 * counting began is "no record yet", never a zero; a day the count missed
 * says so; and today, until the night's count has kept it, is the live count
 * so far (a count asked for by hand during the day is only a first look).
 *
 * The days are UTC days, as the server keeps them, so a day is labelled by
 * the UTC calendar ("Nov 4"), never by this device's: west of Greenwich the
 * local date of midnight UTC is the day before. The note under the bars says
 * when that midnight is here.
 */
export const DAY_BY_DAY = 'Day by day'
export const SHOWN_DAYS = 30
/** The chart's height, and the hollow stub a day with no number gets, so it never reads as a zero. */
export const CHART_HEIGHT = 120
export const STUB_HEIGHT = 8

/** "Nov 4", for the UTC day "2026-11-04". */
export const utcDayLabel = (day) => {
  const m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : 'unknown'
}

/** How many minutes this device's clock is ahead of UTC at `now` (Denver in winter is -420). */
export const offsetHere = (now = Date.now()) => -new Date(now).getTimezoneOffset()

/** A time of the UTC day, as the time here: "4:53 pm", "5 pm", "midnight", "noon". */
export const hereAt = (hour, minute, offset) => {
  const all = (((hour * 60 + minute + Math.round(Number(offset) || 0)) % 1440) + 1440) % 1440
  const h = Math.floor(all / 60)
  const m = all % 60
  if (!m && h === 0) return 'midnight'
  if (!m && h === 12) return 'noon'
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`
}

/** When a day's number is kept for good: the later of the night's two counts, as the time here. */
const keptAt = (offset) => hereAt(COUNT_HOUR_UTC, Math.max(...COUNT_MINUTES_UTC), offset)

/** The time a row was counted, as the time here ("9:38 pm"), or null. */
const countedAt = (row, offset) => {
  const t = Date.parse(String(row?.computed_at || ''))
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  return hereAt(d.getUTCHours(), d.getUTCMinutes(), offset)
}

/**
 * Whether a kept row is the night's count of its day, not a first look made
 * during it. A row that does not say when it was counted is taken as the
 * night's: the server always says, and nothing is second-guessed without it.
 */
const byNight = (row, day) => {
  const t = Date.parse(String(row?.computed_at || ''))
  return !Number.isFinite(t) || t >= nightStarts(day)
}

const whole = (x) => Math.max(0, Math.round(Number(x) || 0))

/**
 * Why there is no history to draw yet, in plain words, or null. An answer
 * with no `days` at all came from a server without this part; `daysError`
 * from one that could not read them just then (they are there); `days: null`
 * from one whose database has nowhere to keep them; an empty list from one
 * that has not reached its first night.
 */
export function daysProblem(answer, now = Date.now(), offset = offsetHere(now)) {
  if (!answer?.ok) return null
  if (answer.days === undefined) return 'Day by day needs the server update that goes with it, which hasn’t been put live.'
  if (answer.daysError) return 'The days kept couldn’t be read just now. Refresh to try again.'
  if (answer.days === null) return 'Day by day needs the database change that goes with it, which hasn’t been put live.'
  if (Array.isArray(answer.days) && !answer.days.length) return `Nothing has been kept yet. The first day is counted at ${keptAt(offset)} here.`
  return null
}

/**
 * THE BARS, oldest first and today last. Each is { day, label, kind, value,
 * height, row }:
 *
 *   counted  a day the server kept; value is how many people used it that day
 *   so-far   today, not kept by the night's count yet; value is the live
 *            count since midnight UTC, or a first look made by hand earlier
 *            today if that found more (`row` is then that first look)
 *   none     before the first day kept: no number, "no record yet"
 *   missed   after counting began, a day with nothing kept: no number either
 *   unread   the server could not read the days just now: no number, and
 *            never "no record yet", because the records are there
 *
 * A past day kept only by a first look (both of its night's counts failed)
 * is counted, with `early` set, and its line says when it was counted.
 * Today's bar has `over` set once the night's counts are over without
 * keeping it, so its line stops promising a count that has been and gone.
 *
 * `height` is the value against the most in any one day shown (0 to 1), and
 * nothing for a day with no number. `most` is that most, for the scale.
 */
export function dayBars(answer, now = Date.now(), count = SHOWN_DAYS) {
  const today = utcDay(now)
  const kept = new Map()
  for (const r of Array.isArray(answer?.days) ? answer.days : []) {
    const day = String(r?.day || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today) kept.set(day, r)
  }
  const first = [...kept.keys()].sort()[0] || null
  const soFar = countsAt(answer, { dayStart: utcDayStart(now), now }).active_day
  const unread = Boolean(answer?.daysError)
  const bars = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = utcDay(utcDayStart(now) - i * DAY_MS)
    const row = kept.get(day) || null
    const bar = { day, label: utcDayLabel(day), kind: 'missed', value: null, row }
    if (day === today && !(row && byNight(row, day))) {
      bar.kind = 'so-far'
      bar.value = Math.max(soFar, row ? whole(row.active_day) : 0)
      bar.over = now >= nightEnds(day)
    } else if (row) {
      bar.kind = 'counted'
      bar.value = whole(row.active_day)
      if (!byNight(row, day)) bar.early = true
    } else if (unread) {
      bar.kind = 'unread'
    } else if (!first || day < first) {
      bar.kind = 'none'
    }
    bars.push(bar)
  }
  const most = Math.max(0, ...bars.map((b) => b.value ?? 0))
  for (const b of bars) b.height = b.value === null ? null : b.value / Math.max(1, most)
  return { bars, most, first }
}

/** The floor line a real zero is drawn as, and the least a day with anybody is drawn as, so 1 never looks like nobody. */
export const ZERO_HEIGHT = 2
export const LEAST_HEIGHT = 4

/** How tall a bar is drawn, in points: a real zero is a thin line, a day with no number the hollow stub. */
export const barPoints = (bar, frame = CHART_HEIGHT) => {
  if (bar?.height === null || bar?.height === undefined) return STUB_HEIGHT
  if (!(bar.value > 0)) return ZERO_HEIGHT
  return Math.max(LEAST_HEIGHT, Math.round(bar.height * frame))
}

/** Which bar a touch at `x` across a chart `width` wide lands on. */
export const barAt = (x, width, count) => {
  if (!(width > 0) || !(count > 0)) return Math.max(0, count - 1)
  return Math.min(count - 1, Math.max(0, Math.floor((Number(x) / width) * count)))
}

/** What a screen reader says for a bar. */
export function barLabel(bar) {
  if (!bar) return ''
  if (bar.kind === 'counted') return `${bar.label}, ${headCount(bar.value)}`
  if (bar.kind === 'so-far') return `${bar.label} so far, ${headCount(bar.value)}`
  if (bar.kind === 'none') return `${bar.label}, no record yet`
  if (bar.kind === 'unread') return `${bar.label}, couldn’t be read`
  return `${bar.label}, not counted`
}

/**
 * The lines above the bars, for the one picked (the rightmost to begin with):
 * how many that day and in the 7 and 30 days up to it, where they were, and
 * whether RevenueCat failed to answer about some of them when it was counted.
 */
export function dayLine(bar, { first = null, offset = offsetHere() } = {}) {
  if (!bar) return []
  if (bar.kind === 'so-far') {
    const so = `${bar.label} so far: ${headCount(bar.value)}.`
    if (!bar.over) return [`${so} The day is kept at ${keptAt(offset)} here.`]
    const at = bar.row ? countedAt(bar.row, offset) : null
    return [at ? `${so} The day’s count didn’t come through, so the day keeps the one made at ${at} here.` : `${so} The day’s count didn’t come through, so this day won’t be kept.`]
  }
  if (bar.kind === 'none') return [first ? `${bar.label}: no record yet. Counting began ${utcDayLabel(first)}.` : `${bar.label}: no record yet.`]
  if (bar.kind === 'unread') return [`${bar.label}: couldn’t be read just now.`]
  if (bar.kind === 'missed') return [`${bar.label}: not counted that day.`]
  const row = bar.row || {}
  const lines = [`${bar.label}: ${headCount(whole(row.active_day))} that day, ${whole(row.active_7)} in the 7 days to then, ${whole(row.active_30)} in the 30 days to then.`]
  const where = row.places?.day && typeof row.places.day === 'object' ? row.places.day : {}
  const places = PLACES.filter((p) => whole(where[p]) > 0).map((p) => `${p} ${whole(where[p])}`)
  if (places.length) lines.push(`That day: ${places.join(', ')}.`)
  const early = bar.early ? countedAt(row, offset) : null
  if (early) lines.push(`Counted at ${early} here, before the day was over, so it may be low.`)
  const missed = whole(row.unanswered)
  /* A quarter or more of the people about that month (roughly who RevenueCat is asked about) is not "a little". */
  if (missed && missed * 4 >= Math.max(1, whole(row.active_30))) {
    lines.push(`RevenueCat didn’t answer about ${headCount(missed)} when the day was counted, so that day’s numbers are low, maybe by a lot.`)
  } else if (missed) {
    lines.push(`RevenueCat didn’t answer about ${headCount(missed)} when the day was counted, so the numbers may be a little low.`)
  }
  return lines
}

/** The scale, above the bars. */
export const scaleLine = (most) => `Most in one day: ${whole(most)}`

/** The three dates under the bars: the first, the middle and the last. */
export const axisLabels = (bars) => (bars?.length ? [bars[0].label, bars[Math.floor((bars.length - 1) / 2)].label, bars[bars.length - 1].label] : [])

/** When a day starts and is counted, in this device’s own time. */
export function utcNote(now = Date.now(), offset = offsetHere(now)) {
  const kept = keptAt(offset)
  if (!Math.round(Number(offset) || 0)) {
    return `Each day runs midnight to midnight UTC, the same as here, and is counted at ${kept}, a few minutes before it ends.`
  }
  const starts = hereAt(0, 0, offset)
  return `Each day runs midnight to midnight UTC, which is ${starts} to ${starts} here, and is counted at ${kept}, a few minutes before it ends, so it won’t always match Today above.`
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
/*
 * THE BUTTONS ACROSS THE TOP OF EVERYONE WITH AN ACCOUNT, one picked at a
 * time, beside the box that finds an address. "Can we also make a filter for
 * seeing confirmed accounts, unconfirmed, unlocked, not unlocked, last on
 * today, anything else??" (Justin, 2 November 2026.) The anything else:
 *
 *   - Unlocked, not confirmed: somebody with the full version who can't
 *     sign in to use it on the computer, the buyer of 24 September whose
 *     mistyped address every email bounced off. Confirm now is under them.
 *   - Never signed in, and New this week.
 *   - Waiting to sign up: the waiting list on its own.
 *
 * "Last on" is the list's own word for the last time the account signed in
 * with its password (the account service's last sign-in), not the last time
 * the app was opened: a phone stays signed in for weeks. People, on the
 * Customers page, counts who used the app. Today is from midnight here.
 * Only the accounts the server sent are filtered (the newest 500).
 */
const startOfToday = (now) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const at = (iso) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? t : null
}
const WEEK_MS = 7 * 86400000
export const ACCOUNT_FILTERS = [
  { key: 'all', label: 'Everyone', keep: () => true },
  { key: 'confirmed', label: 'Confirmed', keep: (a) => !!a.confirmed },
  { key: 'unconfirmed', label: 'Not confirmed', keep: (a) => !a.confirmed },
  { key: 'unlocked', label: 'Unlocked', keep: (a) => !!a.unlocked },
  { key: 'locked', label: 'Not unlocked', keep: (a) => !a.unlocked },
  { key: 'stuck', label: 'Unlocked, not confirmed', keep: (a) => !!a.unlocked && !a.confirmed },
  { key: 'today', label: 'Last on today', keep: (a, now) => (at(a.last_sign_in) ?? -Infinity) >= startOfToday(now) },
  { key: 'week', label: 'Last on this week', keep: (a, now) => (at(a.last_sign_in) ?? -Infinity) >= now - WEEK_MS },
  { key: 'never', label: 'Never signed in', keep: (a) => !a.last_sign_in },
  { key: 'new', label: 'New this week', keep: (a, now) => (at(a.signed_up) ?? -Infinity) >= now - WEEK_MS },
  { key: 'waiting', label: 'Waiting to sign up', keep: () => false }
]
const filterOf = (key) => ACCOUNT_FILTERS.find((f) => f.key === key) || ACCOUNT_FILTERS[0]

/** The people in the answer, without the pairing accounts (devices, not people). */
const peopleIn = (answer) =>
  (Array.isArray(answer?.accounts) ? answer.accounts : []).filter((a) => !/@pair\.fractal\.newbold\.cloud$/i.test(String(a?.email || '')))

/**
 * The row for one person as the list draws it, from a fresh answer: the open
 * sheet is redrawn from it after the list is read again, so its line says
 * what just happened ("Unlocked", confirmed) rather than what it said when
 * it was tapped. Matched on the address and on being a waiting-list row, so
 * an account and the same address on the waiting list stay two people.
 */
export function accountRow(answer, row, now = Date.now()) {
  if (!row?.email) return null
  const want = String(row.email).trim().toLowerCase()
  return (
    accountSections(answer, '', now, 'all')
      .flatMap((s) => s.rows)
      .find((r) => r.email && String(r.email).trim().toLowerCase() === want && !!r.waiting === !!row.waiting) || null
  )
}

/** The same person: one address, and both a waiting-list row or both not. */
export const samePerson = (a, b) =>
  !!a?.email && !!b?.email && String(a.email).trim().toLowerCase() === String(b.email).trim().toLowerCase() && !!a.waiting === !!b.waiting

/**
 * Each button's label with how many it would show, given what is typed in the
 * find box: "Not confirmed · 3". Asked of the same rows the list draws.
 */
export function accountFilterButtons(answer, find = '', now = Date.now()) {
  const want = String(find || '').trim().toLowerCase()
  const match = (email) => !want || String(email || '').toLowerCase().includes(want)
  const people = peopleIn(answer).filter((a) => match(a.email))
  const waiting = (Array.isArray(answer?.waiting) ? answer.waiting : []).filter((w) => match(w.email))
  return ACCOUNT_FILTERS.map((f) => {
    const count = f.key === 'waiting' ? waiting.length : people.filter((a) => f.keep(a, now)).length
    return { key: f.key, label: `${f.label} · ${count}`, count }
  })
}

/*
 * `keep` is the person whose sheet or row is open ({ email, waiting }): kept
 * in the list whatever the button says, so acting on them never makes their
 * row, and the line saying what just happened, vanish when the list is read
 * again (Confirm under Not confirmed, Give access under Not unlocked). The
 * title and the buttons still count only who the button holds.
 */
export function accountSections(answer, filter = '', now = Date.now(), show = 'all', keep = null) {
  if (!answer?.ok) return []
  const want = String(filter || '').trim().toLowerCase()
  const match = (email) => !want || String(email || '').toLowerCase().includes(want)
  const picked = filterOf(show)
  const keptEmail = String(keep?.email || '').trim().toLowerCase()
  const kept = (email, waitingRow) => !!keptEmail && String(email || '').trim().toLowerCase() === keptEmail && !!keep?.waiting === waitingRow
  /*
   * Not the hidden accounts the old pairing codes stood for
   * (…@pair.fractal.newbold.cloud): they are devices, not people, and on the
   * play test two of them sat in the list as sign-ups who had never confirmed
   * an email. The same test as shared/pairing.mjs's isPairAccount.
   */
  const everyone = Array.isArray(answer.accounts) ? answer.accounts : []
  const devices = everyone.length - peopleIn(answer).length
  const people = peopleIn(answer).filter((a) => (match(a.email) && picked.keep(a, now)) || kept(a.email, false))
  const held = people.filter((a) => match(a.email) && picked.keep(a, now)).length
  const allWaiting = (Array.isArray(answer.waiting) ? answer.waiting : []).filter((w) => match(w.email))
  /* The waiting list is shown under Everyone and Waiting to sign up; under any other button only an open row of it stays. */
  const waitingShown = picked.key === 'all' || picked.key === 'waiting'
  const waiting = waitingShown ? allWaiting : (Array.isArray(answer.waiting) ? answer.waiting : []).filter((w) => kept(w.email, true))
  /* Every address on the waiting list, filtered or not: Confirm now on one of them hands its unlock to whoever made the account. */
  const onWaitingList = new Set((Array.isArray(answer.waiting) ? answer.waiting : []).map((w) => String(w?.email || '').trim().toLowerCase()))

  const unlock = (a) => {
    if (!a.unlocked) return 'Not unlocked'
    return a.source === 'owner' ? 'Unlocked, owner account' : 'Unlocked'
  }
  /* Apple's review login says so first, on the list and in its sheet: the server marks it (REVIEW_LOGINS above). */
  const line = (a) => {
    const facts = [
      `Signed up ${ago(a.signed_up, now)}`,
      a.confirmed ? (a.last_sign_in ? `last on ${ago(a.last_sign_in, now)}` : 'never signed in') : 'has not confirmed their email yet',
      unlock(a)
    ].join(', ')
    return a.review === true ? `${REVIEW_LOGIN_LINE} ${facts}` : facts
  }
  /*
   * Delete this account, only where the server said it can delete
   * (`deletes`, from the grant-access that has the action), and never on the
   * review login, on his own account (`admin`, which the server marks by
   * looking up the ADMINS account), or on an owner account. A server too old
   * to mark them sends no `deletes`, so no row anywhere offers it.
   */
  const deletable = (a) => answer.deletes === true && a.review !== true && a.admin !== true && a.source !== 'owner'

  const total = Math.max(peopleIn(answer).length, (Number(answer.total) || peopleIn(answer).length) - devices)
  const filtered = picked.key !== 'all'
  const sections = []
  /* Waiting to sign up is the waiting list alone: no account to list above it. */
  if (picked.key !== 'waiting') {
    sections.push({
      title: want
        ? `${filtered ? picked.label : 'Accounts'} matching "${want}" (${held})`
        : filtered
          ? `${picked.label} (${held})`
          : `Everyone with an account (${total})`,
      rows: people.length
        ? people.map((a) => ({
            label: '',
            value: `${a.email}\n${line(a)}`,
            email: a.email,
            line: line(a),
            unlocked: !!a.unlocked,
            owner: a.source === 'owner',
            confirmed: !!a.confirmed,
            onWaitingList: onWaitingList.has(String(a.email || '').trim().toLowerCase()),
            review: a.review === true,
            admin: a.admin === true,
            canDelete: deletable(a)
          }))
        : [{ label: '', value: want || filtered ? 'Nobody with an account matches that.' : 'Nobody has made an account yet.' }]
    })
  }
  if (picked.key === 'waiting' && !waiting.length) {
    sections.push({
      title: 'Waiting for them to sign up (0)',
      rows: [{ label: '', value: want ? 'Nobody waiting to sign up matches that.' : 'Nobody is waiting to sign up.' }]
    })
  }
  if (waiting.length) {
    sections.push({
      title: `Waiting for them to sign up (${waitingShown ? waiting.length : allWaiting.length})`,
      rows: waiting.map((w) => {
        const said = `Given access ${ago(w.added, now)}. Unlocked the first time they sign in.`
        return { label: '', value: `${w.email}\n${said}`, email: w.email, line: said, unlocked: false, waiting: true }
      })
    })
  }
  /*
   * What Unlocked, not confirmed cannot see: a buyer who paid before making
   * the account and then never confirmed it. The purchase moves onto the
   * account without RevenueCat telling the server, so the server's list says
   * Not unlocked for them (grant-access, PAID, ACCOUNT NEVER CONFIRMED); Sales
   * asks RevenueCat about each such account and lists them.
   */
  if (picked.key === 'stuck') {
    sections.push({
      title: 'Note',
      rows: [{ label: '', value: 'Somebody who paid before making their account can be missing here. Sales, under Paid, account never confirmed, finds them.' }]
    })
  }
  if (!want && !filtered && total > people.length) {
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
 * AND CONFIRM NOW, under them, for an account that never confirmed its
 * email. "I confirmed crawlerrobo but it was hard to find. Add the option to
 * the accounts page under the section where I can give access" (Justin,
 * 2 November 2026): it was only on Give access, after typing the address into
 * the Customer lookup. The same server action ('confirm') as there.
 *
 * The owner's own account offers none of them: it is unlocked by being his.
 * A waiting-list row is an address, not an account, so there is nothing of
 * it to confirm.
 *
 * AND DELETE THIS ACCOUNT, last. "How do I remove accounts altogether like
 * the irecon one that's misspelled?" (Justin, 2 November 2026.) Only on a
 * row the list says can go (`canDelete`, in accountSections): never Apple's
 * review login, never his own account, never an owner account or a
 * waiting-list address, and only from a server that has the action. The
 * server refuses the first two whatever is asked; this only keeps the button
 * off them.
 *
 * And no Take it back on the review login either: Apple's reviewer would
 * stop at the purchase page, which is the same rejection by another road.
 * Give access stays, for the day it has lost the full version.
 */
export function accountChoices(row) {
  if (!row?.email) return { give: false, takeBack: false, confirmNow: false, remove: false }
  /* Deleted just now (the phone's sheet stays open on what the server said): nothing left to do to it. */
  if (row.owner || row.deleted) return { give: false, takeBack: false, confirmNow: false, remove: false }
  if (row.waiting) return { give: false, takeBack: true, confirmNow: false, remove: false }
  return {
    give: !row.unlocked,
    takeBack: !!row.unlocked && row.review !== true,
    confirmNow: row.confirmed === false,
    remove: row.canDelete === true && row.review !== true && row.admin !== true
  }
}

/**
 * WHAT DELETE THIS ACCOUNT ASKS FIRST, in plain words, once the server has
 * looked: `said` is grant-access's answer to 'delete' without the confirm,
 * which deletes nothing and says who the account is now (its id, sent back
 * with the confirm, and the server checks it again) and what it holds:
 * `paid` is { stores, byHand }, the stores of its purchases still paid for,
 * and whether it has a full version given by hand, or null when RevenueCat
 * did not answer. Then the row's own Unlocked is all there is to go on, so
 * both ways are said.
 *
 * Why the store matters: a purchase on the App Store or Google Play belongs
 * to the buyer's Apple ID or Google account, and Restore a purchase brings it
 * back on a new account. A card purchase on the website, or the full version
 * given by hand, lives on the account's RevenueCat customer, which is deleted
 * with it: nothing brings either back, and deleting refunds nothing.
 */
export function accountDeleteAsk(row, said) {
  const email = String(said?.email || row?.email || '')
  const out = [
    `Delete ${email} for good? The account goes straight away, with its sign-in, its setlists and everything else saved under it, and any computer, phone or tablet signed in to it is signed out. It can’t be undone.`
  ]
  const paid = said?.paid && typeof said.paid === 'object' ? said.paid : null
  if (paid) {
    const stores = Array.isArray(paid.stores) ? paid.stores.map(String) : []
    const inStore = [...new Set(stores.filter((s) => !CARD.includes(s)))]
    if (inStore.length) {
      out.push(`They paid ${inStore.map(paidBy).join(' and ')}: that stays with the store account they paid with, and Restore a purchase brings it back if they make a new account.`)
    }
    if (stores.some((s) => CARD.includes(s))) {
      out.push('They paid by card on the website: that goes with the account, and nothing brings it back. Deleting refunds nothing, so refund it in RevenueCat first if they’re owed it.')
    }
    if (paid.byHand === true) out.push('The full version you gave them goes with it. Give it again if they make a new account.')
    if (paid.test === true) out.push('Their full version came from a test purchase (TestFlight or a sandbox), so nothing real is lost.')
  } else if (row?.unlocked) {
    out.push(
      'They have the full version. Paid on the App Store or Google Play, it stays with them, and Restore a purchase brings it back on a new account. Paid by card on the website, or given by you, it goes with the account for good, and deleting refunds nothing.'
    )
  }
  /*
   * Access given to the address before it signed up waits on the waiting
   * list until its first sign-in, and the delete takes it with the account
   * (forget-account.ts, as when somebody deletes their own). Said, since
   * the stuck, unconfirmed account is the one he deletes so they can start
   * again (review of 3 November 2026).
   */
  if (row?.onWaitingList) out.push(WAITING_GOES)
  return out.join(' ')
}

/** The line the Delete question adds for an address on the waiting list. */
export const WAITING_GOES = 'The access you gave this address before they signed up goes too. Give it again if they make a new account.'

/*
 * The line under Confirm now on Everyone with an account. Not the Customer
 * lookup's, which starts "Try Resend first": there is no Resend here, and the
 * person this was asked for is the one Resend cannot reach, a buyer whose
 * address was mistyped, so every email to it bounces. Confirming lets in
 * whoever made the account, so it still says to be sure that is them; and an
 * address on the waiting list says what it hands over, as the lookup does.
 */
export const ACCOUNT_CONFIRM_HINT =
  'Lets them sign in with the password they chose, without the confirmation email: for someone whose emails bounce or never arrive. It lets in whoever made this account, so only use it when you know that was them.'

/** The words under Confirm now for one row of Everyone with an account. */
export function accountConfirmHint(row) {
  return row?.onWaitingList ? `${ACCOUNT_CONFIRM_HINT} ${CONFIRM_NOW_WAITING}` : ACCOUNT_CONFIRM_HINT
}

/* ------------------------------------------------------------------------ */
/* Paid but no computer yet                                                  */
/* ------------------------------------------------------------------------ */

const DAY_MS = 86400000
/* The setup emails' timing, as supabase/migrations/20261015_setup_reminders.sql has it. */
/* Two days, then a week (supabase/migrations/20261101_setup_timing.sql): time for an adapter ordered online to arrive. */
const FIRST_AFTER_MS = 2 * DAY_MS
const REMINDER_AFTER_MS = 7 * DAY_MS

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** How they got the full version: RevenueCat's word with its date when it answered, the database's otherwise. */
function gotIt(row, now) {
  const paid = row.paid
  if (paid && paid.store && paid.store !== 'promotional') {
    return `Paid ${paidBy(paid.store)}, ${ago(paid.at, now)}${paid.sandbox ? ' (a test purchase, no money taken)' : ''}`
  }
  /* The database's date for anybody from before the list is its last look, so it is "on or before". */
  const when = row.estimated ? `on or before ${dayOf(row.unlocked_at)}` : ago(row.unlocked_at, now)
  if (paid && paid.store === 'promotional') return `Given the full version by hand, ${when}`
  return `Got the full version ${when}`
}

/** What the setup emails have done for them, and what they will do. */
function emailed(row, sending, now) {
  const at = (x) => dateOf(x)?.getTime() || 0
  const first = row.first_sent_at
  if (row.left_out) return first ? `Left out. The first email went ${dayOf(first)}, and no more will.` : 'Left out: never emailed.'
  if (row.failed_at) {
    return row.failed_kind === 'reminder'
      ? `First email ${dayOf(first)}. The reminder to them was refused ${ago(row.failed_at, now)}: the mail service won’t take their address. No more go unless you try again.`
      : `The email to them was refused ${ago(row.failed_at, now)}: the mail service won’t take their address. No more go unless you try again.`
  }
  if (row.reminder_sent_at) return `First email ${dayOf(first)}, reminder ${dayOf(row.reminder_sent_at)}. No more emails.`
  if (first) {
    const due = at(first) + REMINDER_AFTER_MS
    if (due > now) return `First email ${dayOf(first)}. Reminder ${dayOf(due)}, if they still haven’t connected.`
    return sending ? `First email ${dayOf(first)}. The reminder goes within the hour.` : `First email ${dayOf(first)}. The reminder is due, once the emails are on.`
  }
  if (!row.confirmed) return 'Not emailed.'
  if (at(row.unlocked_at) + FIRST_AFTER_MS > now) return 'Not emailed yet. The first goes two days after they got the full version.'
  return sending ? 'Not emailed yet. The first goes within the hour.' : 'Not emailed yet. It goes as soon as the emails are on.'
}

/**
 * PAID BUT NO COMPUTER YET, as sections of facts.
 *
 * "About 12 of your first 40 paying customers never got the computer app
 * signed in. ... a 'paid but stuck' list on your Developer page." `answer` is
 * grant-access's 'stuck': everybody with the full version that no computer
 * app has ever been seen on, newest first, with what the setup emails have
 * done. Tapping one opens them, to copy the address or leave them out.
 *
 * The switch comes first, because while it is off nothing in the list will
 * happen by itself.
 */
export function stuckSections(answer, now = Date.now()) {
  if (!answer?.ok) return []
  const list = Array.isArray(answer.stuck) ? answer.stuck.filter((r) => r && r.email) : []
  const sending = answer.sending === true
  const dueFirst = Number(answer.dueFirst) || 0
  const dueReminder = Number(answer.dueReminder) || 0
  const helped = Number(answer.setUpAfter) || 0

  const emails = [
    {
      label: '',
      value: sending
        ? 'Setup emails: on. A first email two days after somebody gets the full version, one reminder a week after that, and only while they haven’t connected a computer or Bluetooth.'
        : 'Setup emails: off. Nothing is sent until you turn them on.'
    },
    { label: 'Due now', value: `${plural(dueFirst, 'first email', 'first emails')}, ${plural(dueReminder, 'reminder', 'reminders')}` }
  ]
  if (helped) emails.push({ label: 'Set up after an email', value: plural(helped, 'person', 'people') })

  const rows = list.map((r) => {
    const lines = [gotIt(r, now)]
    if (!r.confirmed) lines.push('Email not confirmed, so the setup emails don’t go to them.')
    lines.push(emailed(r, sending, now))
    const line = lines.join('\n')
    /* No `id` on the row: Facts reads a row with one as a message to open. */
    return { label: '', value: `${r.email}\n${line}`, email: r.email, leftOut: r.left_out === true, refused: !!r.failed_at, line }
  })
  const total = Math.max(list.length, Number(answer.total) || 0)
  const sections = [
    { title: 'Setup emails', rows: emails },
    {
      title: `Paid but no computer yet (${total})`,
      rows: rows.length ? rows : [{ label: '', value: 'Nobody. Everyone with the full version has had a computer signed in.' }]
    }
  ]
  const notes = [
    'A computer counts once the computer app has signed in with their account, even if it has signed out since.',
    'Before turning the emails on, leave out the store review’s demo account and your own test accounts: tap one to leave it out.'
  ]
  if (total > list.length) notes.push(`Only the newest ${list.length} of ${total} are shown.`)
  sections.push({ title: 'Note', rows: notes.map((n) => ({ label: '', value: n })) })
  return sections
}

/**
 * What a tap on somebody in that list offers: leave them out, or put them
 * back; and for somebody whose email was refused (and who is not left out),
 * try that email again. A refusal is never tried again by itself, and this is
 * the only way back from one without typing SQL.
 */
export function stuckChoices(row) {
  if (!row?.email) return { leaveOut: false, putBack: false, tryAgain: false }
  return { leaveOut: !row.leftOut, putBack: !!row.leftOut, tryAgain: !row.leftOut && row.refused === true }
}

/*
 * THE PERSON A SHEET IS OPEN ON, as the latest list has them, so the sheet
 * says one thing. It used to keep the row as it was when tapped and change
 * only its buttons, and after Leave them out it read "Not emailed yet. It
 * goes as soon as the emails are on." right above "... is left out. They
 * won't get the setup emails." The row as tapped is only for when the list
 * no longer has them (a computer signed in since).
 */
export function stuckRow(answer, email, tapped = null, now = Date.now()) {
  if (!email) return null
  return stuckSections(answer, now).flatMap((s) => s.rows).find((r) => r.email === email) || tapped
}

/** The list with one person left out or put back, as the server has just said, until the list is read again. */
export function withLeftOut(answer, email, leftOut) {
  if (!answer?.ok || !email || !Array.isArray(answer.stuck)) return answer
  return { ...answer, stuck: answer.stuck.map((r) => (r?.email === email ? { ...r, left_out: leftOut === true } : r)) }
}

/** The list with one person's refusal forgotten, as the server has just said, until the list is read again. */
export function withRefusalCleared(answer, email) {
  if (!answer?.ok || !email || !Array.isArray(answer.stuck)) return answer
  return { ...answer, stuck: answer.stuck.map((r) => (r?.email === email ? { ...r, failed_at: null, failed_kind: null } : r)) }
}

/** The check before the setup emails go on, counted right: "1 person is ... it goes", "3 people are ... they go". */
export function stuckTurnOnWords(answer) {
  const due = (Number(answer?.dueFirst) || 0) + (Number(answer?.dueReminder) || 0)
  const now = due === 0 ? 'Nobody is due one right now.' : due === 1 ? '1 person is due one now, and it goes within the hour.' : `${due} people are due one now, and they go within the hour.`
  return `${now} Have you read the sample and left out the accounts that should never get one?`
}

/**
 * The list's trouble, in plain words. A server that has not had this part
 * put live answers "Unknown action."; a database without its tables makes
 * the server's question about them fail. Anything else is said as it came.
 */
export function stuckProblem(answer) {
  if (!answer || answer.ok) return null
  const said = String(answer.message || '')
  if (said === 'Unknown action.') return 'The server doesn’t have this list yet. It needs the server update that goes with it, which hasn’t been put live.'
  if (/owner_setup_stuck|set_setup_|clear_setup_|PGRST202/.test(said)) return 'The database doesn’t have this list yet. It needs the database change that goes with it, which hasn’t been put live.'
  return said || 'Something went wrong.'
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

/**
 * HELP SOMEBODY SIGN IN, from the Customer lookup. "Resend their 'confirm
 * your email' message, or send them a password reset. The lookup already says
 * when somebody has not confirmed; this puts the button next to it."
 *
 * One button or the other, never both: somebody who has not confirmed cannot
 * use a reset (Supabase sends nothing to an unconfirmed address), and somebody
 * who has does not need the confirmation again. Both are the ordinary emails
 * anyone can ask for from the sign-in screen, so nothing here needs the
 * owner's key; the page only puts them where he is already looking.
 *
 * AND CONFIRM NOW, beside the resend. "He said he didn't get it. Can we set
 * up a way for me to do that myself?" The emails were delivered and still not
 * seen, most likely in Spam or Promotions, so sending another can land in the
 * same place. Confirm now marks the address confirmed on the server
 * (grant-access, action 'confirm'), with no email at all. That one is his
 * alone, so it goes through accessAction and the server's lock like Give
 * access does.
 */
export function signInHelp(answer) {
  const d = answer?.details
  if (!answer?.found || !d || !answer.email) return { confirm: false, confirmNow: false, reset: false }
  return { confirm: !d.confirmed, confirmNow: !d.confirmed, reset: !!d.confirmed }
}

/*
 * The line under Confirm now, which shows beside the resend.
 *
 * Resend first: an email that reaches them proves the address is theirs, and
 * Confirm now proves nothing. It lets in whoever made the account, so it is
 * only for an address he knows is theirs, and "check it" has to be a check he
 * can do: they emailed him from it. That also catches the likeliest wrong
 * one, a typo, which would leave them an account no reset can reach.
 */
export const CONFIRM_NOW_HINT =
  'Try Resend first. If it still isn’t reaching them, Confirm their account now lets them in with no email at all. Only use it if they emailed you from this same address, so you know it’s spelled right and really theirs: it lets whoever made the account sign in.'

/*
 * And an address on the waiting list: its unlock is claimed at the first
 * sign-in, on the confirmation email's word that the address is theirs.
 * Confirming by hand takes that word away, so he hears it before he taps.
 */
export const CONFIRM_NOW_WAITING =
  'This address is on the waiting list for the full version you gave it, so whoever made the account gets that too, the first time they sign in.'

/** The words under Confirm now, for this lookup. */
export function confirmNowHint(answer) {
  return answer?.details?.waiting === true ? `${CONFIRM_NOW_HINT} ${CONFIRM_NOW_WAITING}` : CONFIRM_NOW_HINT
}

/** What the page says after sending one, or after confirming by hand ('confirmNow'). */
export function signInHelpWords(kind, email, error) {
  /* Confirming emails nobody, so the line says to tell them: they are still waiting on an email that will not come. */
  if (kind === 'confirmNow') {
    return error
      ? { ok: false, message: `Their account was not confirmed: ${error}` }
      : {
          ok: true,
          message: `${email} is confirmed. Nothing is emailed to them, so let them know they can sign in now with the password they chose. If they have forgotten it, send them a password reset.`
        }
  }
  if (error) return { ok: false, message: `It did not send: ${error}` }
  return kind === 'confirm'
    ? { ok: true, message: `A new "confirm your email" link is on its way to ${email}.` }
    : { ok: true, message: `A link to set a new password is on its way to ${email}.` }
}
