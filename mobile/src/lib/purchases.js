import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

import { logDebug } from './debugLog'
import { mayDrive } from './unlock-rule'
import { isOwner } from './owner-unlock'
import { currentAccount, restoreSession } from './relay'
import { isDemo, setDemo } from './demo'
import { claimRelay } from './relayPass'

/**
 * The one purchase: paying to point this app at a real rig.
 *
 * "The app is gonna be a free download and then they can access the demo for
 * free and then we need to do an in app purchase to unlock it and we'll do the
 * app purchase at 9.99 that will unlock the full version."
 *
 * So the line is drawn exactly where the app stops being a toy: the DEMO is
 * free and complete, for ever, and driving the unit at your computer is what
 * costs. Nothing is time-limited and nothing expires — it is one payment for
 * one thing, which is what a non-consumable is.
 *
 * RevenueCat holds the receipts. Apple and Google each hand back their own
 * shape of proof-of-purchase, both of which have to be checked against the
 * right server and then remembered; RevenueCat does that and answers one
 * question instead — does this person have the entitlement. It also carries
 * the restore, which is not optional: Apple rejects an app that cannot give a
 * purchase back on a new handset.
 *
 * NOTHING HERE MAY EVER LOCK SOMEBODY OUT BY ACCIDENT, and that is the rule
 * this file is built around rather than an afterthought. Three things can go
 * wrong and all three fail OPEN:
 *
 *   - the native module is missing — a build made before this existed, or a
 *     bundle running without it
 *   - no API key has been configured yet
 *   - the check itself fails: no signal, RevenueCat unreachable, a timeout
 *
 * In every one of those the answer is "not locked". The alternative is an app
 * that bricks itself in a room with bad wifi, and the people most likely to be
 * in that room are the ones on a stage about to play — which is the entire
 * audience for this app. A paywall that cannot take money must never be a
 * paywall that blocks the app.
 *
 * And the last-known answer is kept on disk, so somebody who HAS paid stays
 * unlocked through a flight, a basement, a dead hotspot and a reinstall-shaped
 * afternoon without RevenueCat being reachable at all.
 */

/** What the entitlement is called in the RevenueCat dashboard. */
export const ENTITLEMENT = 'full'

/** The product to sell, if no offering is configured to name one. */
export const PRODUCT_ID = 'cloud.newbold.fractalremote.full'

/** Where the remembered answer lives between launches. */
const KEY = 'fractal.unlocked'

/* And the account this phone's purchase was put on as it was made here,
   before anybody had signed in to it (linkNewAccount), until an account
   signed in to here has the full version. */
const MADE_KEY = 'fractal.madeHere'

/* And a purchase made here that was sent to an account and has not reached
   it (linkTo): which account, and the id it was still on. Kept until it
   arrives, Restore brings it, or somebody signs out. */
const STUCK_KEY = 'fractal.stuck'

/*
 * The publishable keys, which are not secret.
 *
 * RevenueCat's SDK keys are public by design — they are compiled into every
 * copy of the app and can be read out of any of them. They identify the app to
 * RevenueCat; they do not authorise anything a person could not already do by
 * buying the thing. (The SECRET keys, which can refund and grant, are a
 * different pair of strings and belong nowhere near this repository.)
 *
 * They live in app.json under `extra` so that setting them is a one-line edit
 * rather than a code change, and so a build made before they exist still runs.
 */
const keyFor = () => {
  const extra = Constants.expoConfig?.extra?.revenuecat || {}
  return Platform.select({ ios: extra.ios, android: extra.android, default: null }) || null
}

let state = {
  /** Whether purchasing can happen at all here. */
  available: false,
  /** Whether this person may drive a real unit. */
  unlocked: false,
  /** True until the first answer, from disk or from RevenueCat. */
  checking: true,
  /** What it costs, as the store says it locally — "$9.99", "£8.99". */
  price: null,
  /** Why purchasing is off, when it is. */
  why: null,
  /*
   * And the store's own account of it, for the one case where "why" is too
   * vague to act on.
   *
   * "Still not showing ae to purchase. And yes, I downloaded this directly
   * from the play console tester site." The paywall said the shelves were
   * empty, which was true and useless: empty because Play has no such
   * product, because RevenueCat has no offering, or because the fetch failed
   * are three different afternoons of work, and the app knew which and threw
   * it away into a log nobody was reading.
   *
   * Facts only, and the store's words where there are any. Null whenever
   * there is something to sell, which is every customer who ever sees this
   * screen.
   */
  detail: null,
  /*
   * WHETHER THE FULL VERSION IS ON THIS PHONE AND NOWHERE ELSE YET: bought
   * (or restored) with nobody signed in, so RevenueCat holds it under the
   * handset's own nameless id, and no computer or other phone can see it.
   *
   * That is how a customer paid twice on 8 October. He bought on his iPhone
   * before he had an account, made one on the website, and the website asked
   * "has this account paid?" and was truthfully told no — the purchase was
   * still the phone's. So the screens he could land on say so (ONLY_HERE).
   */
  onlyHere: false,
  /* Bought on this phone, this run, with nobody signed in: the sign-in
     screen opens on making the account that carries it (App.js). */
  boughtAlone: false,
  /* What the Buy button is held behind for the rest of this run — a payment
     the store is still waiting on, one it took and has not confirmed, or a
     purchase made here that has not reached the account signed in to
     (NOT_ACROSS, for as long as `stuck`). Null nearly always. */
  held: null,
  /* The purchase is on an account made on this phone that nobody has signed
     in to yet (linkNewAccount): a mistyped email, or a confirmation still to
     come. Still this phone's to carry, so the sign-in screen says so. */
  madeHere: false,
  /*
   * PAID ON THIS PHONE, AND NOT ON THE ACCOUNT YET: sent across and not
   * arrived (linkTo). The phone saw the money taken, so it stays unlocked —
   * an outage or a receipt that would not go must never lock out somebody
   * who paid — and Buy stays held, so it takes none again. Kept on the
   * phone, so a relaunch keeps both and tries again.
   */
  stuck: false
}

/* What a customer whose purchase is only on this phone is told, wherever
   they land: the sign-in screen, the demo, and Settings → Account. */
