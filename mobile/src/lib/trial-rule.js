/* Generated from shared/trial-rule.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * THE FREE TRIAL, AS A RULE: how long it is, when it is over, and what a
 * device does with what it last heard.
 *
 * "Okay, let's get the seven-day trial built out." (Justin, 7 November 2026.)
 * One trial per account, ever, and one per device, of everything the full
 * version gives on that copy, with the player's own rig. Day 8 is back to the
 * purchase page with everything kept, and buying at any time ends it.
 *
 * This file imports nothing, so it is copied as it is to the phone
 * (mobile/src/lib/trial-rule.js) and beside the server's functions
 * (supabase/functions/_shared/trial-rule.mjs), where `trial` and
 * `entitlement` import it. One length, said once: a phone counting seven
 * days and a server counting eight would be a customer told one thing and
 * given another. The words the screens say are in shared/trial-words.mjs.
 *
 * WHAT A TRIAL NEVER DOES. It never stands in for anything but the purchase:
 * every store-version gate (Bluetooth for customers, Editing over Bluetooth,
 * each unit) stays exactly where it is, and a trial opens only what a
 * purchase would open on that same copy. It never touches the purchase
 * record (public.entitlements), so it can neither overwrite nor shorten a
 * real one, and a purchase always wins over it.
 */

/** How long the trial lasts, in days. The one number; everything else is worked out from it. */
export const TRIAL_DAYS = 7

export const DAY_MS = 86400000

/** How long the trial lasts, in milliseconds. */
export const TRIAL_MS = TRIAL_DAYS * DAY_MS

/**
 * The App Store's free item that starts the trial on an iPhone or iPad.
 *
 * Apple's guideline 3.1.1: an app that is not a subscription may offer a free
 * time-based trial only as a Non-Consumable in-app purchase at price tier 0,
 * named for its length ("7-Day Trial"). docs/app-store.md says how it is set
 * up. It is NEVER put on the `full` entitlement in RevenueCat: that would make
 * a free item the full version, for good.
 */
export const TRIAL_PRODUCT_ID = 'trial_7day'

/** Where a trial came from, as the server writes it down. */
export const TRIAL_SOURCES = Object.freeze(['app_store_trial', 'server'])

/** The kinds of copy that can ask for one. */
export const TRIAL_PLATFORMS = Object.freeze(['ios', 'android', 'web', 'computer'])

/** When a trial that began at `startedAt` (ms) ends. */
export const trialEndsFrom = (startedAt) => startedAt + TRIAL_MS

/** A time in ms, or null: a number, or a date the server sent as text. */
export const timeOf = (at) => {
  if (typeof at === 'number') return Number.isFinite(at) ? at : null
  if (typeof at === 'string' && at) {
    const t = Date.parse(at)
    return Number.isFinite(t) ? t : null
  }
  return null
}

/**
 * Is the trial running at `now`? Strictly before its end: the moment it ends
 * it is over, on every copy, whatever was heard last.
 */
export const trialLive = (endsAt, now = Date.now()) => {
  const end = timeOf(endsAt)
  return end !== null && Number.isFinite(now) && now < end
}

/**
 * The clock a device goes by, which never runs backwards.
 *
 * Offline at a gig the device has only its own clock, and a clock put back a
 * week would be a week more trial. So the latest time this device has ever
 * seen (`seen`) is kept beside the trial, and the trial is measured against
 * whichever is later. It can make a trial end early on a clock that was
 * wrong forwards; it can never make one longer.
 */
export const trialClock = (now = Date.now(), seen = 0) => Math.max(Number.isFinite(now) ? now : 0, Number.isFinite(seen) ? seen : 0)

