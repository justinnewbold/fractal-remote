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
 * Still drawn on the Developer pages only, his account's.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Linking } from 'react-native'
import { logDebug } from './debugLog'
import { randomBytes, tone3000 } from './tone3000'
import { movingStore, sureRandom } from './tone3000Keep'
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

/** One client for the life of the app. */
export const t3k = tone3000({
  fetch: (...args) => globalThis.fetch(...args),
  store: movingStore({ secure, plain, log: said }),
  open,
  random: sureRandom(Crypto ? (bytes) => Crypto.getRandomValues(bytes) : null, randomBytes, said)
})

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