export const ONLY_HERE =
  'Your purchase is only on this phone so far. Make an account or sign in, and it works on your computer too.'

/* What a payment the store is still waiting on is called: Ask to Buy, a bank
   that wants its own approval, cash at a shop on Google Play. Buy waits with
   it for the rest of the run, so one turned down is tried again from a fresh
   start. */
export const PENDING =
  'Your payment is still waiting to go through. The app unlocks by itself when it does, so please don’t pay for it again anywhere else. If it’s turned down, close the app fully and open it again to try once more.'

/* What a purchase made on this phone before signing in is called when it
   could not be sent across to the account (bringAcross, below). The app
   tries again by itself, so that is said, and Restore is the try-now. */
export const NOT_ACROSS =
  'You paid for the full version on this phone, but it hasn’t reached your account yet. Please don’t pay for it again anywhere. The app tries again each time it opens, or tap Restore a purchase to try now.'

/* And when Restore could not move it either: a receipt the store will not
   send twice (a used-up Google purchase) is beyond anything on the phone,
   so it says who can sort it out, and still not to pay. */
export const STILL_STUCK =
  'Restore couldn’t move it across either. Please don’t pay again: send us a message from Settings → Troubleshooting → Feedback, and we’ll sort it out.'

/* Buy finding the full version already here: nothing was taken, and that is
   the first thing a person who just pressed the price wants to know. */
export const ALREADY_HAD = 'You already have the full version, so nothing was charged.'

/* For somebody who paid on another device before they had an account, which
   is who paid twice on 8 October: there is no account there to sign in with
   yet. Names no other place to pay (Apple 3.1.3, Google Play's payments
   policy): only a device, and an account. */
export const NO_ACCOUNT_THERE =
  'If you bought it before you had an account, make the account on the device you bought it on first, then sign in here with it.'

/* The hold, less that one: once the account changes, or has the purchase, its words are not true. */
const notStuck = () => (state.held === NOT_ACROSS ? null : state.held)

/* The account the phone's own gate is held open for while its purchase is
   on the way there (linkTo), so the store's "not yet" cannot lock it. */
let openFor = null

/* The store account a purchase on this phone belongs to, by the name its owner knows it by. */
const storeAccount = () => (Platform.OS === 'ios' ? 'Apple ID' : 'Google account')

const watchers = new Set()
const announce = () => {
  for (const fn of watchers) fn()
}
/*
 * VIEW AS A NEW CUSTOMER. "See the walkthrough, the paywall and the first
 * screens exactly as a stranger sees them, without signing out or deleting
 * anything." (docs/later.md) While it is on, every screen is told this phone
 * has not unlocked. Nothing is changed: the purchase, the account and the
 * store are untouched, the server's own gate on the computer link is the
 * real one, and turning it off (the banner, or restarting the app) puts the
 * real answer straight back.
 */
let posing = false
let shown = state
const refreshShown = () => {
  shown = posing ? { ...state, unlocked: false, posing: true } : state
}

const set = (next) => {
  state = { ...state, ...next }
  refreshShown()
  announce()
}

export function poseAsNewCustomer(on) {
  posing = Boolean(on)
  refreshShown()
  announce()
}

/** The native module, or null where there isn't one. */
let Purchases = null
let pkg = null

/**
 * Load the SDK without letting a missing one take the app down.
 *
 * `react-native-purchases` is native. In a JS bundle running on a build that
 * predates it — which is every build of this app that exists today — the
 * import throws, and an import that throws at the top of a module takes the
 * whole app with it. So it is required lazily, inside a try, and its absence
 * is an ordinary answer rather than a crash.
 */
const load = async () => {
  if (Purchases) return Purchases
  try {
    /* A DYNAMIC import, not a static one, and not require().
       Static would be uncatchable: a throw at the top of a module takes the
       whole app down, and this module is imported by App.js before a frame is
       drawn. require() would work under Metro but is not a name this app has
       anywhere else, and test/mobile.mjs is right to refuse it. `import()` is
       syntax rather than a global, it is what Metro wants, and a failure comes
       back as a rejected promise this can catch. */
    const mod = await import('react-native-purchases')
    Purchases = mod?.default || mod || null
  } catch (err) {
    Purchases = null
    logDebug(`purchases: no native module (${err?.message || err})`)
  }
  return Purchases
}

/** What we last knew, from disk. Read before the network is asked anything. */
const remembered = async () => {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'yes'
  } catch {
    return false
  }
}

const remember = async (yes) => {
  try {
    await AsyncStorage.setItem(KEY, yes ? 'yes' : 'no')
  } catch {
    /* A phone that cannot write this still runs; it just re-asks next launch. */
  }
}

const madeHere = async () => {
  try {
    return (await AsyncStorage.getItem(MADE_KEY)) || null
  } catch {
    return null
  }
}

const noteMade = async (id) => {
  try {
    if (id) await AsyncStorage.setItem(MADE_KEY, id)
    else await AsyncStorage.removeItem(MADE_KEY)
  } catch {
    /* Unwritten, a later sign-in elsewhere only misses the receipt being
       sent again; Restore still brings it. */
  }
}

const stuckNote = async () => {
  try {
    const note = JSON.parse((await AsyncStorage.getItem(STUCK_KEY)) || 'null')
    return note && typeof note.account === 'string' && note.account ? note : null
  } catch {
    return null
  }
}

const noteStuck = async (note) => {
  try {
    if (note) await AsyncStorage.setItem(STUCK_KEY, JSON.stringify(note))
    else await AsyncStorage.removeItem(STUCK_KEY)
  } catch {
    /* Unwritten, the hold lasts this run only; Restore still brings it. */
  }
}

/* The purchase the phone was carrying has reached the account, or the
   account has one of its own: nothing is held for it any more. */
const arrived = async () => {
  openFor = null
  await noteStuck(null)
  set({ stuck: false, held: notStuck() })
}

/* Who RevenueCat is answering as on this phone right now, or null. */
const currentId = async (api) => {
  try {
    return (await api.getAppUserID?.()) || null
  } catch {
    return null
  }
}

/** Read the entitlement out of whatever shape RevenueCat handed back. */
const entitled = (info) => Boolean(info?.entitlements?.active?.[ENTITLEMENT])

