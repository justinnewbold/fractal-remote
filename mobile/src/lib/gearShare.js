import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { NOTE_AFTER_MS, RETRY_MS, SETTLE_MS, createGearClock, createGearSharer, gearKey, gearRecord, noteDue, noteFacts, sendDelay, sharing } from './gear-share-rules'
import { DEFAULT_PROJECT } from './project'
import { APP_VERSION } from './version'
import { logDebug } from './debugLog'
import { notForever } from './notForever'
import { getState as rigState, subscribeRig, unitReadSince } from './rig'
import { adapterName, bluetoothFacts, bluetoothPhase, bluetoothSettings, cableNow, subscribeBluetooth, unitName } from './bluetooth'
import { linkState, linkVia, subscribeLink } from './link'
import { deviceFacts } from './thisDevice'
import { onTapTime } from './tapTimes'

/**
 * WHAT WORKS, ON THE PHONE: the question's answer kept on this device, and
 * the short notes sent when somebody said Yes. The rules (what a note is,
 * when it may go, what the card says) are lib/gear-share-rules.js; this is
 * only what is the phone's own: AsyncStorage, the database, and listening to
 * the unit, the link and Bluetooth.
 *
 * NOT LINKED TO ANYBODY. The note goes through a database client of its own,
 * made with the public key and no session at all, so it cannot carry the
 * account signed in on the phone even by accident: the row has no account
 * column, and the request has no account behind it either. No install number
 * is made or kept; the only thing stored is which combinations went and when,
 * on this device.
 *
 * Nothing new is installed for it: AsyncStorage, supabase-js and React
 * Native's own Platform and AppState were already in the app, so it rides an
 * update and not a store build.
 */

let client = null
async function insert(record) {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      /* Twelve seconds and cut off (lib/notForever): a send that never answers must not hold every note after it. */
      global: { fetch: notForever }
    })
  }
  /* Insert only, and nothing read back: the table lets nobody read it with this key. */
  return client.from('gear_reports').insert(record)
}

const sharer = createGearSharer({
  storage: AsyncStorage,
  insert,
  log: (what, detail) => logDebug('app', what, detail)
})

/* ------------------------------------------------------------------------ */
/* The answer, for the card and the Settings row                             */
/* ------------------------------------------------------------------------ */

/* undefined until storage answers, then 'yes', 'no' or null (never asked). */
let answer
const watchers = new Set()
const tell = () => {
  for (const fn of watchers) fn()
}
sharer.answer().then((a) => {
  answer = a
  tell()
})

/**
 * Whether the card is still owed on this device: 'first' for never answered,
 * 'again' for a Yes given to the words before 4 November 2026 (lib/gear-share-
 * rules SHARE_KEY_BEFORE), false for neither. Storage that will not answer
 * owes it, and the answer stays off.
 */
export async function shareQuestionDue() {
  return sharer.owed()
}

/** Yes (true) or No thanks (false), from the card or the Settings row. */
export async function setSharing(yes) {
  answer = await sharer.setAnswer(yes)
  tell()
  if (yes) look()
}

const subscribe = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}
const readOn = () => sharing(answer)
/** Whether sharing is on, for the Settings row. Off until storage has answered. */
export const useSharing = () => useSyncExternalStore(subscribe, readOn, readOn)

/* ------------------------------------------------------------------------ */
/* Listening for gear                                                        */
/* ------------------------------------------------------------------------ */

/*
 * HOW LONG IT TOOK TO CONNECT, AND HOW QUICKLY A TAP IS ANSWERED (lib/
 * gear-share-rules createGearClock). The clock is told every change of the
 * link and the unit, and each of the player's own taps as it comes back
 * (lib/device through lib/tapTimes), whether or not sharing is on, so the
 * times are there the moment somebody says Yes. Kept in memory only, and it
 * sends nothing: only a note, below, ever carries them.
 */
const clock = createGearClock()
const stepClock = () => clock.step({ link: linkState().link, unit: rigState().unit, readSince: unitReadSince })

