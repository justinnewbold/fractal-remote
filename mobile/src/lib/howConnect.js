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
 * Per device, like the walkthrough's own key: a new phone has not been
 * asked. Storage that will not answer is "nothing owed" and "connected
 * before": the app opens as it did before either existed.
 */
const ASK_KEY = 'fractal.howConnect.v1'
const CONNECTED_KEY = 'fractal.unitConnected.v1'

let owed = false
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
    owed = owed || ask === 'owed'
    connectedKept = connectedKept || connected === 'yes'
    tell()
    return { owed, connectedBefore: connected === 'yes' }
  } catch {
    return { owed: false, connectedBefore: true }
  }
}

/** An account made, a trial started or the full version bought, here: the question is owed. */
export function askHowToConnect() {
  if (owed) return
  owed = true
  tell()
  AsyncStorage.setItem(ASK_KEY, 'owed').catch(() => {})
}

/** Either answer tapped: never asked again on this device. */
export function howConnectAnswered() {
  const was = owed
  owed = false
  if (was) tell()
  AsyncStorage.setItem(ASK_KEY, 'done').catch(() => {})
}

/** A unit answered, by either way: the question is settled, and the sharing card may come at the next launch. */
export function unitConnected() {
  if (owed) howConnectAnswered()
  if (connectedKept) return
  connectedKept = true
  AsyncStorage.setItem(CONNECTED_KEY, 'yes').catch(() => {})
}

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
