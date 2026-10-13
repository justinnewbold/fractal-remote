import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

import { logDebug } from './debugLog'
import { shouldApplyNow } from './update-rule'
import { joiningNow, lastHeardAt, linkState, linkVia, subscribeLink } from './link'
import { bluetoothPhase, subscribeBluetooth } from './bluetooth'
import { bluetoothJoining } from './bleLink'

/**
 * Whether this app is running the newest code, and a way to make it so.
 *
 * "I have not yet successfully had a single over-the-air update work
 * correctly. They never come through, so I keep refreshing the android app,
 * closing it, force closing it, reopening it over and over again."
 *
 * THE UPDATES WERE ARRIVING. What was missing was any way to know it, and one
 * detail of how expo-updates works that makes the app look stuck when it is
 * merely being careful:
 *
 *   app.json sets `fallbackToCacheTimeout: 0`, which means the app NEVER waits
 *   for a download at launch. It starts instantly on the bundle it already
 *   has, fetches any new one in the background, and runs it THE NEXT TIME the
 *   app is opened.
 *
 * So the first launch downloads and the second launch shows it. Somebody
 * force-closing and reopening once, seeing the same version, and concluding
 * nothing happened is reading the situation exactly as the app presented it.
 * They were one restart short, with nothing on screen to say so.
 *
 * That default is right for a stage — an app that pauses on a dark stage to
 * download something is a worse app — so the fix is not to change it. The fix
 * is to say what is going on, and to offer the restart rather than wait for it
 * to happen by accident.
 *
 * Nothing here is allowed to throw. expo-updates is not available in every
 * context it can be imported from — a development build, an emulator, a bundle
 * running with updates switched off — and a Setup screen that crashes because
 * it asked about updates would be a poor trade for the answer.
 */

let state = {
  /** 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'off' */
  phase: 'idle',
  /** What went wrong, in words, or null. */
  error: null,
  /** Which bundle is running: 'embedded' (as built) or 'update'. */
  source: null,
  /** When the running bundle was published, if it was. */
  publishedAt: null,
  /** The ready banner was put away with its ✕ — until the next launch. */
  dismissed: false
}

const watchers = new Set()
const announce = () => {
  for (const fn of watchers) fn()
}
const set = (next) => {
  state = { ...state, ...next }
  announce()
}

let Updates = null

/** Load it once, and never let its absence take a screen down. */
const load = async () => {
  if (Updates) return Updates
  try {
    const mod = await import('expo-updates')
    Updates = mod?.default && mod.default.checkForUpdateAsync ? mod.default : mod
  } catch (err) {
    Updates = null
    logDebug(`updates: no module (${err?.message || err})`)
  }
  return Updates
}

/**
 * What this app is running, read once at startup.
 *
 * `isEmbeddedLaunch` is the honest answer to "did an update ever land": true
 * means this is the bundle that came with the build, false means an update is
 * running. It is the one fact that settles the question without anybody
 * comparing version numbers off two screens.
 */
export const describeRunning = async () => {
  const api = await load()
  if (!api) return set({ source: null, phase: 'off' })
  try {
    set({
      source: api.isEmbeddedLaunch ? 'embedded' : 'update',
      publishedAt: api.createdAt ? new Date(api.createdAt).getTime() : null
    })
  } catch (err) {
    logDebug(`updates: cannot describe (${err?.message || err})`)
  }
}

/**
 * Ask now, download now, and say so at every step.
 *
 * Answers rather than throws, because every caller wants the same thing on
 * screen and an exception here is not a fault a person can act on.
 */
export const checkNow = async () => {
  const api = await load()
  if (!api) {
    set({ phase: 'off', error: 'This build cannot take updates.' })
    return 'off'
  }
  set({ phase: 'checking', error: null })
  try {
    const found = await api.checkForUpdateAsync()
    if (!found?.isAvailable) {
      set({ phase: 'current' })
      return 'current'
    }
    set({ phase: 'downloading' })
    await api.fetchUpdateAsync()
    set({ phase: 'ready' })
    return 'ready'
  } catch (err) {
    /*
     * The ordinary case here is not a bug: a development build, or a bundle
     * whose fingerprint has no update published for it, both land in this
     * branch. Say what happened and leave the app alone.
     */
    const message = String(err?.message || err)
    logDebug(`updates: check failed (${message})`)
    set({ phase: 'idle', error: message })
    return 'error'
  }
}

/** Restart into the update that has been downloaded. */
export const applyNow = async () => {
  const api = await load()
  if (!api) return false
  try {
    await api.reloadAsync()
    return true
  } catch (err) {
    logDebug(`updates: reload failed (${err?.message || err})`)
    set({ error: 'Could not restart. Close the app fully and open it again.' })
    return false
  }
}

/** Put the ready banner away. The Updates row in Settings still offers the restart. */
export const dismissReady = () => set({ dismissed: true })

