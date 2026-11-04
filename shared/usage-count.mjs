/**
 * HOW MANY PEOPLE, COUNTED ONE WAY.
 *
 * "A day-by-day history of how many people use the app, on your Developer
 * page" (approved 4 November 2026, "Go with your picks"). Developer →
 * Customers → People already counted who used the app today, in the last 7
 * days and in the last 30, from what the server keeps anyway: when each
 * account last signed in, when each of its signed-in devices last checked in,
 * and when RevenueCat last saw the app open. Each of those keeps only the
 * LATEST time, so yesterday's count cannot be worked out today. So the server
 * now writes each UTC day's totals down late that day, and the page draws them.
 *
 * ONE RULE FOR BOTH. The page counts the answer it is handed (usageSections in
 * shared/admin.mjs) and the nightly count counts the very same answer
 * (grant-access's usage-day), through this file: what "used it" means, which
 * of the four places somebody was, which app version and which phone system.
 * Two copies of that rule would be two different head counts for one day.
 * The only difference between them is where a day starts: the page's Today
 * starts at midnight where Justin is, the night's count at midnight UTC.
 *
 * ONLY TOTALS. Nothing here names anybody or returns anything about one
 * person: every number is how many, every label is one of four places, a
 * version number or a phone system rebuilt from its digits. That is all the nightly count may keep, and the table it
 * goes into (supabase/migrations/20261104_usage_days.sql) has no column for
 * anything else.
 *
 * No imports, so it is copied as it is into the phone app
 * (mobile/src/lib/usage-count.js) and beside the server's functions
 * (supabase/functions/_shared/usage-count.mjs), by scripts/sync-relay-rules.mjs.
 */

export const DAY_MS = 86400000

/** At most this many labels in one breakdown, "Other" included, and this many letters in a label. */
export const MOST_LABELS = 40
export const LABEL_MAX = 40

/**
 * When the night's count runs, in UTC: twice, ten minutes apart, so one that
 * fails is covered by the other, and the later one, covering more of the day,
 * is the one kept. The schedule (20261104_usage_days_schedule.sql) is held
 * to these by a test, and the page says the time in Justin's own.
 */
export const COUNT_HOUR_UTC = 23
export const COUNT_MINUTES_UTC = [43, 53]

/**
 * When the night's counts begin on a UTC day ("2026-11-04"), in
 * milliseconds. A count made before then, one asked for by hand during the
 * day, is only a first look at it: record_usage_day lets the night's count
 * replace it whatever it found, and the page draws it as today so far, never
 * as the day's number. The migration holds the same time (a test keeps the
 * two the same).
 */
export const nightStarts = (day) => Date.parse(`${day}T00:00:00Z`) + (COUNT_HOUR_UTC * 60 + Math.min(...COUNT_MINUTES_UTC)) * 60000

/** How long one count may take (grant-access is given two minutes), and so when the last of the night's is over. */
export const COUNT_TAKES_MINUTES = 3
export const nightEnds = (day) => Date.parse(`${day}T00:00:00Z`) + (COUNT_HOUR_UTC * 60 + Math.max(...COUNT_MINUTES_UTC) + COUNT_TAKES_MINUTES) * 60000

/** The four places somebody can have used it. */
export const PLACES = ['iPhone app', 'Android app', 'Computer app', 'Website']

/** A time in milliseconds or an ISO string, as milliseconds, or 0 for none. */
const timeOf = (x) => {
  if (x === null || x === undefined || x === '') return 0
  const t = typeof x === 'number' ? x : new Date(String(x)).getTime()
  return Number.isFinite(t) ? t : 0
}

/** The kind of device a signed-in session was, as one of the four places. */
const placeOfKind = (kind) => {
  if (kind === 'iphone-app') return 'iPhone app'
  if (kind === 'android-app') return 'Android app'
  if (kind === 'computer') return 'Computer app'
  if (String(kind || '').startsWith('web-')) return 'Website'
  return null
}

/** RevenueCat's platform ("iOS", "Android", …) as one of the same places. */
const placeOfPlatform = (platform) => {
  if (/ios|iphone|ipad/i.test(String(platform || ''))) return 'iPhone app'
  if (/android/i.test(String(platform || ''))) return 'Android app'
  return null
}