/*
 * RevenueCat's answer for whoever this phone is answering as, asked FRESH.
 *
 * The SDK hands back its saved copy for five minutes, and that copy can be
 * from before a purchase made on the website or another phone a minute ago.
 * Null when it could not be asked: no signal is not an answer.
 */
const freshInfo = async (api) => {
  try {
    await api.invalidateCustomerInfoCache?.()
    return (await api.getCustomerInfo()) || null
  } catch (err) {
    logDebug(`purchases: could not re-read the store (${err?.message || err})`)
    return null
  }
}

/* Whether RevenueCat knows this phone by its own nameless id, rather than an account's. */
const nameless = async (api) => {
  try {
    return (await api.isAnonymous?.()) === true
  } catch {
    return false
  }
}

/* See `onlyHere` above. Read from the phone's own sign-in, never the account
   server: no signal must not make a signed-in customer look like nobody. */
const aloneHere = async (api, info) =>
  entitled(info) && (await nameless(api)) && !(await restoreSession().catch(() => null))

/**
 * Start up, once, as early as the app can manage it.
 *
 * Never throws and never rejects: every failure inside becomes `available:
 * false`, which reads everywhere as "not locked".
 */
/**
 * The account, if it is one that carries an unlock without paying.
 *
 * "Is there any way we can set it up so that my email unlocks the app
 * automatically? I still wanna be able to test with live connections."
 *
 * Read from the SESSION rather than from anything typed: currentAccount asks
 * the account service who is signed in, so the check is on an identity
 * somebody has already proved with a password. The list in
 * shared/owner-unlock is public and grants nothing by being read.
 *
 * Never un-sets anything. Signing out of an owner account does not take an
 * unlock away from somebody who also bought it, and an account service that
 * cannot be reached is not evidence of anything.
 */
export const checkOwner = async () => {
  try {
    const account = await currentAccount()
    if (account && isOwner(account.id)) {
      await remember(true)
      set({ unlocked: true })
      logDebug('purchases: unlocked by account')
      return true
    }
  } catch (err) {
    logDebug(`purchases: could not check the account (${err?.message || err})`)
  }
  return false
}

/**
 * Tell RevenueCat WHO this is, so a purchase follows the person and not the
 * handset.
 *
 * "I don't want to charge people to use other devices if they already
 * purchased."
 *
 * Without this the SDK is started anonymously: it knows "this install on this
 * phone" and nothing else, so an iPhone purchase left an Android tablet
 * locked even with the same email signed in on both. The paywall meanwhile
 * promised "the full version of this app on any device you use, forever",
 * which somebody would have discovered by paying twice.
 *
 * The id is the ACCOUNT's, not the email. An address can be changed; the
 * Supabase user id cannot, and a purchase tied to an address somebody edits
 * is a purchase they lose.
 *
 * logIn also carries an anonymous purchase over: somebody who bought before
 * making an account gets it aliased onto the account, which is the ordinary
 * order of events here — the paywall comes before the sign-in screen. Only
 * the first time an account is used on a phone, though; after that it takes
 * the receipt sent again (bringAcross, below).
 */
/*
 * The server said yes and the store has not heard yet.
 *
 * Somebody Justin put on the waiting list is unlocked on the server the first
 * time they sign in — by the same call claimRelay makes — and RevenueCat's SDK
 * on this phone is still holding the answer it fetched a moment before. So
 * when the server says yes, the SDK is asked again, fresh. Only the STORE's
 * answer unlocks the screen: the server's yes can be a fail-open "unknown",
 * and that must not unlock anything here.
 */
const catchUp = async (api) => {
  if (state.unlocked && !state.stuck) return
  try {
    await api.invalidateCustomerInfoCache?.()
    const info = await api.getCustomerInfo()
    if (entitled(info)) {
      await remember(true)
      if (state.stuck) await arrived()
      set({ unlocked: true })
      logDebug('purchases: unlocked by the server (a grant given before this account existed)')
    }
  } catch (err) {
    logDebug(`purchases: could not re-read the store (${err?.message || err})`)
  }
}

/* The relay claim the last link started, so a sign-in can wait for it. */
let claiming = Promise.resolve()

/*
 * PURCHASES FOLLOW THE ACCOUNT, EVEN WHEN logIn DOES NOT CARRY THEM.
 *
 * logIn moves a nameless purchase onto an account only the first time that
 * account is used on a phone. After that the account has a nameless alias
 * of its own, and RevenueCat's rule is "no merge or purchase transfer
 * occurs": somebody who bought on a second phone before signing in signed in
 * to an account without it, met the price again, and could pay again.
 *
 * So the phone notes, just before logIn, whether the full version it holds
 * is its own (phonesOwn), and if the account comes back without it, sends
 * the phone's store receipt again under the account. RevenueCat's default
 * (Transfer) moves the purchase across. It is silent — no Apple or Google
 * sign-in is asked for — and it never throws or holds a sign-in up beyond
 * the time the sign-in already allows (LINK_WAIT_MS).
 *
 * Its own means on no account anybody has signed in to here: the phone's
 * nameless id, or an account made here and not signed in to since
 * (linkNewAccount), which may never be — a mistyped email, or a
 * confirmation that never came, as on 8 October. Never an account somebody
 * signed in to: that purchase is theirs, and moving it would take it off
 * them.
 *
 * AND A PURCHASE SENT ACROSS THAT HAS NOT ARRIVED IS STILL ITS OWN. The
 * sync can fail: wifi that drops straight after the sign-in, a receipt the
 * store will not send twice. Then the purchase is still on the id it was
 * on, and the SDK is on the account, so nothing above can see it any more —
 * a relaunch forgot it, and sold it again. The stuck note on the phone
 * remembers it (linkTo): the account it was sent to, which signing in to
 * again tries again. Another account in its place, straight from that one,
 * gets it instead — unless the first has it after all (a sync that went
 * through and answered too late), which is asked fresh, and then it is
 * theirs.
 */
const phonesOwn = async (api, id, made, stuck, current) => {
  try {
    if (stuck && current === stuck.account) {
      if (id === stuck.account) return true
      const first = await freshInfo(api)
      return Boolean(first) && !entitled(first)
    }
    const parked = Boolean(made) && made !== id && current === made
    if (!parked && !(await nameless(api))) return false
    return entitled(await api.getCustomerInfo())
  } catch {
    return false
  }
}

