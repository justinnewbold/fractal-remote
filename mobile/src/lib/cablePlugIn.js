import { useSyncExternalStore } from 'react'

import { BLE_UNITS } from './bleWire'
import { cablePlugIn, cablesIn, isCable } from './bleAdapters'
import {
  adapterDevices,
  adapterName,
  bluetoothPhase,
  bluetoothSettings,
  cableLetGo,
  cablesHere,
  onAdapter,
  subscribeBluetooth,
  takeCable,
  unitName,
  unitOfferedNow
} from './bluetooth'
import { logDebug } from './debugLog'

/**
 * A UNIT PLUGGED IN BY USB CABLE WHILE THE APP IS CONNECTED ANOTHER WAY.
 *
 * "Is it set up to automatically detect when the USB cord has been plugged
 * in and switch to that connection? Or at least add that as an option to
 * switch to once it's plugged in?" (Justin, 6 November 2026.) Once a cable
 * was the one chosen, unplugging and plugging it back in reconnected by
 * itself (bleLink heardDevices); but through the computer, or through a
 * Bluetooth adapter, a unit plugged in by cable did nothing until Settings →
 * Bluetooth → Connect.
 *
 * So while the app runs, and only where the Bluetooth row itself is drawn
 * (App.js passes useBluetoothOffered, signed in and not the demo) on a copy
 * a unit can plug into at all (lib/bluetooth cablesHere), the module's list
 * is watched, and bleAdapters cablePlugIn says what it means: from a
 * Bluetooth adapter, the cable to the same unit is taken by itself and Play
 * says so; through the computer, Play asks (components/CablePlugIn), with
 * Use USB cable and Not now.
 *
 * NOTHING HERE TOUCHES BLUETOOTH. The list is the one the Bluetooth page
 * reads when it opens: on an iPhone CoreMIDI's ports, on Android its USB MIDI
 * devices (and whatever a search the page ran found). Neither asks a
 * permission, scans or opens Apple's screen. Asking for it is also what
 * starts the module's own watch on Android (MidiManager's DeviceCallback),
 * and on an iPhone what makes the MIDI client whose changes come back as
 * onDevices.
 *
 * WHAT IS NEVER OFFERED: a cable let go of by hand this session
 * (Troubleshooting's Forget the USB cable), one put off with Not now until it
 * is unplugged and plugged in again, a USB MIDI interface named for no unit
 * that is not the one kept from last time (a keyboard), a unit this account
 * is not offered, and anything at all with two or more that could be meant.
 * And a cable left in when somebody went back to the computer from it is
 * taken as Not now: they chose the computer over it.
 */

/* Play's card: an offer waiting for a tap, and a switch made by itself, to be said. Never kept: none of it is true after a restart. */
let state = { offer: null, switched: null }
const watchers = new Set()
function tell(patch) {
  state = { ...state, ...patch }
  for (const fn of [...watchers]) {
    try {
      fn()
    } catch {
      // One listener cannot stop the others hearing it.
    }
  }
}
const watch = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}
const read = () => state

/** Play's card, redrawn when it changes. */
export const useCablePlugIn = () => useSyncExternalStore(watch, read, read)

let open = false
let offs = []
/* The module's list as last heard, and the cables plugged in in it. */
let last = []
let known = new Set()
/* Not now, or back to the computer from it: not offered again until it is unplugged. In memory only. */
const dismissed = new Set()
let wasMode = null
let judging = false
let again = false

const cableName = (d) => adapterName(d) || 'a unit with no name'

/*
 * HOW THE APP IS CONNECTED NOW, as cablePlugIn reads it: through the
 * computer, a Bluetooth adapter, a cable, or 'off' (Bluetooth on with nothing
 * kept, after Disconnect, or waiting for the purchase), where nothing is
 * taken or offered.
 */
function modeNow(s) {
  if (!s.on) return 'computer'
  const phase = bluetoothPhase()
  if (!s.adapter || phase === 'held' || phase === 'locked' || phase === 'no-unit') return 'off'
  return isCable(s.adapter) ? 'cable' : 'adapter'
}

/**
 * Watch, or stop. `on` is App.js's gate (the Bluetooth row's own, signed in,
 * not the demo); a copy no unit can plug into is never watched.
 */
