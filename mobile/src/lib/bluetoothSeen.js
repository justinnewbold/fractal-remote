import AsyncStorage from '@react-native-async-storage/async-storage'

import { bluetoothSetUp, toldKey } from './bluetooth-seen-rule'
import { bluetoothFacts, bluetoothPhase, bluetoothSettings, subscribeBluetooth } from './bluetooth'
import { getState as rigState, subscribeRig } from './rig'
import { linkVia, subscribeLink } from './link'
import { noteBluetoothConnected, sessionAccount } from './relay'
import { logDebug } from './debugLog'

/**
 * THE FIRST TIME THE UNIT ANSWERS OVER BLUETOOTH, the account server is
 * told, once, so the setup emails ("Having trouble getting connected?") go
 * only to somebody who has connected neither a computer nor Bluetooth. The
 * rule is lib/bluetooth-seen-rule.js; this is the phone's part.
 *
 * One date beside the account and nothing else: not the unit, the adapter,
 * the phone or how often (note_bluetooth_connected takes no argument and
 * keeps the first date only). Said on the privacy page under "Help getting
 * connected". Signed out, nothing goes, and it is asked again at the next
 * connection signed in. Once the server has it, the phone keeps that it
 * does (toldKey) and never asks again for that account. Nothing new is
 * installed for it, so it rides an update.
 */
const told = new Set()
let asking = false
let lastTry = 0
const AGAIN_MS = 10 * 60 * 1000

async function look() {
  const saved = bluetoothSettings() || {}
  const rig = rigState() || {}
  const setUp = bluetoothSetUp({
    via: linkVia(),
    phase: bluetoothPhase(),
    unit: saved.unit,
    rigUnit: rig.unit,
    answeredAs: bluetoothFacts().answeredAs,
    simulated: rig.simulated
  })
  if (!setUp || asking || Date.now() - lastTry < AGAIN_MS) return
  asking = true
  try {
    const account = await sessionAccount()
    if (!account?.id || told.has(account.id)) return
    const key = toldKey(account.id)
    if ((await AsyncStorage.getItem(key).catch(() => null)) === 'yes') {
      told.add(account.id)
      return
    }
    lastTry = Date.now()
    if (await noteBluetoothConnected()) {
      told.add(account.id)
      await AsyncStorage.setItem(key, 'yes').catch(() => {})
      logDebug('app', 'bluetooth: the account server knows this account has connected over Bluetooth')
    }
  } finally {
    asking = false
  }
}

let started = false
/** Start listening, once, for the life of the app. */
export function startBluetoothSeen() {
  if (started) return
  started = true
  subscribeRig(look)
  subscribeBluetooth(look)
  subscribeLink(look)
}