/*
 * The answer the sync itself hands back, once the receipt is posted.
 * syncPurchases returns before anything is sent and never reports a
 * failure, so a read straight after it raced the post and lost.
 *
 * Tried again after a short wait, the first time: the moment straight after
 * a sign-in is when a phone's wifi is likeliest to have just dropped. Null
 * unless the account has it.
 */
const SYNC_WAITS_MS = [1500, 3000]

const bringAcross = async (api, tries = 1) => {
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, SYNC_WAITS_MS[i - 1] ?? SYNC_WAITS_MS[SYNC_WAITS_MS.length - 1]))
    try {
      const info = (await api.syncPurchasesForResult())?.customerInfo || null
      logDebug(`purchases: sent this phone’s purchase to the account (${entitled(info) ? 'it has it now' : 'it still does not'})`)
      if (entitled(info)) return info
    } catch (err) {
      logDebug(`purchases: could not send this phone’s purchase to the account (${err?.message || err})`)
    }
  }
  return null
}

/* `made`: the account was just made here, not signed in to (linkNewAccount). */
const linkTo = async (api, id, { made = false } = {}) => {
  if (!api?.logIn || !id) return null
  const wasOpen = openFor
  try {
    const before = await madeHere()
    const was = await stuckNote()
    const current = await currentId(api)
    const had = await phonesOwn(api, id, before, was, current)
    /* The gate stays open across the sign-in for a purchase this phone is
       carrying, and only for that: the listener hears the account's "not
       yet" before the sync has had its go. */
    openFor = had ? id : null
    const out = await api.logIn(id)
    logDebug('purchases: linked to the account')
    let info = out?.customerInfo || null
    /*
     * Not there yet, so it is sent: held BEFORE the sync, and written down.
     * Buy, and the price page, must not show for the seconds it takes, and
     * a phone closed in the middle of it must still know when it opens.
     */
    const carrying = had && !entitled(info)
    set({
      boughtAlone: false,
      onlyHere: false,
      madeHere: false,
      ...(carrying ? { held: NOT_ACROSS, stuck: true, unlocked: true } : { held: notStuck(), stuck: false })
    })
    if (carrying) {
      await noteStuck({ account: id, from: was?.from || current })
      await remember(true)
      info = (await bringAcross(api, was ? 1 : 1 + SYNC_WAITS_MS.length)) || info
    }
    if (entitled(info)) {
      /* The account has it: nothing left for this phone to carry. An account
         just made here holds it until somebody signs in (madeHere). */
      await arrived()
      await noteMade(made ? id : null)
      set({ madeHere: made })
    } else if (had) {
      /* Still not there: a sync that failed, or a receipt the store will not
         send twice. The phone took the money, so it takes none again, and
         keeps its own gate open. */
      logDebug('purchases: this phone’s purchase has not reached the account yet; Buy is held')
    } else {
      /* Nothing of this phone's on the way: a note left from before is about
         an account this one replaced, or one that has it after all. */
      if (was) await noteStuck(null)
    }
    /* And tell the relay. logIn is the moment a handset's purchase becomes an
       account's, so it is the moment the relay's table can first be right
       about it. Not awaited here: at launch nothing waits on the answer. A
       sign-in does (linkAccount), and reads it from `claiming`. Neither half
       ever throws. */
    claiming = claimRelay().then((yes) => (yes ? catchUp(api) : null))
    return info
  } catch (err) {
    /* Not fatal, and not evidence of anything. The remembered answer stands
       and the store is still asked; this only means the entitlement will not
       cross platforms until the next launch that manages it. */
    openFor = wasOpen
    logDebug(`purchases: could not link to the account (${err?.message || err})`)
    return null
  }
}

/**
 * The account signed in after startup, so link and re-read now.
 *
 * Only ever unlocks. A logIn that comes back with nothing is not proof the
 * person has not paid — it is one answer from one network call — and the rule
 * at the top of this file is that only certainty locks anybody out.
 *
 * AND IT IS WORTH WAITING FOR, which the sign-in screen now does (App.js).
 * Somebody Justin gave access to, or put on the waiting list, is unlocked by
 * the relay claim this starts, a second or two after the store has already
 * said no. Not waited for, the first thing a tester he invited saw was the
 * price, which then vanished on its own: "I don't wanna make it difficult for
 * them." So when the store's own answer is not a yes, this waits for the
 * claim too.
 *
 * Bounded, because a sign-in waits on it behind a spinner and a stage is
 * where the line is worst. The claim gives up at eight seconds on its own
 * (relayPass); this lets go at LINK_WAIT_MS whatever is still going, and
 * whatever finishes later still unlocks — the Paywall closes itself on an
 * unlock.
 */
const LINK_WAIT_MS = 10000

const link = async () => {
  const api = await load()
  if (!api) return
  try {
    const account = await currentAccount()
    if (!account?.id) return
    const info = await linkTo(api, account.id)
    if (info && entitled(info)) {
      await remember(true)
      set({ unlocked: true })
      logDebug('purchases: unlocked by a purchase on this account')
    } else {
      await claiming
    }
    loadPrice()
  } catch (err) {
    logDebug(`purchases: link failed (${err?.message || err})`)
  }
}

/*
 * AN ACCOUNT JUST MADE ON A PHONE THAT HAS PAID, before its email is
 * confirmed.
 *
 * Making an account hands back its id at once, but no sign-in until the
 * email is confirmed, and the confirmation link opens the WEBSITE signed in.
 * That is where 8 October's customer was sold it again: the website asked
 * about an account the phone had not yet signed in to. RevenueCat needs no
 * sign-in to be told whose phone this is, so the purchase goes onto the new
 * account now, before the website can ask.
 *
 * Only for a phone whose purchase is its alone and on no account anybody
 * has signed in to — the phone's nameless id (onlyHere), an account made
 * here before (madeHere), or one it is still on its way to (stuck) — and
 * with nobody signed in on the phone: anybody else's phone, and anybody's
 * account, is left exactly as it was. Never throws, and nothing waits on it.
 *
 * And the account is noted, because it may never be signed in to: made
 * with a mistyped email, or a confirmation that never came. A SECOND
 * account made here takes it on from the first, for the same reason the
 * first took it: the confirmation link opens the website signed in to the
 * new one, and nobody has ever signed in to the old one to own it. Signing
 * in to either later still brings the purchase across (phonesOwn), and a
 * sync that fails on the way holds Buy without locking the phone (stuck).
 */
