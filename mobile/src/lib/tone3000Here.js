/*
 * TONE3000 ON THIS DEVICE: lib/tone3000's client, handed the phone's own
 * storage, network, random numbers and a way to show TONE3000's page.
 *
 * THREE THINGS HERE ARE BETTER ON A COPY BUILT WITH THE NATIVE PIECES
 * (lib/tone3000Parts, which says what they are and why they wait for a
 * build), and exactly as they were on every copy built before:
 *
 *   - THE PAGE. With the web view, TONE3000's page comes up inside the app
 *     (components/Tone3000Page) and its return is caught there. Without it,
 *     the page opens in the device's browser and TONE3000 sends the device
 *     back by the app's own link. The link is listened for either way: the
 *     browser is still one tap away on the card, for a sign-in that will
 *     not work inside the app.
 *   - THE PASS. With the secure storage, it is kept in the Keychain or the
 *     Android Keystore, readable on this device only (an iPhone does not
 *     carry it to a backup or a new phone; an Android backup may carry the
 *     locked file, which no other phone can open, and the app then reads
 *     nothing kept and asks for a sign-in). A pass already in the app's
 *     ordinary storage moves there the first time it is read
 *     (lib/tone3000Keep). Without it, the ordinary storage, where the app's
 *     own sign-in is kept.
 *   - THE ONE-TIME WORD. With the secure random numbers, from those.
 *     Without them, as before (lib/tone3000 `randomBytes`).
 *
 * Signing out on purpose is `signOutHere` (lib/tone3000Keep
 * `signOutKeeper`): the TONE3000 row in Settings and every way the app's
 * own sign-in is ended on purpose. Whose sign-in is kept here is
 * `tone3000Who`, for that row.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Linking } from 'react-native'
import { logDebug } from './debugLog'
import { randomBytes, T3K_TOKENS_KEY, tone3000 } from './tone3000'
import { movingStore, signOutKeeper, sureRandom } from './tone3000Keep'
import { Crypto, SecureStore, WebView } from './tone3000Parts'

const said = (line) => logDebug('tone3000', line)

const plain = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key)
}

/* On this device only. An iPhone has the word for it. Android has none and needs none: what it keeps is locked with a Keystore key that never leaves the phone it was made on. */
const KEPT = SecureStore && SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY != null ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } : {}
const secure = SecureStore
  ? {
      get: (key) => SecureStore.getItemAsync(key, KEPT),
      set: (key, value) => SecureStore.setItemAsync(key, value, KEPT),
      remove: (key) => SecureStore.deleteItemAsync(key, KEPT)
    }
  : null

/** Whether TONE3000's page can come up inside the app: the web view is in this copy. */
export const pageInApp = () => !!WebView

/*
 * Whoever is drawing the page inside the app (the Developer card, while it
 * is up), and whether the start in hand asked for the browser instead.
 */
let host = null
let outside = false

/**
 * Be the one who shows TONE3000's page inside the app: `show(url)` is
 * called for each start. Returns the way to stop being it.
 */
export function hostPage(show) {
  host = show
  return () => {
    if (host === show) host = null
  }
}

/** Where a start opens TONE3000's page: inside the app when it can be, else the device's browser. */
const open = (url) => {
  if (WebView && host && !outside) {
    host(url)
    return undefined
  }
  return Linking.openURL(url)
}

/* Where the pass is kept: the secure storage where this copy has it. */
const kept = movingStore({ secure, plain, log: said })

/** One client for the life of the app. */
export const t3k = tone3000({
  fetch: (...args) => globalThis.fetch(...args),
  store: kept,
  open,
  random: sureRandom(Crypto ? (bytes) => Crypto.getRandomValues(bytes) : null, randomBytes, said)
})

/* Signing out on purpose, and whether TONE3000's page inside the app opens as a private one. */
const leaving = signOutKeeper({ client: t3k, plain, log: said })

/** Whether TONE3000's page inside the app opens as a private one: from the first sign-out on this device. */
export const pagePrivate = () => leaving.pagePrivate()

/** TONE3000's page is opening on this device: a sign-out from now on has its remembered sign-in to forget. */
export const pageShown = () => leaving.pageShown()

/* Whose TONE3000 sign-in is kept, as TONE3000 named it, and which sign-in that was (its renewing word): asked once for each sign-in while the app runs. */
let whoName = null
let whoFor = null

/**
 * Sign out of TONE3000 on this device, on purpose: the pass goes, and the
 * page inside the app opens private from now on. Throws where the device
 * would not let go of the pass.
 */
export async function signOutHere() {
  whoName = null
  whoFor = null
  await leaving.signOut()
  said('signed out of TONE3000 on this device')
}

/**
 * The same, at every way the app's own sign-in is ended on purpose (App.js:
 * Sign out, Delete account, the purchase page's Try the Demo, Back and
 * Delete account, and the way to the sign-in form), so the next person on
 * the device is not signed in to the last one's TONE3000. Never throws: a
 * pass that will not let go is written to the log, and the TONE3000 row in
 * Settings still offers the sign-out.
 */
export function forgetTone3000() {
  return signOutHere().catch((err) => said(`TONE3000’s sign-in was not removed at the app’s sign-out: ${err?.message || err}`))
}

/**
 * Whether a TONE3000 sign-in is kept on this device, and whose: `{ signedIn,
 * name }`, the name TONE3000's own (`@name`) where it could be asked, else
 * null. Asks TONE3000 only when a sign-in is kept and its name is not known
 * yet; a sign-in TONE3000 no longer takes is gone by the time this answers.
 */
export async function tone3000Who() {
  let pass = null
  try {
    const raw = await kept.get(T3K_TOKENS_KEY)
    pass = raw ? JSON.parse(raw) : null
  } catch {
    pass = null
  }
  if (!pass?.access) return { signedIn: false, name: null }
  /* A sign-in made since the name was asked (signed out on the Developer page and in again, say) is asked about afresh. */
  const which = pass.refresh || pass.access
  if (whoFor !== which) {
    whoName = null
    try {
      const me = await t3k.me()
      whoName = typeof me?.username === 'string' && me.username ? me.username : null
      whoFor = which
    } catch (err) {
      /* TONE3000 no longer takes it: lib/tone3000 has let it go by now, or kept it for another try. */
      if (err?.status === 401) return { signedIn: await t3k.signedIn().catch(() => false), name: null }
    }
  }
  return { signedIn: true, name: whoName }
}

/** A start whose page opens in the device's browser, whatever this copy has. `how` is `start`'s. */
export async function startOutside(how) {
  outside = true
  try {
    return await t3k.start(how)
  } finally {
    outside = false
  }
}

/**
 * Hear TONE3000 send the phone back: every link that reopens the app while
 * `heard` is listening, and the one that started the app if it was closed
 * while the browser was in front. `heard` gets the link; lib/tone3000
 * `finish` says whether it is TONE3000's (the Siri links are lib/siri's,
 * which takes no notice of this one). Returns the way to stop.
 */
export function onTone3000Return(heard) {
  let alive = true
  let sub = null
  try {
    sub = Linking.addEventListener('url', (event) => {
      if (alive && event?.url) heard(event.url)
    })
  } catch {
    sub = null
  }
  Promise.resolve()
    .then(() => Linking.getInitialURL())
    .then((url) => {
      if (alive && url) heard(url)
    })
    .catch(() => {})
  return () => {
    alive = false
    sub?.remove?.()
  }
}