/**
 * WHAT A DEVICE KEEPS, after the server has (or has not) answered.
 *
 *   kept    what the device had: { account, endsAt, used } or null
 *   heard   the server's answer for this account: undefined when it could
 *           not be asked (offline, an older server that does not say), null
 *           for a definite "no trial", or { endsAt }
 *   account who is signed in on the device now
 *
 * The server's word wins whenever there is one, EARLIER OR LATER: the end it
 * answers is the end kept. Later is an extension (25 November 2026: Justin
 * can give a trial more days, and the trial email adds a week for somebody
 * who never got connected; extend_trial in
 * supabase/migrations/20261125_trial_extensions.sql is the only thing that
 * moves a row's end). Until then the kept end was never moved later, whoever
 * said so, and a device told of an extension would have gone on ending the
 * trial on the old day.
 *
 * With no word, the device keeps the last end it heard for THIS account, and
 * only that: an end heard for another account is nobody's here. So nothing
 * on the device itself makes a trial longer: not being offline, and not its
 * clock (trialClock, above). Only the server's own answer does.
 */
export function keptTrial({ kept = null, heard, account = null } = {}) {
  const mine = kept && account && kept.account === account ? kept : null
  if (heard === undefined) return mine
  if (heard === null) return account ? { account, endsAt: null, used: false } : null
  const end = timeOf(heard?.endsAt)
  if (end === null || !account) return mine
  return { account, endsAt: end, used: true }
}

/**
 * May this copy offer the trial button at all?
 *
 *   iOS       only when the App Store's free 7-Day Trial item was found
 *             (`storeTrial`): until Apple has approved it, no button, so this
 *             ships safely before the item exists
 *   elsewhere always: the server starts it
 *
 * And never to somebody who has bought, or whose account has had one.
 */
export const trialOffered = ({ platform, storeTrial = false, unlocked = false, used = false } = {}) =>
  !unlocked && !used && (platform === 'ios' ? Boolean(storeTrial) : TRIAL_PLATFORMS.includes(platform))

/**
 * Whole calendar days from `now` to the end, in the device's own time zone:
 * 0 when it ends today, 1 when it ends tomorrow. Null when not running.
 */
export function trialDaysLeft(endsAt, now = Date.now()) {
  if (!trialLive(endsAt, now)) return null
  const day = (t) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  return Math.round((day(timeOf(endsAt)) - day(now)) / DAY_MS)
}

/*
 * THE SERVER'S HALF, worked out here so a test can run every case of it.
 */

/**
 * What the server says about a trial row, or null for none. `live` at `now`.
 */
export function trialAnswer(row, now = Date.now()) {
  if (!row) return null
  const startedAt = timeOf(row.started_at ?? row.startedAt)
  const endsAt = timeOf(row.ends_at ?? row.endsAt)
  if (startedAt === null || endsAt === null) return null
  return { startedAt: new Date(startedAt).toISOString(), endsAt: new Date(endsAt).toISOString(), live: trialLive(endsAt, now) }
}

/**
 * WHEN A TRIAL ASKED FOR NOW BEGINS, and whether it may.
 *
 *   bought        the account has the full version already: nothing to try
 *   had           the account has had a trial (any trial, running or over)
 *   deviceTaken   this device has started one before, on any account
 *   storeAt       for an iPhone, when the App Store's free item was bought
 *                 (ms), or null when RevenueCat has none on this account
 *   platform      which copy is asking
 *
 * An iPhone's trial begins when the free item was bought, never later: a
 * request that arrives days after (no signal at the time) does not get those
 * days back, and the item carried to a second account on the same Apple ID
 * brings its old date with it.
 */
