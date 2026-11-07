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
 * settles it (howConnectAnswered), as does the walkthrough's own choice of
 * way after a found purchase, and so does a real link answering first, the
 * computer or an adapter (noteLink): somebody whose computer was already set
 * up is never asked.
 *
 * AND THE FIRST CONNECTION, kept on the device (unitConnected), for "Help make
 * Fractal Remote better?": it asked straight after the trial, before
 * anything was connected, one more card between paying and playing. It waits
 * for a launch after a unit has connected here (connectedBefore, read once
 * at launch so the card never comes up over a rig that has just answered).
 *
 * ONCE PER DEVICE, AND NEVER ARMED AGAIN. Once it is settled (either answer,
 * a link having answered here, or 'done' on disk) it stays settled for good,
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
/*
 * AND WHAT A DEVICE CONNECTED BEFORE THIS CARD EXISTED HAS ON IT INSTEAD
 * (the review of 7 November 2026): the two keys above are new, so a
 * customer who had connected for weeks was, at their next account or
 * purchase here, asked how they connect. Any of these says a way was set
 * up on this device, and is read only where neither key above is on the
 * disk yet, so once, at the first launch after the update:
 *
 *   - the computer the account's roll call heard (lib/relay.js HOST_KEY,
 *     written only once a computer has answered);
 *   - a Bluetooth adapter or unit kept (lib/bluetooth.js KEY);
 *   - the way a USB cable took over from (lib/bluetooth.js CABLE_KEY);
 *   - a gear note sent (lib/gear-share-rules SENT_KEY, never for the demo).
 *
 * Found, it is a unit connected before, and written down as one.
 */
const BEFORE_KEYS = ['fractal.remote.host', 'fractal.bluetooth', 'fractal.bluetooth.cable', 'fractal.gearShare.sent.v1']

let owed = false
/* Answered, or a link has answered here, or 'done' on disk: never owed again. */
let settled = false
/* 'done' is on the disk already: not written again. */
let doneKept = false
let connectedKept = false
/* The latest read of the disk, for askHowToConnect to wait on, and whether it answered. */
let reading = null
let readOk = false
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

const parsed = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Whether what was kept before this card existed says a way was set up here (BEFORE_KEYS). */
function setUpBefore([host, bluetooth, cable, sent]) {
  const picks = parsed(host)
  /* A bare name is the pick 1.87.47 and earlier kept; otherwise any account's entry (shared/relay-rules readPicks). */
  if (typeof picks === 'string' && picks) return true
  if (picks?.accounts && typeof picks.accounts === 'object' && Object.keys(picks.accounts).length) return true
  const ble = parsed(bluetooth)
  if (ble?.adapter || ble?.unit) return true
  const memo = parsed(cable)
  if (memo?.adapter || memo?.from) return true
  const notes = parsed(sent)
  return Boolean(notes && typeof notes === 'object' && Object.keys(notes).length)
}

async function readKept() {
  const [ask, connected, ...before] = await Promise.all([ASK_KEY, CONNECTED_KEY, ...BEFORE_KEYS].map((key) => AsyncStorage.getItem(key)))
  let wasConnected = connected === 'yes'
  if (!ask && !connected && setUpBefore(before)) {
    wasConnected = true
    AsyncStorage.setItem(CONNECTED_KEY, 'yes').catch(() => {})
  }
  connectedKept = connectedKept || wasConnected
  doneKept = doneKept || ask === 'done'
  settled = settled || doneKept || connectedKept
  owed = !settled && (owed || ask === 'owed')
  tell()
  return { owed, connectedBefore: wasConnected }
}

/** Read at launch: whether the question is owed, and whether a unit has connected on this device before. */
export function readHowConnect() {
  const now = readKept().then(
    (kept) => {
      readOk = true
      return kept
    },
    () => {
      readOk = false
      return { owed: false, connectedBefore: true }
    }
  )
  reading = now
  return now
}

/*
 * SETTLED FOR GOOD, in memory and on the disk: an answer, the walkthrough's
 * own choice of way, or a link answering here.
 */
function settle() {
  const was = owed
  owed = false
  settled = true
  if (was) tell()
  if (doneKept) return
  doneKept = true
  AsyncStorage.setItem(ASK_KEY, 'done').catch(() => {})
}

/**
 * An account made, a trial started or the full version bought, here: the
 * question is owed, unless it was ever settled.
 *
 * NOT BEFORE THE DISK HAS SAID SO. Asked ahead of the launch read, it wrote
 * 'owed' over a 'done' still on the disk, and the next launch asked an
 * owner who had answered (the review of 7 November 2026). So it waits for
 * that read, and a read that could not be made leaves it unasked: never
 * armed again over an answer nobody could see.
 */
export function askHowToConnect() {
  if (owed || settled) return
  ;(reading || readHowConnect()).then(() => {
    if (owed || settled || !readOk) return
    owed = true
    tell()
    AsyncStorage.setItem(ASK_KEY, 'owed').catch(() => {})
  })
}

/** Either answer tapped, or the walkthrough's choice of way: never asked again on this device. */
export function howConnectAnswered() {
  settle()
}

/** A unit answered, by either way: the question is settled, and the sharing card may come at the next launch. */
export function unitConnected() {
  settle()
  if (connectedKept) return
  connectedKept = true
  AsyncStorage.setItem(CONNECTED_KEY, 'yes').catch(() => {})
}

/*
 * THE LINK AS IT CHANGES (App.js, at each change of the link, the unit, the
 * sign-in or the demo). A real link answering at all settles the question:
 * the computer answering with no unit behind it, or a Bluetooth adapter
 * connecting. A unit there too is the first connection (unitConnected).
 *
 * NEVER THE DEMO'S. Its link says connected and its unit is there, and both
 * are still on the render that switches it off: the link is reset only in
 * the cleanup that runs after (lib/link.js stopLink). Read as a real one, a
 * purchase made in the demo settled its own question at Exit demo, and the
 * sharing card came at the next launch with nothing ever connected (the
 * review of 7 November 2026). So after the demo nothing counts until the
 * link has been seen down.
 */
let demoLink = false
export function noteLink({ auth = 'checking', demo = false, link = 'off', unit = false } = {}) {
  if (demo) {
    demoLink = true
    return
  }
  if (link !== 'connected') demoLink = false
  if (demoLink || auth !== 'in' || link !== 'connected') return
  settle()
  if (unit) unitConnected()
}

/**
 * WHETHER THE CARD IS DRAWN, in Play's place (App.js askHow): owed, signed in
 * and past the purchase page, not the demo, Bluetooth offered (the Settings
 * row's own gate) and off, and no rig at all, neither connected nor on
 * screen while the link comes back (`caps`, the unit's capabilities, kept
 * through a drop): it never takes the place of a live or reconnecting rig.
 *
 * AND ONLY WHERE PLAY IS (`screen` 'stage'). Drawn ahead of every screen,
 * a drop with Settings, Troubleshooting, a report half typed or the
 * Bluetooth page open put the question in its place, and the report was
 * lost (the review of 7 November 2026). `link` is the link as the top bar
 * says it (App.js shownLink).
 */
export const howConnectShown = ({ owed: isOwed = false, auth = 'checking', demo = false, offered = false, bluetooth = false, link = 'off', caps = null, screen = null } = {}) =>
  isOwed === true && screen === 'stage' && auth === 'in' && !demo && offered === true && !bluetooth && link !== 'connected' && !caps

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
