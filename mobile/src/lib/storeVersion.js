import { useSyncExternalStore } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'

import { logDebug } from './debugLog'
import { notForever } from './notForever'
import { PLAY_APP_LINK, STORE_VERSIONS_URL, askDue, cardDue, newestFrom, storeNote } from './store-rule'

/**
 * THE STORE VERSION ON THIS PHONE AND THE NEWEST ONE, kept up to date quietly.
 *
 * The rule is lib/store-rule.js; this is the part that needs a phone: what is
 * installed, what the website says, and the phone's own storage for both the
 * last answer and which store version the card has already been shown for.
 *
 * Fails silent everywhere. A phone with no signal, a website that is slow, a
 * build that cannot say its own version: each one is no note, and the app
 * carries on exactly as before.
 */

const KEY = 'fractal.storeVersions'
const SEEN_KEY = 'fractal.storeCard.seen'
const ASK_MS = 8000
const FIRST_ASK_MS = 10000

/*
 * THE VERSION BUILT INTO THIS COPY, read off the copy itself.
 *
 * expo-constants, as installed here, no longer has `nativeAppVersion`, and
 * `Constants.expoConfig.version` is the UPDATE's version once an update is
 * running — the newest number, which is exactly the wrong one. What it does
 * keep is the app config the build was made with, inside the build: the
 * native module's own `manifest` (an object on iPhone, a string of JSON on
 * Android), which an update never touches. Its `version` is the version the
 * store has for this copy. Read through `requireOptionalNativeModule`, the
 * same door lib/bluetooth.js uses, so nothing new is installed for it.
 */
export function installedStoreVersion() {
  try {
    const native = requireOptionalNativeModule('ExponentConstants')
    let config = native?.manifest
    if (typeof config === 'string') config = JSON.parse(config)
    const v = config?.version
    return typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? v : null
  } catch {
    return null
  }
}

let state = {
  /** The newest store versions the website last gave: { ios, android } or null. */
  newest: null,
  /** Which store version the card has been shown for, or null. */
  seenFor: null,
  /** The phone's storage has been read. Until then, no card: one that came back the next launch would not be "once". */
  loaded: false
}
let lastAskedAt = 0
/* One object per change, so a screen reading it redraws only when something moved. */
let view = null
const watchers = new Set()
const set = (patch) => {
  state = { ...state, ...patch }
  view = null
  for (const fn of watchers) fn()
}

const installed = installedStoreVersion()
const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null

const read = () => {
  if (!view) {
    const note = storeNote({ platform, installed, newest: newestFrom(state.newest, platform) })
    view = { note, card: state.loaded && cardDue(note, state.seenFor) }
  }
  return view
}

async function restore() {
  try {
    const [kept, seen] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(SEEN_KEY)])
    const parsed = kept ? JSON.parse(kept) : null
    lastAskedAt = Number(parsed?.at) || 0
    set({ newest: parsed?.newest || null, seenFor: seen || null, loaded: true })
  } catch {
    set({ loaded: true })
  }
}

/** Ask the website, at most once a day. Whatever happens, the next ask is a day away. */
async function askIfDue() {
  if (!platform || !installed || !askDue(lastAskedAt, Date.now())) return
  lastAskedAt = Date.now()
  let newest = state.newest
  try {
    const res = await notForever(STORE_VERSIONS_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' }, ASK_MS)
    if (res.ok) {
      const file = await res.json()
      newest = { ios: newestFrom(file, 'ios'), android: newestFrom(file, 'android') }
    }
  } catch {
    /* No signal, or the website was slow: the last answer stands, and the next ask is tomorrow. */
  }
  set({ newest })
  AsyncStorage.setItem(KEY, JSON.stringify({ at: lastAskedAt, newest })).catch(() => {})
  const note = read().note
  if (note) logDebug('store', `this copy is ${installed}; ${note.store} has ${note.newest}`)
}

/** Start: read what was kept, ask a little after launch, and again on coming back after a day. Returns the stop. */
export function watchStoreVersion() {
  let alive = true
  const ready = restore()
  const first = setTimeout(() => {
    ready.then(() => alive && askIfDue())
  }, FIRST_ASK_MS)
  const sub = AppState.addEventListener?.('change', (status) => {
    if (status === 'active') ready.then(() => alive && askIfDue())
  })
  return () => {
    alive = false
    clearTimeout(first)
    sub?.remove?.()
  }
}

/** The card has been shown for this store version: never again for it. */
export function markCardSeen(version) {
  if (!version || state.seenFor === version) return
  set({ seenFor: version })
  AsyncStorage.setItem(SEEN_KEY, version).catch(() => {})
}

/** To the app's page in the store. On Android, Google Play's own link first, the web page if nothing answers it. */
export async function openStore(note) {
  if (!note) return
  if (platform === 'android') {
    try {
      await Linking.openURL(PLAY_APP_LINK)
      return
    } catch {
      /* No Play Store on this phone: the web page, below. */
    }
  }
  Linking.openURL(note.page).catch(() => {})
}

const subscribe = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

/** { note, card }: the note while this copy is older than the store's, and whether the card is still to be shown. */
export const useStoreNote = () => useSyncExternalStore(subscribe, read, read)