export function watchCables(on) {
  const want = on === true && cablesHere()
  if (want === open) return
  open = want
  if (!open) {
    for (const off of offs.splice(0)) off?.()
    last = []
    known = new Set()
    wasMode = null
    if (state.offer || state.switched) tell({ offer: null, switched: null })
    return
  }
  offs = [onAdapter('onDevices', (e) => heard(e?.devices)), subscribeBluetooth(() => judge())]
  heard(adapterDevices())
}

/* A new list from the module: the cables plugged in noted (and a Not now let go once its cable is out), then judged. */
function heard(list) {
  if (!open) return
  last = Array.isArray(list) ? list : []
  const cables = cablesIn(last)
  const now = new Set(cables.map((d) => d.id))
  for (const id of [...dismissed]) if (!now.has(id)) dismissed.delete(id)
  for (const d of cables) if (!known.has(d.id)) logDebug('ble', `USB cable seen: ${cableName(d)}`)
  known = now
  judge()
}

function judge() {
  if (!open) return
  if (judging) {
    again = true
    return
  }
  judging = true
  try {
    do {
      again = false
      decide()
    } while (again && open)
  } finally {
    judging = false
  }
}

function decide() {
  const s = bluetoothSettings()
  const mode = modeNow(s)
  /* Back to the computer from a cable still plugged in: they chose the computer over it, so it is not offered until it is plugged in again. */
  if (wasMode === 'cable' && mode === 'computer' && s.adapter && isCable(s.adapter) && known.has(s.adapter.id)) dismissed.add(s.adapter.id)
  wasMode = mode
  const d = cablePlugIn(last, {
    open: true,
    mode,
    kept: s.adapter,
    unit: s.unit,
    units: BLE_UNITS,
    offered: unitOfferedNow,
    skip: { has: cableLetGo },
    dismissed
  })
  if (!d) {
    if (state.offer) tell({ offer: null })
    return
  }
  if (d.act === 'switch') {
    if (state.offer) tell({ offer: null })
    if (takeCable(d.cable, d.unit)) {
      logDebug('ble', `USB cable plugged in: switched from the Bluetooth adapter to ${cableName(d.cable)}, for the ${unitName(d.unit)}`)
      tell({ switched: { at: Date.now(), shownAt: null } })
    }
    return
  }
  if (state.offer && state.offer.cable.id === d.cable.id && state.offer.unit === d.unit && state.offer.mode === mode) return
  logDebug('ble', `USB cable plugged in: ${cableName(d.cable)} offered for the ${unitName(d.unit)}, ${mode === 'computer' ? 'over the computer' : 'over the Bluetooth adapter'}`)
  tell({ offer: { cable: d.cable, unit: d.unit, name: unitName(d.unit), mode, at: Date.now() } })
}

/** Use USB cable: the cable, its unit and Bluetooth on, as Connect with it plugged in does (lib/bluetooth takeCable). */
export function acceptCable() {
  const o = state.offer
  if (!o) return false
  tell({ offer: null })
  const still = cablesIn(last).find((d) => d.id === o.cable.id)
  if (!still) {
    logDebug('ble', `Use USB cable tapped, but ${cableName(o.cable)} is no longer plugged in`)
    return false
  }
  const on = takeCable(still, o.unit)
  logDebug('ble', on ? `Use USB cable tapped: ${cableName(still)}, for the ${unitName(o.unit)}` : `Use USB cable tapped, and ${cableName(still)} could not be used`)
  return on
}

/** Not now: put away until this cable is unplugged and plugged in again. */
export function notNowCable() {
  const o = state.offer
  if (!o) return
  dismissed.add(o.cable.id)
  logDebug('ble', `Not now tapped: ${cableName(o.cable)} not offered again until it is plugged in again`)
  tell({ offer: null })
}

/** The switch's card was drawn: its time is counted from now. */
export function sawSwitched() {
  if (state.switched && !state.switched.shownAt) tell({ switched: { ...state.switched, shownAt: Date.now() } })
}

/** The switch's card has been said. */
export function doneSwitched() {
  if (state.switched) tell({ switched: null })
}