/** The last time somebody used it: the newest of their sign-in, any device's check-in, and RevenueCat's last sighting. */
export const latestOf = (p) => {
  const devices = Array.isArray(p?.devices) ? p.devices : []
  return Math.max(timeOf(p?.lastSignIn), timeOf(p?.seen?.last), ...devices.map((d) => timeOf(d?.last_seen)))
}

/** The places somebody used it since `since`, each once however many sessions they have there. */
export const placesOf = (p, since) => {
  const here = new Set()
  for (const d of Array.isArray(p?.devices) ? p.devices : []) {
    const place = placeOfKind(d?.kind)
    if (place && timeOf(d?.last_seen) >= since) here.add(place)
  }
  if (timeOf(p?.seen?.last) >= since) {
    const place = placeOfPlatform(p.seen.platform)
    if (place) here.add(place)
  }
  return here
}

/**
 * Android's own numbers for its versions. RevenueCat's Android library
 * reports the API level ("35"), not the number on the box ("Android 15").
 * A level not here is shown as it came, "Android (API 37)": add it here when
 * Google names it.
 */
const ANDROID_API = {
  21: '5',
  22: '5.1',
  23: '6',
  24: '7',
  25: '7.1',
  26: '8',
  27: '8.1',
  28: '9',
  29: '10',
  30: '11',
  31: '12',
  32: '12L',
  33: '13',
  34: '14',
  35: '15',
  36: '16'
}

/**
 * Which phone system RevenueCat last saw somebody on, in words: "iOS 27.2",
 * "Android 16", or "iOS (version unknown)". Null for anything that is not a
 * phone or tablet (the website, the computer app), which RevenueCat does not
 * tell apart by system.
 *
 * RevenueCat keeps whatever the phone's library sent: on an iPhone or iPad
 * the system's own line, like "Version 27.2 (Build 24C5)", which says iOS for
 * both, and on Android the API level. So this takes the first number in it,
 * to two places ("27.2.1" is "27.2", and "27.0" is "27"), and maps an
 * Android level to its version. iPadOS is named only if RevenueCat ever says
 * so; until then iPads are counted under iOS, and the page says that.
 */
export function systemOf(seen) {
  const platform = String(seen?.platform ?? '').trim()
  const said = String(seen?.platformVersion ?? '').trim()
  let os = null
  if (/ipad/i.test(platform) || /ipados/i.test(said)) os = 'iPadOS'
  else if (/ios|iphone/i.test(platform) || /\bios\b/i.test(said)) os = 'iOS'
  else if (/android/i.test(platform) || /android/i.test(said)) os = 'Android'
  if (!os) return null
  const number = said.match(/\d+(?:\.\d+)*/)?.[0]
  /* Digits only, leading noughts dropped, and none longer than four: a number past that is no system's, and Number() would turn it into "1e+200". */
  const parts = number ? number.split('.').map((n) => n.replace(/^0+(?=\d)/, '')) : []
  if (!parts.length || parts.slice(0, 2).some((n) => n.length > 4)) return `${os} (version unknown)`
  if (os === 'Android' && parts.length === 1 && Number(parts[0]) >= 21) {
    const level = Number(parts[0])
    return ANDROID_API[level] ? `Android ${ANDROID_API[level]}` : `Android (API ${level})`
  }
  const version = parts.slice(0, 2).join('.').replace(/\.0$/, '')
  return `${os} ${version}`.slice(0, LABEL_MAX)
}

/**
 * What an app version must look like to be kept as itself: up to four
 * numbers with dots between ("1.89.37"). RevenueCat keeps whatever the app
 * on somebody's phone said, so anything else (a copy that sent words) is
 * counted under "Other", and a label can only ever be a version number, never
 * something that could name anybody. The table holds the versions to this
 * same pattern (usage_breakdown_ok in 20261104_usage_days.sql; a test keeps
 * the two the same), so a label the pattern refuses would lose the night's
 * whole count: this is why it is folded into Other here first.
 */
export const VERSION_LABEL = /^([0-9]{1,6}(\.[0-9]{1,6}){0,3}|Other)$/

/** An app version as a label: as it came if it is version-shaped, "Other" if not. Empty is none. */
const versionLabel = (v) => {
  const said = String(v ?? '').trim()
  if (!said) return ''
  return VERSION_LABEL.test(said) ? said : 'Other'
}

/**
 * A breakdown no bigger than MOST_LABELS: the biggest kept, the rest added
 * up under "Other", so one day can never hold a long list of anything.
 */
