import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

/**
 * "HOW DO YOU CONNECT TO YOUR UNIT?", AND WHETHER A UNIT HAS EVER CONNECTED.
 *
 * "Signup was difficult, no tutorial. No mention of bluetooth" and "just
 * immediately says, looking for computer, no tutorial, nothing after signing
 * up for the free trial" (Justin, 7 November 2026). The link starts on the
 * computer the moment an account is in (App.js startLink), so a new customer
 * met "Finding your computer…" and nothing else, while about nine in ten of
 * them will use a Bluetooth adapter.
 *
 * So the question is OWED from the moment this device makes an account,
 * starts a trial or buys the full version (askHowToConnect, called by the
 * sign-in screen and the purchase page), and asked once, in Play's place
 * (components/HowConnect.js), where this copy offers Bluetooth. Either answer
 * settles it (howConnectAnswered), and so does a unit answering through
 * either way first (unitConnected): somebody whose computer was already set
 * up is never asked.
 *
 * AND THE FIRST CONNECTION, kept on the device (unitConnected), for "Help make
 * Fractal Remote better?": it asked straight after the trial, before
 * anything was connected, one more card between paying and playing. It waits
 * for a launch after a unit has connected here (connectedBefore, read once
 * at launch so the card never comes up over a rig that has just answered).
 *
 * ONCE PER DEVICE, AND NEVER ARMED AGAIN. Once it is settled (either answer,
 * a unit having connected here, or 'done' on disk) it stays settled for good,
 * in memory too (`settled`): a trial and then a purchase on day 8 each ask,
 * and the second one asked again an owner who had answered, or whose
 * computer already worked (the review of 7 November 2026).
 *
 * Per device, like the walkthrough's own key: a new phone has not been
 * asked. Storage that will not answer is "nothing owed" and "connected
 * before": the app opens as it did before either existed.
 */
const ASK_KEY = 'fractal.howConnect.v1'
const CONNECTED_KEY = 'fractal.unitConnected.v1'

let owed = false
/* Answered, or a unit has connected here, or 'done' on disk: never owed again. */
let settled = false
let connectedKept = false
const listeners = new Set()
const tell = () => {
  for (const fn of listeners) {
    try {
      fn(owed)
    } catch {
      // One bad listener shouldn't stop the others.
    }
  }
}

/** Read at launch: whether the question is owed, and whether a unit has connected on this device before. */
export async function readHowConnect() {
  try {
    const [ask, connected] = await Promise.all([AsyncStorage.getItem(ASK_KEY), AsyncStorage.getItem(CONNECTED_KEY)])
    connectedKept = connectedKept || connected === 'yes'
    settled = settled || ask === 'done' || connectedKept
    owed = !settled && (owed || ask === 'owed')
    tell()
    return { owed, connectedBefore: connected === 'yes' }
  } catch {
    return { owed: false, connectedBefore: true }
  }
}

/** An account made, a trial started or the full version bought, here: the question is owed, unless it was ever settled. */
export function askHowToConnect() {
  if (owed || settled) return
  owed = true
  tell()
  AsyncStorage.setItem(ASK_KEY, 'owed').catch(() => {})
}

/** Either answer tapped: never asked again on this device. */
export function howConnectAnswered() {
  const was = owed
  settled = true
  owed = false
  if (was) tell()
  AsyncStorage.setItem(ASK_KEY, 'done').catch(() => {})
}

/** A unit answered, by either way: the question is settled, and the sharing card may come at the next launch. */
export function unitConnected() {
  if (owed) howConnectAnswered()
  settled = true
  if (connectedKept) return
  connectedKept = true
  AsyncStorage.setItem(CONNECTED_KEY, 'yes').catch(() => {})
}

/**
 * WHETHER THE CARD IS DRAWN, in Play's place (App.js askHow): owed, signed in
 * and past the purchase page, not the demo, Bluetooth offered (the Settings
 * row's own gate) and off, and no rig at all, neither connected nor on
 * screen while the link comes back (`caps`, the unit's capabilities, kept
 * through a drop): it never takes the place of a live or reconnecting rig.
 */
export const howConnectShown = ({ owed: isOwed = false, auth = 'checking', demo = false, offered = false, bluetooth = false, link = 'idle', caps = null } = {}) =>
  isOwed === true && auth === 'in' && !demo && offered === true && !bluetooth && link !== 'connected' && !caps

/** Whether the question is owed, live. */
export function useHowConnectOwed() {
  const [now, setNow] = useState(owed)
  useEffect(() => {
    listeners.add(setNow)
    setNow(owed)
    return () => listeners.delete(setNow)
  }, [])
  return now
}