export const linkNewAccount = async (id) => {
  if (!id || !(state.onlyHere || state.madeHere || state.stuck)) return false
  if (await restoreSession().catch(() => null)) return false
  const api = await load()
  if (!api) return false
  const info = await linkTo(api, id, { made: true })
  const yes = entitled(info)
  logDebug(`purchases: the new account ${yes ? 'has this phone’s purchase' : 'did not get this phone’s purchase yet'}`)
  return yes
}

/* NEVER REJECTS: the sign-in screen waits on it behind a spinner, and a
   rejection would leave somebody looking at that spinner for good. */
export const linkAccount = () => {
  let stop
  const late = new Promise((resolve) => {
    stop = setTimeout(resolve, LINK_WAIT_MS)
  })
  return Promise.race([link().catch(() => {}), late]).finally(() => clearTimeout(stop))
}

/**
 * Signed out, so stop answering as that person.
 *
 * AND IT NEVER TAKES THE UNLOCK AWAY. RevenueCat's logOut returns to a fresh
 * anonymous id, which by definition owns nothing — so re-reading the
 * entitlement here would lock out somebody who bought on this very phone and
 * then signed out of an account they did not need to buy it. The remembered
 * answer stands, and Restore is there for the case where it really is gone.
 */
export const unlinkAccount = async () => {
  const api = await load()
  if (!api?.logOut) return
  /* A purchase on its way to the account goes no further for it: the phone
     forgets the account, so its gate is not held open for it, and Restore
     is the way back to what was paid here. */
  const wasOpen = openFor
  openFor = null
  try {
    const info = await api.logOut()
    await noteStuck(null)
    /*
     * AND THE PHONE STOPS CLAIMING WHAT THE ACCOUNT TOOK WITH IT.
     *
     * This used to keep the remembered answer, on the reasoning that logOut
     * returns a fresh anonymous id which owns nothing, so re-reading would
     * lock out somebody who bought on this very phone and then signed out of
     * an account they never needed in order to buy.
     *
     * That reasoning protected one person and broke the screen for everybody
     * else. "When I log out of the phone... no option to unlock the app
     * anywhere or restore the purchase." Of course not: the app still
     * believed it was unlocked, so it hid both — the Setup row and the
     * paywall are the same `unlocked` flag. A phone that cannot be unlocked
     * and cannot be restored is a dead end, and it also means the next person
     * to sign in on that handset gets the app for nothing.
     *
     * So the answer follows whoever is actually signed in, and Restore is the
     * way back for the person the old rule was protecting. It asks Apple or
     * Google directly rather than asking RevenueCat who this anonymous id is,
     * so a purchase made on this handset comes back in one tap — and Apple
     * requires that button to exist anyway.
     */
    const yes = entitled(info)
    set({ boughtAlone: false, onlyHere: await aloneHere(api, info), held: notStuck(), stuck: false, madeHere: false })
    await remember(yes)
    set({ unlocked: yes })
    logDebug(`purchases: unlinked from the account (unlocked ${yes})`)
  } catch (err) {
    openFor = wasOpen
    /* Logging out of an already-anonymous user throws, and is a no-op — there
       was no account to stop answering as, so nothing is claimed wrongly. */
    logDebug(`purchases: nothing to unlink (${err?.message || err})`)
  }
}


export const startPurchases = async () => {
  const known = await remembered()
  if (known) set({ unlocked: true })

  /* Before the store is asked anything: an owner is unlocked whether or not
     RevenueCat is reachable, has a product, or exists. */
  await checkOwner()

  const api = await load()
  if (!api) {
    set({ available: false, checking: false, why: 'This build cannot take payments.' })
    return
  }

  const key = keyFor()
  if (!key) {
    set({ available: false, checking: false, why: 'Payments are not set up yet.' })
    logDebug('purchases: no API key in app.json extra.revenuecat')
    return
  }

  try {
    await api.configure({ apiKey: key })
    /* WHO before WHAT. Linking first means the very first read is already the
       account's, so a phone that has never bought anything but is signed in to
       an account that has comes up unlocked rather than flashing the paywall
       and correcting itself. */
    const account = await currentAccount().catch(() => null)
    const linked = account?.id ? await linkTo(api, account.id) : null
    const info = linked || (await api.getCustomerInfo())
    /*
     * AND WHAT THE PHONE IS STILL CARRYING, signed in or not: a purchase on
     * its way to the account the SDK is on (stuck), which keeps its hold and
     * its gate open — the sign-in may have run out at a gig with no signal —
     * and one on an account made here (madeHere), which the sign-in screen
     * still has to say.
     */
    const current = await currentId(api)
    const note = await stuckNote()
    const stuck = Boolean(note && current === note.account && !entitled(info))
    if (stuck) {
      openFor = note.account
      set({ held: NOT_ACROSS, stuck: true })
    }
    const made = await madeHere()
    const yes = entitled(info) || stuck
    await remember(yes)

    /*
     * AND WHETHER THIS PHONE CAN PAY AT ALL, which is not the same question as
     * whether RevenueCat answered.
     *
     * The APK on the Releases page is installed from a link rather than from
     * the Play Store, and an app installed outside Play has no Play Billing —
     * so the store would say "no purchase" for ever and every sideloaded copy
     * would be locked behind a button that cannot take money. That is the
     * exact trap this whole file exists to avoid, arriving through a door I
     * had not thought of: the developer's own test phone.
     *
     * The same covers a device with purchases switched off in parental
     * controls, and a corporate handset with billing disabled.
     *
     * A person who HAS paid is unlocked either way — entitlement is read
     * above, and it does not care whether this handset can buy anything.
     */
    let canPay = true
    try {
      canPay = (await api.canMakePayments?.()) !== false
    } catch (err) {
      /* Could not find out. Assume it can, and let the rule below fail open. */
      logDebug(`purchases: canMakePayments unknown (${err?.message || err})`)
    }

    /*
     * AND WHETHER THERE IS ANYTHING TO SELL, which is a different question
     * again and the one that was missing.
     *
     * `canMakePayments` answers "could this handset pay for something". It
     * says nothing about whether a product EXISTS. Before the $9.99 item is
     * created in App Store Connect and Play, RevenueCat has no offering to
     * return — so the app was in the worst possible state: the gate closed,
     * and the paywall behind it had nothing to sell.
     *
     *   "I'm blocked now by the gate for the unlock."
     *
     * That is not only a problem before launch. An offerings fetch that fails
     * for a real customer — a bad minute on a hotel network — would wall them
     * out of a rig they already own, for a purchase the app could not have
     * completed anyway.
     *
     * So the price is loaded BEFORE anything is decided, and `available`
     * means what its name always implied: this person can pay, and there is
     * something here to pay for. The rule fails open while `checking` is
     * true, so the extra round trip costs a moment of nothing rather than a
     * moment of being locked out.
     */
    const sellable = await loadPrice()

    const available = canPay && sellable
    const alone = await aloneHere(api, info)
    set({
      available,
      unlocked: yes,
      onlyHere: alone,
      madeHere: Boolean(made && current === made && entitled(info)),
      checking: false,
      why: !canPay
        ? 'This copy of the app cannot take payments.'
        : !sellable
          ? 'Couldn’t reach the store just now. Close the app fully and open it again to try, or tap Restore a purchase if you’ve bought it before.'
          : null
    })
    if (!available) {
      logDebug(`purchases: nothing is locked (canPay ${canPay}, sellable ${sellable})`)
    }
    api.addCustomerInfoUpdateListener?.((next) => {
      /* A purchase on its way to this account keeps the gate open: the
         account's "not yet" is not a no from somebody this phone saw pay. */
      const now = entitled(next) || Boolean(openFor)
      if (entitled(next) && state.stuck) arrived()
      remember(now)
      set({ unlocked: now })
      /* And whether it is still this phone's alone: a sign-in, or the
         purchase being sent across to the account, ends that. */
      aloneHere(api, next).then((alone) => set({ onlyHere: alone }))
    })
    loadPrice()
  } catch (err) {
    /*
     * FAILS OPEN, and deliberately. A check that could not be made is not a
     * "no" — see the rule at the top of this file. The remembered answer, if
     * there is one, stands.
     */
    set({ available: false, checking: false, why: 'Could not reach the store.' })
    logDebug(`purchases: start failed (${err?.message || err})`)
  }
}

