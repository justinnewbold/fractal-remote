import { AppState, Platform } from 'react-native'

import { bluetoothOn, setSwitch } from './bleSwitch'
import {
  adapterDevices,
  bluetoothSettings,
  bluetoothSupported,
  closeWire,
  connectAdapter,
  noteBluetooth,
  onAdapter,
  openWire,
  releaseAdapter,
  subscribeBluetooth,
  unitName
} from './bluetooth'
import { handleEvent, refreshAll, reset as resetRig, stopWatching, watchUnit } from './rig'
import { mayConnect } from './purchases'
import { logDebug } from './debugLog'

/**
 * BLUETOOTH (BETA): KEEPING THE PHONE CONNECTED TO THE ADAPTER.
 *
 * link.js's job, for the case where there is no computer. With Bluetooth on,
 * startLink hands over to this instead of joining the computer, and the link
 * state it keeps means the same things it always has, one step closer:
 *
 *   'joining'   — looking for the adapter (the bar says connecting);
 *   'connected' — the ADAPTER is connected. Whether the UNIT answers is the
 *                 rig store's `unit`, exactly as it is over the computer,
 *                 where 'connected' is the computer and the unit is its own
 *                 word in the bar;
 *   'off'       — not trying: no unit chosen, no adapter picked, not
 *                 unlocked, or the player pressed Disconnect.
 *
 * Like link.js it is a loop rather than a button: an adapter that drops (out
 * of range, the unit switched off, iOS letting an idle link go) is looked for
 * again, every three seconds and then less often, up to every thirty.
 *
 * NOTHING HERE IMPORTS link.js, which imports this. It is handed link.js's
 * own `set` instead, so there is one link state and one place it is logged.
 */

export const RETRY_FIRST = 3000
export const RETRY_CAP = 30000
const nextDelay = (previous) => (!previous || previous < RETRY_FIRST ? RETRY_FIRST : Math.min(previous * 2, RETRY_CAP))

/* Between startBluetoothLink and stopBluetoothLink: link.js wants Bluetooth. */
let wanted = false
/* The loop is up: past the unlock check, listening to the adapter. */
let running = false
/* link.js's set. */
let tell = null
let offs = []
let timer = null
let delay = 0
/* Which attempt to connect this is; anything that finishes for an older one is ignored. */
let attempt = 0
let inFlight = false
let wire = null
let unhear = null
/* The player pressed Disconnect: stay off until they ask again. */
let held = false
/* The unit and adapter the loop last acted on, so a change to either is noticed. */
let seen = { unit: null, adapter: null }
/* Whether the module was ever asked to connect, so there is something to let go of. */
let touched = false

const say = (line, detail) => logDebug('ble', line, detail)

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function later(fn, ms) {
  clearTimer()
  timer = setTimeout(fn, ms)
}

/** Start connecting. Idempotent: a second call is a poke, not a second loop. */
export function startBluetoothLink(set) {
  if (typeof set === 'function') tell = set
  wanted = true
  if (running) {
    pokeBluetooth()
    return
  }
  if (!bluetoothSupported()) {
    tell?.({ link: 'off' })
    noteBluetooth({ phase: 'off' })
    say('Bluetooth (beta) is on, but this build or this phone cannot do it')
    return
  }
  /*
   * THE UNLOCK, as the paywall applies it: somebody who may not drive a real
   * unit is not connected to one. mayConnect says yes when the store cannot
   * be reached, the same as everywhere else in the app.
   */
  if (!mayConnect()) {
    tell?.({ link: 'off' })
    noteBluetooth({ phase: 'locked' })
    say('not connecting over Bluetooth: the app is not unlocked on this phone')
    return
  }
  running = true
  held = false
  delay = 0
  const s = bluetoothSettings()
  seen = { unit: s.unit, adapter: s.adapter?.id || null }
  offs = [
    onAdapter('onState', heardState),
    onAdapter('onDevices', heardDevices),
    subscribeBluetooth(settingsMoved),
    AppState.addEventListener('change', screen)
  ]
  begin()
}