export function capped(counts) {
  const entries = Object.entries(counts || {}).filter(([, n]) => Number(n) > 0)
  if (entries.length <= MOST_LABELS) return Object.fromEntries(entries)
  entries.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const kept = entries.filter(([label]) => label !== 'Other').slice(0, MOST_LABELS - 1)
  const keptLabels = new Set(kept.map(([label]) => label))
  const other = entries.filter(([label]) => !keptLabels.has(label)).reduce((sum, [, n]) => sum + n, 0)
  return Object.fromEntries([...kept, ['Other', other]])
}

/** Newest first by version number, so 1.86.62 sits above 1.86.9. "Other" goes last. */
export const byVersion = (a, b) => {
  if (a === 'Other' || b === 'Other') return a === b ? 0 : a === 'Other' ? 1 : -1
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] || 0) - (pa[i] || 0)
    if (d) return d
  }
  return 0
}

/** Phone systems in the order the page lists them: iOS, then iPadOS, then Android, each newest first, unknown versions and "Other" last. */
const SYSTEM_ORDER = ['iOS', 'iPadOS', 'Android']
export const bySystem = (a, b) => {
  const rank = (label) => {
    const i = SYSTEM_ORDER.indexOf(String(label).split(' ')[0])
    return i < 0 ? SYSTEM_ORDER.length : i
  }
  const known = (label) => /\d/.test(String(label))
  const numbers = (label) => (String(label).match(/\d+(?:\.\d+)*/)?.[0] || '0').split('.').map(Number)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  if (known(a) !== known(b)) return known(a) ? -1 : 1
  const pa = numbers(a)
  const pb = numbers(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] || 0) - (pa[i] || 0)
    if (d) return d
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * EVERY COUNT THE PAGE AND THE NIGHT MAKE, from grant-access's 'usage'
 * answer, as of `now`, with "today" starting at `dayStart`.
 *
 *   active_day   people who used it since dayStart
 *   active_7     in the 7 days up to now
 *   active_30    in the 30 days up to now
 *   accounts     everyone with an account
 *   counted      the accounts the server looked at (the newest 500)
 *   unanswered   of those, how many RevenueCat did not answer about
 *   places, versions, systems
 *                each { day, month }: how many people in each place, on
 *                each app version and on each phone system, since dayStart
 *                and in the last 30 days. Each person once in each.
 *
 * Somebody using two phones is one person. An app version and a phone
 * system are what RevenueCat last saw, so they count only somebody it saw
 * in that time.
 */
export function countsAt(answer, { dayStart, now }) {
  const people = Array.isArray(answer?.people) ? answer.people : []
  const week = now - 7 * DAY_MS
  const month = now - 30 * DAY_MS
  const lasts = people.map(latestOf)
  const since = (t) => lasts.filter((l) => l >= t).length

  const windows = { day: dayStart, month }
  const places = {}
  const versions = {}
  const systems = {}
  for (const [name, from] of Object.entries(windows)) {
    places[name] = Object.fromEntries(PLACES.map((p) => [p, 0]))
    versions[name] = {}
    systems[name] = {}
    for (const p of people) {
      for (const place of placesOf(p, from)) places[name][place] += 1
      if (timeOf(p?.seen?.last) < from) continue
      const version = versionLabel(p.seen.version)
      if (version) versions[name][version] = (versions[name][version] || 0) + 1
      const system = systemOf(p.seen)
      if (system) systems[name][system] = (systems[name][system] || 0) + 1
    }
  }

  return {
    active_day: since(dayStart),
    active_7: since(week),
    active_30: since(month),
    accounts: Math.max(0, Math.round(Number(answer?.total) || people.length)),
    counted: Math.max(0, Math.round(Number(answer?.counted) || people.length)),
    unanswered: Math.max(0, Math.round(Number(answer?.unanswered) || 0)),
    places,
    versions: { day: capped(versions.day), month: capped(versions.month) },
    systems: { day: capped(systems.day), month: capped(systems.month) }
  }
}

/** The UTC day `now` falls in, as "2026-11-04". */
export const utcDay = (now) => new Date(now).toISOString().slice(0, 10)

/** Midnight UTC at the start of that day. */
export const utcDayStart = (now) => Math.floor(now / DAY_MS) * DAY_MS

/** The night's count: the same counts, for the UTC day `now` is in, and which day that is. */
export const dayCounts = (answer, now) => ({ day: utcDay(now), ...countsAt(answer, { dayStart: utcDayStart(now), now }) })