/**
 * THE PACKAGE THAT SELLS THE UNLOCK, out of however many an offering holds.
 *
 * It used to be whichever package came first, and that was a coin toss wearing
 * a confident face. A RevenueCat project starts life with three sample
 * packages — $rc_monthly, $rc_annual, $rc_lifetime — and this one's account has
 * all three sitting in the offering the app reads. They resolve to nothing
 * today, because the only products on them are Test Store ones, so first-wins
 * happens to land on the right package. The day a real product is attached to
 * the monthly sample, first-wins sells a MONTHLY SUBSCRIPTION for an app whose
 * entire pitch is "One payment, once" — and the button would still say the
 * right-looking price while doing it.
 *
 * So the product id decides, and the id is the same one the entitlement is
 * wired to. First-wins stays as the fallback, because an offering built by
 * hand with a differently-named product in it should still sell something
 * rather than nothing, and because that is what shipped.
 */
const theUnlockIn = (offerings) => {
  const every = [
    ...(offerings?.current?.availablePackages || []),
    ...Object.values(offerings?.all || {}).flatMap((o) => o?.availablePackages || [])
  ]
  return every.find((p) => p?.product?.identifier === PRODUCT_ID) || every[0] || null
}

/**
 * Ask the store what it charges here, so the button can say so.
 *
 * ANSWERS WHETHER THERE IS ANYTHING TO SELL, which the caller needs before it
 * can decide whether to gate anybody. No offering and no product is not a
 * price of zero — it is a shop with empty shelves, and a shop with empty
 * shelves must not have a doorman.
 */
const loadPrice = async () => {
  const api = await load()
  if (!api) return false
  try {
    const offerings = await api.getOfferings()
    const found = theUnlockIn(offerings)
    if (found) {
      pkg = found
      set({ price: found.product?.priceString || null, detail: null })
      return true
    }
    const products = await api.getProducts([PRODUCT_ID])
    if (products?.[0]) {
      set({ price: products[0].priceString || null, detail: null })
      return true
    }
    /*
     * WHICH SIDE IS EMPTY, because the two are fixed in different places.
     *
     * A count of nought means RevenueCat has no offering configured — that is
     * its dashboard. A count above nought with nothing sellable in it means
     * the offering exists but its packages point at products the store will
     * not sell, which is App Store Connect or the Play Console. Either way
     * getProducts has just asked the store for the item by name and been told
     * no, so the number and the id together say where to go.
     */
    const count = Object.keys(offerings?.all || {}).length
    const detail = `RevenueCat returned ${count} offering${count === 1 ? '' : 's'}; the store has no ${PRODUCT_ID}.`
    set({ detail })
    logDebug(`purchases: ${detail}`)
    return false
  } catch (err) {
    /* Could not find out. Treat it as nothing to sell, which unlocks rather
       than locks — the same direction every other unknown goes here. The
       store's own sentence is kept as it came: it names the billing fault,
       and any rewording of it here would be a guess laid over a fact. */
    const detail = String(err?.message || err)
    set({ detail })
    logDebug(`purchases: no price (${detail})`)
    return false
  }
}

/*
 * WHAT THIS PERSON OWNS, ASKED FRESH, RIGHT BEFORE ANYBODY IS CHARGED.
 *
 * "I don't want to charge people to use other devices if they already
 * purchased." Until now the only thing between a customer and a second
 * charge was the screen hiding Buy, and the screen goes by the SDK's saved
 * copy of the answer (up to five minutes old), on whatever id the phone is
 * answering as — nobody at all, when a sign-in's link failed on a bad
 * signal. RevenueCat does not refuse a purchase because the entitlement is
 * already held, and Apple only refuses the same Apple ID.
 *
 * So this asks again: linked to the account first, when one is signed in on
 * the phone and the SDK is not on it, then the store's answer with the saved
 * copy thrown away. Null when that could not be found out, and then nothing
 * is sold. It stops a sale and nothing else: the gate on the app never reads
 * this, so an outage still locks nobody out.
 */