/*
 * ASKED WITHOUT BEING ASKED, AND TAKEN ONLY WHEN NOBODY CAN BE PLAYING.
 *
 * "On the web app it actually will pop up a banner at the top of the screen
 * that says update available. Is it possible to do that once the phone
 * actually downloads an update so that they could just click that to restart
 * it?" — and, the answer before, "I don't want it to pause for a few seconds
 * every time they open the app."
 *
 * So nothing waits. A few seconds after the app is up it asks in the
 * background, and again whenever it comes back from the background after a
 * while — the case of somebody who never closes an app, who would otherwise
 * carry an old version for as long as the phone keeps it alive. A download
 * that lands turns the phase to 'ready', and the banner (UpdateReady) offers
 * the restart.
 *
 * AND, SINCE 13 OCTOBER 2026, IT ALSO SWITCHES BY ITSELF — at one moment
 * only. The offer alone left Justin's own phone on 1.87.12 while 1.87.21 was
 * out. The rule is lib/update-rule.js's shouldApplyNow, and this is the one
 * place it is asked: the moment the app comes back on screen ('active'),
 * after two hours away, with the phone on no rig now, and on none when it
 * went away unless that was a night (eight hours) ago. (An iPhone comes back
 * from a night saying 'connected' if that is what it said when it froze; with
 * nothing heard from the computer all night, that word is not a rig — the
 * rule says why.) Never on a timer, never while the app is on screen. Every answer goes in the log with
 * its reason, so a report says why it did or did not switch. After a switch
 * the app starts again from the top, and its first ask, five seconds in, is
 * what brings it on to anything newer that came out in between.
 *
 * The sound never depends on the app: the unit plays on its own, and the
 * phone only tells it which preset and scene to be on. That is why a switch
 * outside a song is safe, and the rule is what keeps it outside one.
 */
const FIRST_ASK_MS = 5000
const ASK_AGAIN_MS = 30 * 60 * 1000
let lastAsked = 0

const askQuietly = () => {
  if (['checking', 'downloading', 'ready', 'off'].includes(state.phase)) return
  lastAsked = Date.now()
  checkNow()
    .then((got) => {
      if (got === 'ready') logDebug('updates', 'a new version has downloaded; it goes in when the app is next opened after two hours away from the rig, or with Restart now')
    })
    .catch(() => {})
}

/**
 * The rig in the words the rule reads (see lib/update-rule.js). Read, never
 * changed. `via` and `heardAgoMs` are for the 'connected' an iPhone wakes up
 * with: the word from before the freeze, with nothing heard since.
 */
const rigNow = () => ({
  link: linkState().link,
  joining: joiningNow() || bluetoothJoining(),
  bluetooth: bluetoothPhase(),
  via: linkVia(),
  heardAgoMs: Date.now() - lastHeardAt()
})

/*
 * WHEN THE APP LEFT THE SCREEN, AND THE RIG AS IT WAS THEN. Written at the
 * first change away from 'active' (an iPhone passes through 'inactive' on
 * its way to the background, and the moment it left is the first of them).
 * And kept up to date while it is away: a watch tap reaches the rig with the
 * phone locked, so a connection made while away counts as one it went away
 * with — and `at` moves to it, because the eight hours after which the rule
 * lets that go count from the last time the phone was on the rig, not from
 * when it went away. A phone picked up just after a watch tap mid-song is
 * still on the rig, however long ago it was put down.
 *
 * Both are wiped the moment it is back, whatever the rule said: a time away
 * is one trip off the screen. Left standing, the next flicker on screen — an
 * iPhone's Control Centre or a notification pulled down, 'inactive' and
 * back a second later — would be read as the whole of the last trip away.
 */
let leftAt = 0
let leftWith = null

const goingAway = () => {
  leftAt = Date.now()
  leftWith = { ...rigNow(), at: leftAt }
}

const heardWhileAway = () => {
  if (!leftAt || !leftWith) return
  const rig = rigNow()
  if (rig.link === 'connected' || rig.bluetooth === 'connected') leftWith = { ...leftWith, link: 'connected', at: Date.now() }
}

/**
 * The one way the app switches to a downloaded version by itself: called at
 * 'active', with how long it was away and the rig as it was. True when it is
 * switching.
 */
function switchIfDue(awayMs, left) {
  const leftAgoMs = left ? Date.now() - left.at : 0
  const decision = shouldApplyNow({ phase: state.phase, back: true, awayMs, left, leftAgoMs, now: rigNow() })
  /* Only with a version waiting: a line on every unlock that says nothing has downloaded is noise. */
  if (state.phase === 'ready') {
    logDebug('updates', decision.yes ? `switching to the new version: ${decision.why}` : `not switching to the new version yet: ${decision.why}`)
  }
  if (!decision.yes) return false
  applyNow()
  return true
}

/** Start asking. Returns the stop, for the effect that calls it. */
export function watchForUpdates() {
  const first = setTimeout(askQuietly, FIRST_ASK_MS)
  const sub = AppState.addEventListener?.('change', (status) => {
    if (status !== 'active') {
      if (!leftAt) goingAway()
      return
    }
    const awayMs = leftAt ? Date.now() - leftAt : 0
    const left = leftWith
    leftAt = 0
    leftWith = null
    if (awayMs > 0 && switchIfDue(awayMs, left)) return
    if (Date.now() - lastAsked > ASK_AGAIN_MS) askQuietly()
  })
  /* Started in the background (a watch tap can wake the app with the phone locked): away from the start. */
  if (AppState.currentState && AppState.currentState !== 'active' && !leftAt) goingAway()
  const offLink = subscribeLink(heardWhileAway)
  const offBluetooth = subscribeBluetooth(heardWhileAway)
  return () => {
    clearTimeout(first)
    sub?.remove?.()
    offLink?.()
    offBluetooth?.()
  }
}

export const updateState = () => state

const subscribe = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

export const useUpdates = () => useSyncExternalStore(subscribe, updateState, updateState)