export function trialStart({ bought = false, had = false, deviceTaken = false, storeAt = null, platform, now = Date.now() } = {}) {
  if (!TRIAL_PLATFORMS.includes(platform)) return { ok: false, why: 'platform' }
  if (bought) return { ok: false, why: 'bought' }
  if (had) return { ok: false, why: 'used' }
  if (deviceTaken) return { ok: false, why: 'device' }
  if (platform === 'ios') {
    const at = timeOf(storeAt)
    if (at === null) return { ok: false, why: 'no-store-trial' }
    const began = Math.min(at, now)
    /*
     * An Apple ID's free item bought more than the trial's length ago: its
     * trial is over before it starts. RevenueCat moves an Apple ID's
     * purchases to the account signed in (docs/app-store.md, RevenueCat step
     * 0), so a second account on that Apple ID arrives with the first one's
     * old item (7 November 2026). Refused, rather than a row written already
     * ended, which would spend this account's own trial on nothing.
     */
    if (trialEndsFrom(began) <= now) return { ok: false, why: 'store-trial-over' }
    return { ok: true, startedAt: began, endsAt: trialEndsFrom(began), source: 'app_store_trial' }
  }
  return { ok: true, startedAt: now, endsAt: trialEndsFrom(now), source: 'server' }
}

/*
 * MORE TIME, AND THE ONE EMAIL NEAR THE END (25 November 2026).
 *
 * A trial started and maybe never used again: one friendly email from Justin
 * on its last day asking how it is going, and, for somebody who never got a
 * unit connected, a week more by itself. Justin can also give any trial more
 * days from his Developer page. The database holds the limits
 * (20261125_trial_extensions.sql); which email goes is decided here, so a
 * test runs every case and supabase/functions/trial-nudge only does what
 * this says.
 */

/** How many days an extension adds: the week the email gives by itself, and the button on Justin's page. */
export const TRIAL_EXTRA_DAYS = 7

/** The most one extension may add, as the database checks it. */
export const TRIAL_EXTRA_MOST = 30

/** How close to its end a trial is when the email goes: its last day. */
export const NUDGE_WITHIN_MS = DAY_MS

/** A week added by a run whose email then did not go is still said as "added" for this long. After it, the email only asks. */
export const NUDGE_TELL_MS = 2 * DAY_MS

/** A number of days an extension may add: a whole number from 1 to TRIAL_EXTRA_MOST. */
export const extraDaysOk = (days) => Number.isInteger(days) && days >= 1 && days <= TRIAL_EXTRA_MOST

/**
 * WHICH TRIAL EMAIL, IF ANY, for one trial at `now`:
 *
 *   'none'      no email: bought, emailed already, over, or not on its last
 *               day yet
 *   'extend'    never connected a unit, and not an iPhone or iPad's trial:
 *               add TRIAL_EXTRA_DAYS and say so
 *   'extended'  that week was added a moment ago by a run whose email did
 *               not go (`autoExtendedAt`): say so, and add nothing more
 *   'ask'       ask how it is going, and offer more time for a reply
 *
 * AN iPHONE OR iPAD'S TRIAL IS NEVER EXTENDED BY ITSELF. Apple's guideline
 * 3.1.1 lets an app that is not a subscription offer a free trial only as an
 * item named for its length, and that item is "7-Day Trial": a trial that
 * grew by itself would not be the item Apple approved. So there the email
 * asks, and more time is Justin's to give by hand when somebody replies.
 *
 * And never a second week by itself: somebody who has had it is asked.
 */
export function nudgePlan({ platform, connected = false, bought = false, nudged = false, endsAt, autoExtendedAt = null, now = Date.now() } = {}) {
  if (bought || nudged) return 'none'
  const end = timeOf(endsAt)
  if (end === null || !Number.isFinite(now)) return 'none'
  const added = timeOf(autoExtendedAt)
  if (added !== null && now >= added && now - added < NUDGE_TELL_MS) return end > now ? 'extended' : 'none'
  if (end <= now || end - now > NUDGE_WITHIN_MS) return 'none'
  if (connected === true || platform === 'ios' || added !== null) return 'ask'
  return TRIAL_PLATFORMS.includes(platform) ? 'extend' : 'ask'
}

/** A device id as a copy sends it: letters, digits and a few marks, 8 to 200 long. Anything else is refused. */
export const deviceIdOk = (id) => typeof id === 'string' && /^[A-Za-z0-9._:$-]{8,200}$/.test(id)