const ownedNow = async (api, who) => {
  try {
    if (who && (await api.getAppUserID?.()) !== who) {
      const linked = await linkTo(api, who)
      if (!linked) return null
      if (entitled(linked)) return linked
    }
    return await freshInfo(api)
  } catch (err) {
    logDebug(`purchases: could not check before buying (${err?.message || err})`)
    return null
  }
}

/* RevenueCat's error codes (PURCHASES_ERROR_CODE), as the strings they arrive as. */
const PAYMENT_PENDING = '20' // PAYMENT_PENDING_ERROR
const ALREADY_BOUGHT = '6' // PRODUCT_ALREADY_PURCHASED_ERROR

/**
 * Buy it.
 *
 * Answers `{ ok, cancelled, message }` rather than throwing, because every
 * caller wants the same three outcomes and a cancel is not an error — somebody
 * closing Apple's sheet has done nothing wrong and must not be shown a fault.
 */
export const buyUnlock = async () => {
  /* Developer → View as a new customer shows the paywall to look at. Its
     Buy is real everywhere else, so it takes nothing here. */
  if (posing) return { ok: false, cancelled: false, message: 'Buying is off while you’re viewing as a new customer.' }
  /* And never a second payment behind one the store has not finished with. */
  if (state.held) return { ok: false, cancelled: false, held: true, message: state.held }
  const api = await load()
  if (!api) return { ok: false, cancelled: false, message: 'This build cannot take payments.' }
  const who = await restoreSession().catch(() => null)
  try {
    const now = await ownedNow(api, who)
    if (!now) return { ok: false, cancelled: false, message: 'Couldn’t check your purchase just now. Try again in a moment.' }
    /* The link just made can find this phone's own purchase stuck short of the account (linkTo). */
    if (state.held && !entitled(now)) return { ok: false, cancelled: false, held: true, message: state.held }
    /* Already theirs: unlocked the way a purchase is, nothing charged, and said so. */
    const owned = entitled(now)
    if (owned) logDebug('purchases: already bought, so nothing was charged')
    /*
     * NOBODY SIGNED IN, AND THE SDK STILL ON SOMEBODY'S ACCOUNT: a sign-out
     * whose logOut failed, or an older way off the price page that never
     * made one. Sold there, the purchase went to an account nobody here is
     * signed in to, the sign-in screen said "now make your account", and the
     * account made got nothing. So off it first, and the sale is the phone's
     * own, which the account made next carries (linkNewAccount).
     */
    if (!owned && !who && !(await nameless(api))) {
      try {
        await api.logOut()
        logDebug('purchases: off an account nobody here is signed in to, before selling')
      } catch (err) {
        logDebug(`purchases: could not get off the last account before selling (${err?.message || err})`)
        return { ok: false, cancelled: false, message: 'Couldn’t check your purchase just now. Try again in a moment.' }
      }
    }
    const bought = owned ? { customerInfo: now, already: true } : await fromStore(api)
    /* The store finished but the reply did not carry the unlock: asked once
       more, fresh, before anything is said about it. */
    const info = entitled(bought?.customerInfo) ? bought.customerInfo : (await freshInfo(api)) || bought?.customerInfo
    const yes = entitled(info)
    /* Before `unlocked`, which closes the paywall: the sign-in screen behind
       it reads these to know which way to open. Only a sale made just now
       opens it on "you've paid": one found already made took no money. */
    set({ boughtAlone: yes && !bought?.already && !who, onlyHere: yes && (await aloneHere(api, info)) })
    await remember(yes)
    set({ unlocked: yes })
    /*
     * AND THE SIMULATION ENDS HERE.
     *
     * "After I did the test purchase, it just takes me back to the demo
     * screen." It did — the paywall is reachable from inside the demo, the
     * purchase went through, and the sheet closed onto a simulated AM4. The
     * one moment somebody has definitely decided they want the real thing is
     * the moment the app was still pretending.
     *
     * Turning it off HERE rather than on the screen that opened the paywall,
     * because there are several ways to that paywall and this is the only
     * place that knows the money actually moved. Leaving the demo tears down
     * the mock and brings up the real link — see App.js, where the effect
     * depends on `demo` as well as `auth` for exactly this reason.
     *
     * Only on the way out of a demo. Buying from the live app has no demo to
     * leave, and calling setDemo(false) there would be a write and a redraw
     * for nothing.
     */
    if (yes && isDemo()) {
      setDemo(false)
      logDebug('purchases: bought, so the demo is over')
    }
    /* Open the relay now rather than when the webhook lands. */
    if (yes) claimRelay()
    if (yes) return { ok: true, cancelled: false, message: bought?.already ? ALREADY_HAD : null }
    /*
     * Bought already, and RevenueCat has not got it here. Signed in, Restore
     * brings it to this account. With nobody signed in it would move it to
     * this phone's nameless id — off the account it is on, and off every
     * other phone and computer signed in to it — so signing in is the way.
     */
    if (bought?.already) {
      return {
        ok: false,
        cancelled: false,
        message: who
          ? `This ${storeAccount()} has bought it already. Tap Restore a purchase to bring it back.`
          : `This ${storeAccount()} has bought it already. Sign in with the account you bought it with, and it unlocks here too. ${NO_ACCOUNT_THERE}`
      }
    }
    /* The money may have moved, so Buy stays off: a second tap is how a
       store that has not confirmed becomes a second charge. */
    set({ held: 'The store finished, but hasn’t confirmed the full version yet. Please don’t pay again: tap Restore a purchase in a minute.' })
    return { ok: false, cancelled: false, held: true, message: state.held }
  } catch (err) {
    if (err?.userCancelled) return { ok: false, cancelled: true, message: null }
    logDebug(`purchases: buy failed (${err?.message || err})`)
    /*
     * WAITING, NOT FAILED. Ask to Buy, a bank that wants its own approval,
     * cash at a shop on Google Play: the store has the order and will finish
     * it later, and the listener unlocks the app when it does. Said as red
     * RevenueCat words with Buy live again, it read as "didn't work, pay
     * some other way" — so Buy stays off for the rest of this run.
     */
    if (String(err?.code) === PAYMENT_PENDING) {
      set({ held: PENDING })
      return { ok: false, cancelled: false, held: true, pending: true, message: PENDING }
    }
    return { ok: false, cancelled: false, message: err?.message || 'The purchase did not go through.' }
  }
}

