import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { SETTLE_MS, createGearSharer, gearKey, gearRecord, noteFacts, sharing } from './gear-share-rules'
import { DEFAULT_PROJECT } from './project'
import { APP_VERSION } from './version'
import { logDebug } from './debugLog'
import { getState as rigState, subscribeRig } from './rig'
import { adapterName, bluetoothPhase, bluetoothSettings, subscribeBluetooth, unitName } from './bluetooth'
import { linkState, linkVia, subscribeLink } from './link'
import { DEVICE_KIND } from './thisDevice'

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
 * Native's own Platform were already in the app, so it rides an update and
 * not a store build.
 */

let client = null
async function insert(record) {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
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

/** Whether the card is still owed on this device: never answered. Storage that will not answer owes it, and the answer stays off. */
export async function shareQuestionDue() {
  return (await sharer.answer()) === null
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
 * What a handset can say about itself without a new package: which system
 * and its version, and on Android the maker and model React Native already
 * reports (Platform.constants). An iPhone says only whether it is an iPad.
 * Never the name somebody gave the device ("Justin's iPhone").
 */
function phone() {
  const c = Platform.constants || {}
  let model = null
  if (Platform.OS === 'android') {
    const maker = typeof c.Manufacturer === 'string' ? c.Manufacturer : ''
    const name = typeof c.Model === 'string' ? c.Model : ''
    model = name && maker && !name.toLowerCase().startsWith(maker.toLowerCase()) ? `${maker} ${name}` : name || maker || null
  } else if (Platform.OS === 'ios') {
    model = DEVICE_KIND === 'ipad' ? 'iPad' : 'iPhone'
  }
  return {
    os: Platform.OS,
    osVersion: Platform.OS === 'android' && c.Release ? String(c.Release) : String(Platform.Version ?? ''),
    model
  }
}

function factsNow() {
  const saved = bluetoothSettings() || {}
  return noteFacts({
    rig: rigState(),
    via: linkVia(),
    link: linkState(),
    bluetooth: {
      phase: bluetoothPhase(),
      unit: saved.unit ? unitName(saved.unit) : null,
      adapter: saved.adapter ? adapterName(saved.adapter) || '' : null
    },
    phone: phone(),
    appVersion: APP_VERSION
  })
}

/*
 * A combination has to hold for SETTLE_MS before it is a note: the moments
 * of starting up (a unit 'missing' for the second before it answers) are not
 * results. Every change starts the wait again for whatever is true then.
 */
let waiting = null
let waitingKey = null
function look() {
  if (!sharing(answer)) return
  const key = gearKey(gearRecord(factsNow()))
  if (key === waitingKey) return
  if (waiting) clearTimeout(waiting)
  waiting = null
  waitingKey = key
  if (!key) return
  waiting = setTimeout(() => {
    waiting = null
    waitingKey = null
    const facts = factsNow()
    if (gearKey(gearRecord(facts)) === key) sharer.report(facts)
  }, SETTLE_MS)
}

let started = false
/** Start listening, once, for the life of the app. Sends nothing unless the answer on this device is Yes. */
export function startGearShare() {
  if (started) return
  started = true
  subscribeRig(look)
  subscribeBluetooth(look)
  subscribeLink(look)
}