function factsNow() {
  /*
   * A UNIT ON A USB CABLE IS ITS OWN KIND, 'usb' (4 November 2026, Justin:
   * "Yes, add the cable connection server change"). It goes over the same
   * wire as Bluetooth (linkVia says 'bluetooth'), and lib/bleAdapters
   * isCable tells it apart; its name is the cable's port's ("AM4", "C2MIDI
   * Pro"), kept where an adapter's name is.
   */
  const via = linkVia() === 'bluetooth' && cableNow() ? 'usb' : linkVia()
  const saved = bluetoothSettings() || {}
  return noteFacts({
    rig: rigState(),
    via,
    link: linkState(),
    bluetooth: {
      phase: bluetoothPhase(),
      unit: saved.unit ? unitName(saved.unit) : null,
      adapter: saved.adapter ? adapterName(saved.adapter) || '' : null,
      /* A unit other than the one picked, when one answered instead (lib/bluetooth): then nothing is a note. */
      answeredAs: bluetoothFacts().answeredAs
    },
    phone: deviceFacts(),
    appVersion: APP_VERSION,
    times: clock.times()
  })
}

/*
 * A combination has to hold for SETTLE_MS before it is a note: the moments
 * of starting up (a unit 'missing' for the second before it answers) are not
 * results. Every change starts the wait again for whatever is true then.
 *
 * Then a unit that answered through a computer waits a little longer for its
 * tap time (noteDue): the third tap, two minutes from when the gear first
 * held, or the app going to the background, whichever comes first. While it
 * waits it is HELD, never dropped: it keeps up with the taps while its gear
 * holds, and gear that changes or goes (another computer, the unit
 * unplugged, the link down) sends it as it was. A note that
 * is due goes a while later, at a random moment of its own (sendDelay), and
 * never from inside a tap. A note the server did not take is tried again
 * once, five minutes on, as the gear is then if it is the same and as it was
 * if not; the sharer itself sends no combination again within those five
 * minutes, however often the gear settles.
 */
let waiting = null
let waitingKey = null
let heldSince = 0
/* The held note: { key, facts }, or null. */
let held = null
let heldTimer = null
const retries = new Map()

const keyOf = (facts) => gearKey(gearRecord(facts))

function post(facts, again = false) {
  const key = keyOf(facts)
  if (!key) return
  setTimeout(() => {
    sharer.report(facts).then((said) => {
      if (again || said?.why !== 'not sent' || retries.has(key)) return
      retries.set(
        key,
        setTimeout(() => {
          retries.delete(key)
          if (!sharing(answer)) return
          const latest = factsNow()
          post(keyOf(latest) === key ? latest : facts, true)
        }, RETRY_MS)
      )
    })
  }, sendDelay())
}

/* The held note goes: with the times as they are while its gear holds, and as they were when it does not. */
function release() {
  if (!held) return
  const note = held
  held = null
  if (heldTimer) clearTimeout(heldTimer)
  heldTimer = null
  if (!sharing(answer)) return
  const latest = factsNow()
  post(keyOf(latest) === note.key ? latest : note.facts)
}

const dueNow = (record) => noteDue({ outcome: record?.outcome, via: record?.via, taps: clock.tapCount(), waited: Date.now() - heldSince })

function look() {
  if (!sharing(answer)) return
  const key = keyOf(factsNow())
  if (held && key === held.key) return
  /* Other gear, or none: the held note goes as it was, rather than being lost. */
  release()
  if (key === waitingKey) return
  if (waiting) clearTimeout(waiting)
  waiting = null
  waitingKey = key
  if (!key) return
  heldSince = Date.now()
  waiting = setTimeout(() => {
    waiting = null
    waitingKey = null
    const facts = factsNow()
    const record = gearRecord(facts)
    if (gearKey(record) !== key) return
    if (dueNow(record)) {
      post(facts)
      return
    }
    held = { key, facts }
    heldTimer = setTimeout(release, Math.max(0, NOTE_AFTER_MS - (Date.now() - heldSince)))
  }, SETTLE_MS)
}

/* A tap, timed: into the clock, into the held note while its gear holds, and the note goes once it has its taps. */
function tapped(ms) {
  clock.tap(ms)
  if (!held) return
  const latest = factsNow()
  if (keyOf(latest) === held.key) held.facts = latest
  if (dueNow(gearRecord(held.facts))) release()
}

let started = false
/** Start listening, once, for the life of the app. Sends nothing unless the answer on this device is Yes. */
export function startGearShare() {
  if (started) return
  started = true
  /* The clock first, so a note looked at on the same change has the times as they are now. */
  subscribeRig(stepClock)
  subscribeLink(stepClock)
  stepClock()
  onTapTime(tapped)
  subscribeRig(look)
  subscribeBluetooth(look)
  subscribeLink(look)
  /*
   * Put in the background (it may not come back): a held note goes with
   * what it has. Not 'inactive', which is Control Center pulled down or the
   * app switcher, with the app still there.
   */
  AppState.addEventListener('change', (status) => {
    if (status === 'background') release()
  })
}