/* The store's own sheet. "Bought already" from it (Google's ITEM_ALREADY_OWNED)
   is not a fault: whatever RevenueCat has now is the answer. */
const fromStore = async (api) => {
  try {
    return pkg ? await api.purchasePackage(pkg) : await api.purchaseProduct(PRODUCT_ID)
  } catch (err) {
    if (String(err?.code) !== ALREADY_BOUGHT) throw err
    logDebug('purchases: the store says this account bought it already')
    return { customerInfo: await freshInfo(api), already: true }
  }
}

/**
 * Give a purchase back.
 *
 * Apple requires this and will reject the app without it, but it earns its
 * place anyway: a new phone, a reinstall, or a second handset on the same
 * Apple ID all arrive here, and none of them should be asked to pay twice.
 */
export const restorePurchase = async () => {
  const api = await load()
  if (!api) return { ok: false, message: 'This build cannot take payments.' }
  try {
    /* Fresh: when the store has nothing new to send, Restore answers with
       RevenueCat's saved copy, from before a purchase made on the website or
       another phone a minute ago. */
    await api.invalidateCustomerInfoCache?.()
    let info = await api.restorePurchases()
    let yes = entitled(info)
    /* And, signed in, the server's catch-up that a sign-in runs (a grant, or
       the waiting list), before anybody is told there is nothing. */
    const who = await restoreSession().catch(() => null)
    if (!yes && who && (await claimRelay())) {
      const again = await freshInfo(api)
      if (entitled(again)) {
        info = again
        yes = true
      }
    }
    set({ onlyHere: await aloneHere(api, info) })
    /* A purchase still on its way to this account keeps the gate open:
       Restore not finding it is not a no from somebody this phone saw pay. */
    const open = yes || state.stuck
    await remember(open)
    set({ unlocked: open })
    if (yes) {
      /* Brought across: nothing is held for it, and nothing left to carry —
         unless nobody is signed in and it is on an account made here, which
         the next sign-in still carries it from (madeHere). */
      const wasStuck = state.stuck
      await arrived()
      const current = await currentId(api)
      if (who) {
        await noteMade(null)
        set({ madeHere: false })
      } else if (wasStuck && current && !(await nameless(api))) {
        await noteMade(current)
        set({ madeHere: true })
      }
      claimRelay()
      return { ok: true, message: null }
    }
    /* Still not there, after the app's own tries: past what the phone can
       do, so it says who can, and the hold stays. */
    if (state.stuck) return { ok: false, message: STILL_STUCK }
    /*
     * "No previous purchase was found on this account" read as "you have not
     * paid", with Buy right above it, to somebody who had — on the website,
     * or on another phone. What was asked is this Apple ID or Google account,
     * so that is what is said, with the way that works for the rest. Said
     * without naming the website: a phone app may not point anybody at
     * another way to pay (Apple 3.1.3, Google Play's payments policy).
     */
    return {
      ok: false,
      message: who
        ? `No purchase was found for this ${storeAccount()}, or on the account you’re signed in to. If you bought it with a different email, sign in with that one instead.`
        : `No purchase was found for this ${storeAccount()}. If you bought it on another device, sign in with the account you used there. ${NO_ACCOUNT_THERE}`
    }
  } catch (err) {
    logDebug(`purchases: restore failed (${err?.message || err})`)
    return { ok: false, message: err?.message || 'Could not reach the store.' }
  }
}

/**
 * Where the full version on this account came from, as RevenueCat names the
 * store: 'APP_STORE', 'PLAY_STORE', 'RC_BILLING' (the website), 'PROMOTIONAL'
 * (given). Null when there is none, or it could not be asked.
 *
 * For the Delete account sheet, which promised that the purchase "stays with
 * your Apple ID" to everybody. Only a store purchase does: deleting the
 * account deletes the customer that holds a website purchase or a gift, and
 * no Restore brings either back.
 */
export const unlockedFrom = async () => {
  const api = await load()
  try {
    return (await api?.getCustomerInfo())?.entitlements?.active?.[ENTITLEMENT]?.store || null
  } catch {
    return null
  }
}

/**
 * Whether a real rig may be driven.
 *
 * The demo never asks this. Note what counts as yes: paid, OR purchasing is
 * unavailable for any reason at all. See the rule at the top.
 */
export const mayConnect = () => mayDrive(state)

/**
 * WHETHER TO SHOW THE WAY IN — which is NOT the same question as whether
 * money can change hands this second, and treating them as one was a bad
 * mistake.
 *
 * Every unlock route was gated on `available`, on the reasoning that a button
 * which cannot take money is worse than no button. The consequence is worse
 * than either: `available` is false whenever the store is not set up yet, or
 * unreachable, or still propagating permissions — and in all of those the
 * offer VANISHED COMPLETELY. An absent button is indistinguishable from a
 * feature that does not exist.
 *
 *   "I'm building this app and I don't know where to unlock it."
 *
 * That is the proof. He wrote it, he knew it was there, and he could not find
 * it, because on his handset the store was not ready and so the app had
 * silently erased every trace of the thing it is selling.
 *
 * So: the offer shows whenever somebody is in the demo and has not paid. What
 * `available` decides now is what the PAYWALL says when they get there —
 * a price and a working button, or an honest line about why not. A route to
 * an explanation beats no route at all, every time.
 */
export const shouldOffer = ({ demo }) => Boolean(demo) && !shown.unlocked

export const purchaseState = () => shown

const subscribe = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

/** The same, for a screen that should repaint when it changes. */
export const usePurchase = () => useSyncExternalStore(subscribe, purchaseState, purchaseState)

/** Test seam: put the module back as it was between cases. */
export const __reset = () => {
  Purchases = null
  pkg = null
  state = { available: false, unlocked: false, checking: true, price: null, why: null, onlyHere: false, boughtAlone: false, held: null, madeHere: false, stuck: false }
  openFor = null
  posing = false
  shown = state
}