/** Where the loop stands, said to the link and to the page; then, if there is an adapter to try, try it. */
function begin() {
  clearTimer()
  if (!running) return
  const s = bluetoothSettings()
  if (!s.unit) {
    tell?.({ link: 'off', macName: null, hostVersion: null })
    noteBluetooth({ phase: 'no-unit' })
    return
  }
  const name = s.adapter?.name || 'the Bluetooth adapter'
  /*
   * With no adapter picked nothing is being looked for, so the link is 'off'
   * as it is for no unit: 'joining' put "Finding the Bluetooth adapter" on
   * the stage for ever, with a button that looked again for nothing.
   */
  tell?.({ link: held || !s.adapter ? 'off' : 'joining', macName: name, hostVersion: null })
  if (held) return noteBluetooth({ phase: 'held' })
  if (!s.adapter) return noteBluetooth({ phase: 'no-adapter' })
  noteBluetooth({ phase: 'connecting' })
  tryConnect()
}

async function tryConnect() {
  timer = null
  if (!running || held || wire || inFlight) return
  const s = bluetoothSettings()
  if (!s.adapter) return
  const mine = ++attempt
  let ok = false
  inFlight = true
  try {
    /*
     * On an iPhone the adapter is a port that CoreMIDI lists for as long as
     * Apple's Bluetooth keeps it connected. An offline one is not asked:
     * it would "connect" to nothing, and the next change to the list (see
     * heardDevices) is the moment to try again.
     */
    const here = Platform.OS !== 'ios' || adapterDevices().some((d) => d.id === s.adapter.id && !d.offline)
    if (here) {
      touched = true
      ok = await connectAdapter(s.adapter.id)
    }
    if (ok) noteBluetooth({ trouble: null })
  } catch (err) {
    if (mine === attempt && err?.code === 'E_PERMISSION') noteBluetooth({ trouble: 'permission' })
    say('could not connect to the adapter', err?.message || String(err))
  } finally {
    inFlight = false
  }
  if (!running || held) return
  if (mine !== attempt) {
    /* Overtaken while it waited (another adapter was picked, say): the one wanted now is tried now. */
    if (!wire) tryConnect()
    return
  }
  if (ok) {
    /* The module says 'connected' as it connects (heardState); this is for an event that never arrived. */
    if (!wire) connected({ id: s.adapter.id, name: s.adapter.name })
    return
  }
  const was = delay
  delay = nextDelay(delay)
  /* Said while the wait grows, then quiet: thirty lines an hour of the same sentence bury the one that matters. */
  if (delay !== was) say(`the adapter is not there yet; trying again in ${delay / 1000} s`)
  later(tryConnect, delay)
}

/**
 * The adapter is connected: a fresh wire for the chosen unit, and the rig
 * asks the unit everything, the way join() does over the computer. Then the
 * unit watch and the footswitch watch, while the screen is on.
 */
async function connected(e) {
  if (!running || wire || held) return
  const s = bluetoothSettings()
  clearTimer()
  delay = 0
  const made = openWire()
  if (!made) return
  wire = made
  unhear = made.subscribe(handleEvent)
  setSwitch({ on: bluetoothOn(), wire: made })
  const name = e?.name || s.adapter?.name || 'the Bluetooth adapter'
  noteBluetooth({ phase: 'connected', connectedTo: name, trouble: null, answeredAs: null })
  tell?.({ link: 'connected', macName: name, hostVersion: null })
  say(`connected to ${name}; asking the ${unitName(s.unit)} what it is`)
  /*
   * ONE QUESTION TO WAKE THE LINK, ITS ANSWER NOT USED. On the AM4 test the
   * first question after connecting went unanswered, and the same question a
   * moment later was answered in 132 ms, as was everything after it. So the
   * first question on a new link is asked here and thrown away, and the real
   * ones start after it: the page no longer says "isn't answering" about a
   * unit that is. It is the unit's own probe, so on the AM4 it is a frame on
   * the allowlist; one extra read on connecting is all it costs. Why the
   * first is lost is not known yet — the debug log of the next test says.
   */
  try {
    const woke = await made.request('/device/detect')
    say(woke?.connected ? 'the first question was answered' : 'no answer to the first question; asking again')
  } catch {
    say('no answer to the first question; asking again')
  }
  if (wire !== made || !running) return
  try {
    await refreshAll()
  } catch {
    // The rig store keeps what it learned, including the failure.
  }
  if (wire !== made || !running) return
  if (AppState.currentState !== 'background') {
    watchUnit()
    made.startPolls()
  }
}

/* The wire goes, and with it everything waiting on it; the switch goes back to refusing. */
function letGoOfWire() {
  unhear?.()
  unhear = null
  wire?.stopPolls()
  wire = null
  closeWire()
  setSwitch({ on: bluetoothOn(), wire: null })
}

function heardState(e) {
  if (!running) return
  const id = bluetoothSettings().adapter?.id
  if (!id || (e?.id && e.id !== id)) return
  if (e?.state === 'connected') {
    connected(e)
    return
  }
  if (e?.state === 'disconnected') dropped(e?.reason)
}

/* The adapter went: out of range, the unit switched off, or iOS letting an idle link go. Look again. */
function dropped(reason) {
  const had = !!wire
  letGoOfWire()
  stopWatching()
  if (!running || held) return
  say(had ? 'the adapter went away' : 'the adapter did not stay connected', reason || undefined)
  delay = 0
  begin()
}

/* iPhone: the adapter came back online in CoreMIDI's list, so try now rather than at the next turn. */
function heardDevices(e) {
  if (!running || held || wire || Platform.OS !== 'ios') return
  const id = bluetoothSettings().adapter?.id
  const list = Array.isArray(e?.devices) ? e.devices : []
  if (id && list.some((d) => d?.id === id && !d.offline)) {
    clearTimer()
    tryConnect()
  }
}

/*
 * THE PAGE CHANGED SOMETHING. A different adapter is let go of and the new
 * one tried. A different UNIT is a different rig — another model byte,
 * another chain, other presets in the same slots — so the store is cleared
 * and the new unit asked everything, over the same Bluetooth connection.
 */
function settingsMoved(s) {
  if (!running) return
  const unit = s.unit
  const adapter = s.adapter?.id || null
  if (unit === seen.unit && adapter === seen.adapter) return
  const unitMoved = unit !== seen.unit
  const adapterMoved = adapter !== seen.adapter
  seen = { unit, adapter }
  const name = s.connectedTo
  const had = !!wire
  attempt++
  clearTimer()
  letGoOfWire()
  stopWatching()
  if (unitMoved) resetRig()
  if (adapterMoved) {
    say(adapter ? 'a different adapter was chosen' : 'the adapter was forgotten')
    if (touched) releaseAdapter()
    held = false
    delay = 0
    begin()
    return
  }
  say(`the unit is now the ${unitName(unit)}: asking it everything`)
  if (had) connected({ id: adapter, name })
  else begin()
}

function screen(status) {
  logDebug('app', status === 'active' ? 'back on screen' : `put to sleep (${status})`)
  if (!running) return
  if (status === 'active') {
    if (wire) {
      watchUnit()
      wire.startPolls()
    } else if (!held) {
      delay = 0
      clearTimer()
      tryConnect()
    }
    return
  }
  /* A phone in a pocket has no screen to be wrong on: nothing is asked until it is back. */
  stopWatching()
  wire?.stopPolls()
}

/**
 * Look again NOW: the waiting screen's button, the page's Connect, a watch
 * tap that woke the phone. Starts the loop again if it was stopped at the
 * unlock check and the app has been unlocked since.
 */
export function pokeBluetooth() {
  if (!wanted) return
  if (!running) {
    startBluetoothLink(tell)
    return
  }
  if (wire) return
  held = false
  delay = 0
  begin()
}

/** The page's Disconnect: let go of the adapter and stay off until asked again. */
export function holdBluetooth() {
  if (!running || held) return
  held = true
  attempt++
  clearTimer()
  letGoOfWire()
  stopWatching()
  if (touched) releaseAdapter()
  say('disconnected from the adapter, as asked')
  begin()
}

/** Stop everything: link.js's stopLink, before it resets the link and the rig. */
export function stopBluetoothLink() {
  wanted = false
  if (!running) return
  running = false
  attempt++
  clearTimer()
  for (const off of offs.splice(0)) {
    try {
      off?.remove ? off.remove() : off?.()
    } catch {
      // Unbinding twice is not a failure worth reporting.
    }
  }
  letGoOfWire()
  stopWatching()
  if (touched) releaseAdapter()
  touched = false
  held = false
  noteBluetooth({ phase: bluetoothOn() ? 'idle' : 'off', connectedTo: null })
}
