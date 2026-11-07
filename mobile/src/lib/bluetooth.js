import { useSyncExternalStore } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'

import { BLE_UNITS, CHECK_STEPS, WAYS, createBleWire, settleMethods } from './bleWire'
import { createJoiner } from './fractal-sysex.mjs'
import { catalogFor } from './gen3Catalog'
import { setSwitch } from './bleSwitch'
import { BLUETOOTH_DRIVER, cablesFirst, isAdapter, isCable, isNetworkSession, onMidiJacks, otherAdapterHere, pickAdapter, pairScreenCrashes, pairScreenShutWords } from './bleAdapters'
import { logDebug } from './debugLog'
import { isAdmin } from './admin'
import { accountId } from './owner-unlock'
import { installedStoreVersion } from './storeVersion'
import { bluetoothOpen, editOffered, unitOffered } from './ble-rule'
import { deviceNoun } from './device-word'
import { namedForFm3, neverOnFm3, unitForReport } from './bluetooth-gear'

/**
 * BLUETOOTH (BETA): WHAT THE PLAYER CHOSE, THE ADAPTER, AND THE ONE DOOR TO
 * THE NATIVE CODE.
 *
 * Three jobs, kept in one file so that each has exactly one owner:
 *
 *   - the settings, kept on the phone: on or off, which unit, which adapter,
 *     and which way of sending each command turned out to work;
 *   - the native module, FractalBleMidi, which only carries bytes. This is
 *     the ONLY file that asks for it, and it asks inside a try: in Expo Go, in
 *     the store builds made before the module went into one, or in any build
 *     the module failed to load in, the answer is null, and every function
 *     here then does nothing. That is what keeps Bluetooth invisible to
 *     anybody whose app cannot do it. And who sees it at all, wherever it
 *     can work, is Justin's account on every copy, and everybody else only
 *     on a copy whose BUILT-IN store version opens it (allowBluetooth,
 *     below, and the rule in ble-rule.js; the row and the page are gated in
 *     Settings.js);
 *   - the wire: the bytes coming in are put back into whole messages here
 *     (createJoiner) and handed to the wire from bleWire.js, which does all
 *     the thinking about what they mean.
 *
 * Keeping the link up — connecting, reconnecting, the footswitch watch —
 * is bleLink.js. The page is screens/Bluetooth.js.
 *
 * OFF UNLESS SOMEBODY TURNS IT ON. With it off nothing here touches the
 * native module at all, and the switch in bleSwitch.js answers the way that
 * leaves every request going to the computer exactly as before.
 */

const KEY = 'fractal.bluetooth'

/*
 * What is kept on the phone, as it starts. Off, and NO UNIT CHOSEN: the wrong
 * unit's model byte must never be sent to anything (the AM4 has frozen on
 * messages it did not expect), so the page will not connect until the player
 * has said which unit is on the other end of the adapter.
 *
 * `methods` is per unit: what auto learned about an FM3 says nothing about
 * an Axe-Fx III. `pcChannel` is the MIDI number Program Change goes out on.
 */
const SAVED = { on: false, unit: null, adapter: null, pcChannel: 1, methods: {} }

/* What is happening right now. Never kept: none of it is true after a restart. */
const NOW = {
  /* 'off' | 'idle' | 'no-unit' | 'no-adapter' | 'locked' | 'connecting' | 'connected' | 'held' */
  phase: 'off',
  /* null | 'bluetooth-off' | 'permission' | 'restricted' (iPhone only) — what stands between the phone and the adapter. */
  trouble: null,
  /* A sentence for the page when finding the adapter went wrong some other way. */
  said: null,
  /* The adapters the page can offer, newly found first. */
  devices: [],
  /* Android is scanning. */
  looking: false,
  /* The name the adapter gave when it connected. */
  connectedTo: null,
  /* The unit that answered instead of the one picked, by its bare name (an FM9 on an FM3's connection: 'FM9'), or null. */
  answeredAs: null,
  /* The adapter kept did not connect on the link's last try, and nothing has connected since (bleLink): the page offers another it can see (otherAdapterNow). */
  notThere: false
}

const UNIT_KEYS = BLE_UNITS.map((u) => u.key)
const SCAN_SECONDS = 10

let saved = { ...SAVED }
/*
 * ON LAST TIME, AND WAITING TO KNOW WHOSE PHONE THIS IS. True while the disk
 * says Bluetooth was on but nobody has said yet that this is Justin's account
 * (allowBluetooth, below): it stays off in the meantime, and his id turns it
 * on. The disk keeps saying on until a real answer, so a launch that never
 * learned whose phone it was costs nothing.
 */
let pendingOn = false
let now = { ...NOW }
let snapshot = { ...saved, ...now }
/* This round's look started on Android, so the module's list is what it heard (otherAdapterNow); a new round (bleLink's notThere back to false) starts with none. */
let lookedThisRound = false
const watchers = new Set()

function announce() {
  snapshot = { ...saved, ...now }
  for (const fn of [...watchers]) {
    try {
      fn(snapshot)
    } catch {
      // One listener cannot stop the others hearing it.
    }
  }
}

function keep() {
  /* An on held for an answer that is not in yet stays on, on disk: only a real no, or Stop, writes it off. */
  const disk = pendingOn ? { ...saved, on: true } : saved
  AsyncStorage.setItem(KEY, JSON.stringify(disk)).catch(() => {
    /* Costs the next launch these choices, and nothing else. */
  })
}

/*
 * WHAT A USB CABLE TOOK OVER FROM, kept under its own key so the settings
 * above keep their shape on the disk.
 *
 * "When unplugging the USB cable, it should automatically reconnect to the
 * last connected device" and "I also got stuck where I couldn't reconnect a
 * Bluetooth device again after connecting the USB cable" (Justin, 6
 * November 2026, Android). A cable chosen took the adapter's place, and the
 * Bluetooth adapter kept before it was gone for good: unplugged, the link
 * waited for the cable for ever ("Finding AM4…"), and the page's Connect
 * went back to waiting for it too, so no Bluetooth adapter could be
 * connected again. So when a cable takes over, what it took over from is
 * noted here:
 *
 *   - `adapter` and `unit`: the Bluetooth adapter kept before it, and the
 *     unit it was for (never a cable, never Apple's network session);
 *   - `from`: how the app was connected the moment the cable came in,
 *     'adapter' (Bluetooth on through that adapter) or 'computer'.
 *
 * lib/cablePlugIn goes back to it when the cable stays unplugged
 * (leaveCable), and the page's Connect and "Use a Bluetooth adapter
 * instead" use the adapter (adapterInsteadOfCable). Forgotten the moment a
 * Bluetooth adapter is chosen: it is the one kept then.
 */
const CABLE_KEY = 'fractal.bluetooth.cable'
const NO_CABLE_MEMO = { adapter: null, unit: null, from: null }
let beforeCable = { ...NO_CABLE_MEMO }
function keepBeforeCable() {
  AsyncStorage.setItem(CABLE_KEY, JSON.stringify(beforeCable)).catch(() => {
    /* Costs the next launch the way back, and nothing else. */
  })
}
function settleBeforeCable(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const ok = s.adapter && typeof s.adapter.id === 'string' && s.adapter.id && isAdapter(s.adapter) && !isCable(s.adapter)
  return {
    adapter: ok ? keptAdapter(s.adapter) : null,
    unit: ok && UNIT_KEYS.includes(s.unit) ? s.unit : null,
    from: s.from === 'adapter' || s.from === 'computer' ? s.from : null
  }
}

/*
 * WHICH ADAPTER GOES WITH WHICH UNIT, kept under its own key so the settings
 * above keep their shape on the disk, as the cable's note does.
 *
 * "The picked unit was FM3, but the connected adapter (WIDI Jack) sits on
 * his AM4" (Justin's reports of 7 November 2026, iPhone): one adapter was
 * kept whatever the unit, so picking the FM3 and tapping Connect connected
 * the AM4's WIDI Jack for it, and Play said "Not answering · FM3" with
 * "Connected over Bluetooth, through WIDI Jack". So each unit keeps its own
 * adapter: picking a unit picks up the adapter kept for it (setBluetoothUnit),
 * or none, and Connect then finds one for it, as the first time. One adapter
 * is on one unit at a time: chosen for one unit, it is let go of by any
 * other. `saved.adapter` stays the one in use, for the unit picked, and
 * this mirrors it.
 */
const ADAPTERS_KEY = 'fractal.bluetooth.adapters'
let byUnit = {}
function keepByUnit() {
  AsyncStorage.setItem(ADAPTERS_KEY, JSON.stringify(byUnit)).catch(() => {
    /* Costs the next launch which adapter is whose, and nothing else. */
  })
}
function settleByUnit(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const key of UNIT_KEYS) {
    const a = s[key]
    if (a && typeof a.id === 'string' && a.id && isAdapter(a)) out[key] = keptAdapter(a)
  }
  return out
}
/* This unit's adapter is now `adapter` (or none): kept for it, and let go of by any other unit it was kept for. */
function keepFor(unit, adapter) {
  if (!unit) return
  const next = { ...byUnit }
  if (adapter) {
    for (const key of Object.keys(next)) if (key !== unit && next[key]?.id === adapter.id) delete next[key]
    next[unit] = keptAdapter(adapter)
  } else delete next[unit]
  if (JSON.stringify(next) === JSON.stringify(byUnit)) return
  byUnit = next
  keepByUnit()
}
/* The ids of the adapters kept for the other units: never chosen for this one by themselves (bleAdapters pickAdapter `taken`). */
const takenIds = () => new Set(Object.entries(byUnit).filter(([key, a]) => key !== saved.unit && a?.id).map(([, a]) => a.id))

/*
 * THE ADAPTER AS IT IS KEPT: its id and name, on an iPhone the driver that
 * owns it, and on Android how it is reached (`transport`, 'usb' for a unit
 * on a USB cable, from the build that lists them), so the next launch
 * judges it as the list does (restoreBluetooth, bleAdapters
 * isNetworkSession and isCable). Without the driver, a port on Apple's
 * Bluetooth or USB driver whose name looks like the network session would
 * be kept by the list and forgotten at every launch, and a unit on a USB
 * cable would be called an adapter at every launch. The two driver names
 * are the real ones since Justin's logs of 27 to 29 October 2026
 * (bleAdapters USB_DRIVER and BLUETOOTH_DRIVER).
 *
 * An adapter kept before 1.89.27 has its id and name only (his AM4 on its
 * cable among them): refreshKeptAdapter, below, fills the rest in from the
 * list the moment it connects.
 */
const keptAdapter = (a) => ({
  id: a.id,
  name: typeof a.name === 'string' ? a.name : '',
  ...(typeof a.driver === 'string' && a.driver ? { driver: a.driver } : {}),
  ...(typeof a.transport === 'string' && a.transport ? { transport: a.transport } : {})
})

/** Whatever was on disk, made safe: storage can hold an older shape, or nonsense. */
function settle(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const adapter = s.adapter && typeof s.adapter.id === 'string' && s.adapter.id ? keptAdapter(s.adapter) : null
  const methods = {}
  for (const key of UNIT_KEYS) {
    if (s.methods?.[key] && typeof s.methods[key] === 'object') methods[key] = perUnit(settleMethods(s.methods[key]))
  }
  const ch = Number(s.pcChannel)
  return {
    on: s.on === true,
    unit: UNIT_KEYS.includes(s.unit) ? s.unit : null,
    adapter,
    pcChannel: Number.isInteger(ch) && ch >= 1 && ch <= 16 ? ch : 1,
    methods
  }
}

/* The wire carries the MIDI number with the rest; on disk it is kept once, for the phone. */
const perUnit = (m) => {
  const { pcChannel: _drop, ...rest } = m || {}
  return rest
}

/* ------------------------------------------------------------------ */
/* The native module                                                   */
/* ------------------------------------------------------------------ */

let native
/** FractalBleMidi, or null in any build that does not carry it. Asked once. */
function ble() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('FractalBleMidi')
  } catch {
    native = null
  }
  return native
}

let supportedAnswer
/**
 * Whether this phone can do Bluetooth (beta) at all: the module is in the
 * build, and the phone has Bluetooth MIDI (not the simulator, not an Android
 * phone without MIDI or Bluetooth LE). False on any doubt, and the card and
 * the page are only shown when it is true.
 */
export function bluetoothSupported() {
  if (supportedAnswer !== undefined) return supportedAnswer
  try {
    supportedAnswer = ble()?.supported?.() === true
  } catch {
    supportedAnswer = false
  }
  return supportedAnswer
}

/** One listener on the module's events; a remover that is safe to call twice. */
export function onAdapter(event, fn) {
  const mod = ble()
  if (!mod?.addListener) return () => {}
  let sub = null
  try {
    sub = mod.addListener(event, fn)
  } catch {
    sub = null
  }
  return () => {
    try {
      sub?.remove?.()
    } catch {
      // Removing twice is not a failure worth reporting.
    }
    sub = null
  }
}

/*
 * WHAT TO ALLOW, IN ANDROID'S OWN WORDS FOR THIS PHONE. Android 12 and newer
 * asks for "Nearby devices". Android 11 and older asks for Location instead
 * (the module asks for what the phone has: FractalBleMidiModule.kt), and
 * finds nothing at all while the phone's Location is switched off, without
 * saying why. Only ever telling an older phone about Nearby devices sent its
 * owner looking for a setting it does not have.
 *
 * AND AN IPHONE'S, now that it can tell (findAdapters, below). There it is
 * one switch, on Fractal Remote's own page in the iPhone's Settings, which
 * is the page the Open Settings button goes to. "The iPhone's Settings" and
 * not just "Settings": this app has a Settings screen of its own, and the
 * line is shown inside it.
 *
 * NO PATH THROUGH THE iPHONE'S MENUS, because iOS 18 moved it. Since then
 * every app's page is under Settings → Apps, and the main list no longer has
 * Fractal Remote in it at all; on iOS 16 and 17, which this app still
 * installs on, the page is in the main list and there is no Apps. The last
 * version of this line picked one path or the other by the version number
 * the phone reported, which is two sentences to keep right for one switch.
 * "Fractal Remote's page" is true on every version, and Open Settings opens
 * exactly that page on every version (Linking.openSettings), so the line
 * leans on the button — and the button is drawn wherever this line is: the
 * Bluetooth page and the waiting screen (App.js).
 *
 * NOT ALLOWED IS NOT BLOCKED. 'restricted' is iOS saying the choice is not
 * this phone's owner's to make here: Screen Time, or a profile from whoever
 * manages the phone (a school or a company). Fractal Remote's own page has
 * no switch that can undo that, so RESTRICTED_WORDS says where the block
 * lives instead, and promises nothing about the app's page — and no Open
 * Settings button is offered for it, because the page it opens cannot help.
 */
const OLD_ANDROID = Platform.OS === 'android' && Number(Platform.Version) < 31
export const ALLOW_WORDS =
  Platform.OS === 'ios'
    ? 'Bluetooth isn’t allowed for Fractal Remote. Tap Open Settings and switch Bluetooth on'
    : OLD_ANDROID
      ? 'Allow Location for Fractal Remote in Android’s settings, and turn Location on'
      : 'Allow Nearby devices for Fractal Remote in Android’s settings'
/*
 * THE DEVICE IN HAND, NOT "THIS iPHONE". An iPad with Bluetooth MIDI opens
 * the page too, now that it is not one man's iPhone, so the words name the
 * device (lib/device-word deviceNoun: phone or iPad here, set by
 * lib/thisDevice before this file loads), the same as the rest of the app.
 */
export const RESTRICTED_WORDS = `Bluetooth is blocked for Fractal Remote on this ${deviceNoun()}, by Screen Time or by whoever manages it, so Fractal Remote can’t turn it on. Look in the ${deviceNoun()}’s Settings → Screen Time → Content & Privacy Restrictions for Bluetooth Sharing, or ask whoever manages the ${deviceNoun()}`

/** The adapters the module can see now. Empty on any trouble. */
export function adapterDevices() {
  try {
    const list = ble()?.devices?.()
    return Array.isArray(list) ? list.filter(isAdapter) : []
  } catch {
    return []
  }
}


/** Connect to one adapter by its id. True when the module says it took. */
export async function connectAdapter(id) {
  const mod = ble()
  if (!mod?.connect) return false
  return (await mod.connect(String(id))) === true
}

/** Let go of the adapter. The module says nothing back: this phone asked for it. */
export function releaseAdapter() {
  try {
    ble()?.disconnect?.()
  } catch {
    // Already gone is gone.
  }
}

/* ------------------------------------------------------------------ */
/* The settings                                                        */
/* ------------------------------------------------------------------ */

/** What is kept, as it is now. Read by bleLink; the page uses useBluetooth. */
export const bluetoothSettings = () => saved

/** Where the link to the adapter stands ('connected', 'connecting', …), for lib/updates.js, which reads it outside a screen. */
export const bluetoothPhase = () => now.phase

/** For bleLink, which owns the link: what is happening, told to the page. */
export function noteBluetooth(patch) {
  /* A new round of the link's tries, or none (bleLink): what the last look heard is not "here" in it (otherAdapterNow). */
  if (patch && 'notThere' in patch && !patch.notThere) lookedThisRound = false
  now = { ...now, ...patch }
  announce()
}

export function subscribeBluetooth(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

const read = () => snapshot
const readOn = () => snapshot.on
const readTrouble = () => snapshot.trouble
const readUnit = () => snapshot.unit ?? null

/** The settings and what is happening now, redrawn whenever either changes. For the Bluetooth page. */
export const useBluetooth = () => useSyncExternalStore(subscribeBluetooth, read, read)

/*
 * ONLY WHETHER IT IS ON, for everything outside the page. The whole snapshot
 * is a new object at every change — each adapter the scan finds, each change
 * to an iPhone's list of MIDI ports once Find has been pressed — and a screen
 * reading it redraws for every one, even with Bluetooth off. A true or false
 * that has not changed redraws nothing.
 */
export const useBluetoothOn = () => useSyncExternalStore(subscribeBluetooth, readOn, readOn)

/** The unit picked on the Bluetooth page ('fm9'), or null: for the tuner, whose quiet line names the unit and its setting. A word, so it redraws only when it changes. */
export const useBluetoothUnit = () => useSyncExternalStore(subscribeBluetooth, readUnit, readUnit)

/** What stands between the phone and the adapter, or null: for the waiting screen. A word, so it redraws only when it changes. */
export const useBluetoothTrouble = () => useSyncExternalStore(subscribeBluetooth, readTrouble, readTrouble)

/*
 * WHO MAY USE IT: JUSTIN'S ACCOUNT ON EVERY COPY, AND EVERYBODY ELSE ONLY ON
 * A COPY BUILT TO OPEN IT.
 *
 * "Is there any way to just get the Bluetooth on the developers mode for my
 * own phone? I just feel like it's not ready to have public." (11 October
 * 2026.) The day before, it had gone out as a public beta for everybody who
 * had unlocked the app. From then the Settings row and the page were drawn
 * only for the account that opens his Developer pages (isAdmin, lib/
 * admin.js). Then, 25 October: it has worked from an iPhone and from an
 * Android phone, and it is to reach customers in the next store version.
 *
 * So the answer is the rule in ble-rule.js (bluetoothOpen): his account,
 * yes, everywhere; anybody else, yes only when the version BUILT INTO THIS
 * COPY (lib/storeVersion installedStoreVersion, read once, below) is at or
 * above the store version that opens it, which is null on both phones until
 * the build pull request sets it. Every copy that exists today says no to a
 * customer. And this is the switch's half: for anybody it says no to,
 * Bluetooth goes off and STAYS off. setBluetooth will not turn it on, and
 * the pick-up from last time will not either, so a customer who turned it
 * on during that one public day is put back on the computer at their next
 * launch, with the unit and the adapter they chose still kept for the day
 * it opens.
 *
 * AND A CUSTOMER GETS THE UNITS THIS COPY OPENS (ble-rule.js
 * UNITS_FROM_STORE): all five on the store version that opens Bluetooth,
 * each keyed to that version, so a unit added later reaches only the copies
 * built to open it. The page offers them (offeredUnits), and Connect and
 * the pick-up refuse any other. A unit kept from before that they are not
 * offered (one the page offers later, picked on a copy that opens it) is
 * CLEARED, on disk too, but only where Bluetooth is open to the account
 * signed in, where the page would otherwise show it under chips without
 * it. On a copy that keeps it closed it is kept as it was, because nothing
 * can use it there anyway, and clearing it would buy nothing. His account
 * keeps every unit the page knows.
 *
 * Asked by App.js, with the id of THE SESSION KEPT ON THE PHONE (haveSession),
 * never currentAccount(): that one asks the account server over the
 * internet, and with no signal at a gig it answers nobody, which would switch
 * his own Bluetooth off exactly where it is for. Asked at launch, before the
 * link starts, and again whenever who is signed in can have changed: signing
 * in, signing out, another account, the demo ending.
 *
 * THREE ANSWERS, NOT TWO. Yes is his account's id. No is ANOTHER REAL
 * ACCOUNT'S id, or a sign-out somebody asked for (Sign out, Delete account,
 * the paywall's way back and its demo, heading for the sign-in screen: App.js
 * says so with `signedOut`). Anything else is NOT KNOWN — no session on the
 * phone, or an id that is not an account's — and not known is not a no:
 *
 *   - yes: on, if it was on last time (the pick-up holds it until now);
 *   - no: off, and the off written down, unit and adapter kept;
 *   - not known: off for now, in memory only. The phone's storage still says
 *     on, so his phone that lost its sign-in without him asking is back on
 *     Bluetooth at the next launch that knows it is his.
 *
 * A sign-in that ran out at a gig with no signal to renew it is not one of
 * those any more: haveSession answers with its id (relay.js keptSession),
 * so his is a yes there, as it should be, and nothing here treats it apart.
 * No session now means none on the phone at all: one the account service
 * turned away, or a phone that could not read its own.
 *
 * Whichever of the pick-up and the answer lands first, Bluetooth is on only
 * once the answer is yes.
 *
 * HIDING, NOT A LOCK, and it never needs to be one: over Bluetooth the phone
 * talks to the player's own unit and nothing else, so there is no server to
 * keep anybody out of. What it decides is who is shown a feature that is not
 * finished. And nothing in here touches the native module for anybody it
 * says no to: no Bluetooth question is ever put to a customer's phone.
 *
 * NOT TO BE OPENED TO CUSTOMERS BY AN UPDATE. Switching it on for everybody
 * is a new store version whose review notes say so, never an over-the-air
 * update (CLAUDE.md says why: Apple's 2.5.19, 2.3.1(a) and its licence
 * 3.3.1(C), and Google's rule on features activated remotely). Which is why
 * the copy decides it, by a number no update can change, and never the
 * account or anything an update sends.
 */
let allowed = null
const readAllowed = () => allowed
/* Whether the account signed in here is his, so every unit is offered: false for anybody else, and for nobody known. */
let allUnits = false

/* Whether this account is offered this unit on this copy (ble-rule.js unitOffered): his, every unit; anybody else's, the units this copy's built-in version opens. */
const offered = (unit) => unitOffered(unit, { admin: allUnits, platform: Platform.OS, installed: builtInVersion() })

/*
 * THE VERSION BUILT INTO THIS COPY, read once (lib/storeVersion: the app
 * config inside the binary, which an update never touches). Never
 * APP_VERSION or expoConfig, which are the update's number. Null when the
 * copy cannot say, and the rule takes null as closed.
 */
let installed
export const builtInVersion = () => {
  if (installed === undefined) installed = installedStoreVersion()
  return installed
}

/**
 * Whether Edit opens over Bluetooth on the unit picked, for the account
 * signed in here, on this copy (ble-rule.js editOffered): his account on a
 * unit whose editing is built; anybody else's on a copy whose built-in
 * version opens it. Asked by the wire at every request and by Play's Edit
 * button, never kept, so it goes the moment the account does.
 */
export const editOverBluetooth = (unit = saved.unit) =>
  allowed === true && editOffered(unit, { admin: allUnits, platform: Platform.OS, installed: builtInVersion() })

/** Whether this copy opens Bluetooth (beta) to customers, whoever is signed in: the log's head, and the purchase page. */
export const openForCustomersHere = () => bluetoothOpen({ platform: Platform.OS, installed: builtInVersion(), admin: false })

const OFF_FOR_OTHERS = 'Bluetooth is not open to this account in this version of the app, so it is off'

/* On or off for now, in memory only: the switch, the page, the redraw. Nothing written to the phone's storage. */
function holdOn(on) {
  saved = { ...saved, on }
  setSwitch({ on })
  now = { ...now, phase: on ? 'idle' : 'off' }
  announce()
}

/**
 * For App.js: the id of the session kept on this phone, or nothing when
 * nobody is signed in. `signedOut` when somebody has just signed out, so the
 * off is written down rather than held (see THREE ANSWERS, above).
 */
export function allowBluetooth(id, { signedOut = false } = {}) {
  const was = allowed
  const wasAll = allUnits
  allowed = accountId(id) ? bluetoothOpen({ platform: Platform.OS, installed: builtInVersion(), admin: isAdmin(id) }) : null
  allUnits = allowed !== null && isAdmin(id)
  /* A unit kept from before that this account is not offered: let go below, only where Bluetooth is open to it (see AND A CUSTOMER GETS THE UNITS THIS COPY OPENS). */
  const drop = allowed === true && !!saved.unit && !offered(saved.unit)
  if (allowed === true) {
    /* On last time, and open to this account: on now, as the pick-up would have, and nothing to write — the disk already says on. */
    if (pendingOn) {
      pendingOn = false
      if (!saved.on && saved.unit && !drop && bluetoothSupported()) {
        logDebug('ble', `Bluetooth is on, for the ${unitName(saved.unit)}`)
        holdOn(true)
      }
    }
  } else if (allowed === false || signedOut) {
    if (saved.on || pendingOn) {
      logDebug('ble', OFF_FOR_OTHERS)
      setBluetooth(false)
    }
  } else if (saved.on) {
    /* Not known: off for now, and still on on disk, for the next answer that is his. */
    logDebug('ble', 'Bluetooth is off until this phone knows whose account it is')
    pendingOn = true
    holdOn(false)
  }
  if (drop) letGoOfUnit()
  if (allowed !== was || allUnits !== wasAll) announce()
  return allowed === true
}

/* The unit kept is one this account is not offered: Bluetooth off if it was on with it, and the unit forgotten, on disk too. */
function letGoOfUnit() {
  if (saved.on) setBluetooth(false)
  logDebug('ble', `the ${unitName(saved.unit)} is not offered over Bluetooth to this account: the unit is cleared`)
  saved = { ...saved, unit: null }
  keep()
  announce()
}

/** Whether the account signed in here may use Bluetooth (beta): true only once App.js has said yes. */
export const bluetoothAllowed = () => allowed === true

/** The units the page offers this account, in the page's order: every unit the page knows for his, the ones this copy opens for a customer. */
export const offeredUnits = () => BLE_UNITS.filter((u) => offered(u.key))

/** The same, redrawn when it changes: for the Settings row and the page, which appear and go with signing in. */
export const useBluetoothAllowed = () => useSyncExternalStore(subscribeBluetooth, readAllowed, readAllowed) === true

/**
 * Whether the account signed in here is his (isAdmin of the sign-in kept on
 * the phone): every unit, and the full version as mayDrive reads it
 * (unlock-rule mayDriveBluetooth). False for anybody else, and for nobody known.
 */
export const bluetoothAdmin = () => allUnits
const readAdmin = () => allUnits
/** The same, redrawn when it changes: for the gate over the row, the page and Connect. */
export const useBluetoothAdmin = () => useSyncExternalStore(subscribeBluetooth, readAdmin, readAdmin) === true

/**
 * Pick the settings up from last time.
 *
 * ON ONLY WHERE IT CAN WORK. A phone that had it on and is now running a
 * build without the module (Expo Go, or a store build from before the module
 * went into one) comes back with it OFF, whatever the disk says: otherwise
 * every request would be refused by a Bluetooth wire that can never connect,
 * and the app would be dead. The module is not asked anything unless the
 * disk says the mode was on.
 *
 * And on only once the answer is yes (see allowBluetooth). A no that is
 * already in turns it off and writes the off back, as Stop would. With no
 * answer yet — the ordinary case, since App.js asks a moment after this
 * starts — it is held: off for now, nothing written, and the yes switches it
 * on, before the link starts. Nothing is asked of the module while it is
 * held, so a phone that turns out not to be his has been asked nothing.
 */
export async function restoreBluetooth() {
  const before = JSON.stringify(saved)
  let refused = false
  let dropped = null
  let session = null
  try {
    const memo = await AsyncStorage.getItem(CABLE_KEY)
    beforeCable = settleBeforeCable(memo ? JSON.parse(memo) : null)
  } catch {
    beforeCable = { ...NO_CABLE_MEMO }
  }
  let kept = null
  try {
    const memo = await AsyncStorage.getItem(ADAPTERS_KEY)
    kept = memo ? JSON.parse(memo) : null
  } catch {
    kept = null
  }
  byUnit = settleByUnit(kept)
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const was = settle(raw ? JSON.parse(raw) : null)
    /* A unit this account is not offered, with Bluetooth already open to it: let go of, and the disk told (see allowBluetooth). */
    dropped = allowed === true && was.unit && !offered(was.unit) ? was.unit : null
    /*
     * APPLE'S NETWORK SESSION, KEPT AS THE ADAPTER: forgotten, and the disk
     * told. Before the 2 November 2026 audit an iPhone in another language
     * could pick "Rețea Session 1" by itself (bleAdapters isNetworkSession),
     * and it stayed the adapter at every launch after, with the page saying
     * the unit was not answering. Forgotten, the page says there is no
     * adapter yet, and Connect goes looking for the real one.
     */
    session = was.adapter && isNetworkSession(was.adapter) ? was.adapter : null
    refused = was.on && allowed === false
    pendingOn = was.on && !!was.unit && allowed === null
    saved = { ...was, unit: dropped ? null : was.unit, on: was.on && !!was.unit && !dropped && allowed === true && bluetoothSupported() }
    if (session) saved = { ...saved, adapter: null }
  } catch {
    pendingOn = false
    saved = { ...SAVED }
  }
  /*
   * The adapter in use is the unit's own (WHICH ADAPTER GOES WITH WHICH
   * UNIT): one kept before the adapters were kept per unit is written down
   * for its unit here, the first launch after.
   */
  if (saved.unit) keepFor(saved.unit, saved.adapter)
  setSwitch({ on: saved.on })
  if (refused) logDebug('ble', OFF_FOR_OTHERS)
  if (dropped) logDebug('ble', `the ${unitName(dropped)} is not offered over Bluetooth to this account: the unit is cleared`)
  if (session) logDebug('ble', `the adapter kept from last time, ${adapterName(session) || 'with no name'}, is Apple’s network session, not an adapter: forgotten`)
  if (refused || dropped || session) keep()
  if (pendingOn) logDebug('ble', 'Bluetooth was on last time: off until this phone knows whose account it is')
  /* Nothing on disk is the ordinary case, and it changes nothing: no screen is redrawn for it. */
  if (JSON.stringify(saved) === before) return saved.on
  now = { ...now, phase: saved.on ? 'idle' : 'off' }
  if (saved.on) logDebug('ble', `Bluetooth is on, for the ${unitName(saved.unit)}`)
  announce()
  return saved.on
}

/** The unit's name as the page writes it. */
export const unitName = (key) => BLE_UNITS.find((u) => u.key === key)?.name || 'unit'

/**
 * Turn Bluetooth (beta) on or off.
 *
 * Not on without a unit: see SAVED. Not on for an account it is not open to,
 * nor before App.js has said whose phone this is, nor with a unit this
 * account is not offered: see allowBluetooth. Off is always allowed. The
 * switch moves at once, so from this moment nothing goes to the computer
 * while it is on; App.js sees the change and restarts the link, which is
 * what connects (bleLink.js).
 */
export function setBluetooth(on) {
  const want = on === true && allowed === true && !!saved.unit && offered(saved.unit) && bluetoothSupported()
  /* Off asked for in so many words: an on held for an answer goes too, and the disk is told. */
  if (on !== true && pendingOn) {
    pendingOn = false
    if (!saved.on) {
      keep()
      return false
    }
  }
  if (want === saved.on) return saved.on
  /* On with a cable kept: it took over from the computer (WHAT A USB CABLE TOOK OVER FROM). */
  if (want && saved.adapter && isCable(saved.adapter) && beforeCable.from !== 'computer') {
    beforeCable = { ...beforeCable, from: 'computer' }
    keepBeforeCable()
  }
  saved = { ...saved, on: want }
  setSwitch({ on: want })
  now = { ...now, phase: want ? 'idle' : 'off' }
  logDebug('ble', want ? `Bluetooth turned on, for the ${unitName(saved.unit)}` : 'Bluetooth turned off')
  keep()
  announce()
  return want
}

/**
 * Which unit is on the other end, from those this account is offered.
 * Changing it while connected asks the new one everything (bleLink).
 *
 * AND ITS OWN ADAPTER WITH IT (WHICH ADAPTER GOES WITH WHICH UNIT): the one
 * kept for that unit, or none, so Connect finds one for it rather than
 * using another unit's. An adapter kept with no unit at all goes to the
 * first one picked, as it always did. `carry`: the adapter in use is on the
 * new unit, proven by its answer (the page's Switch to, when the unit that
 * answered is not the one picked), so it goes with it and is let go of by
 * the unit it was kept for.
 */
export function setBluetoothUnit(key, { carry = false } = {}) {
  if (!UNIT_KEYS.includes(key) || !offered(key) || key === saved.unit) return saved.unit
  const was = saved.unit
  const using = saved.adapter
  /* The unit left keeps the adapter it was using, for when it is picked again. */
  if (was && using && !carry) keepFor(was, using)
  const adapter = (carry || !was) && using ? using : byUnit[key] || null
  saved = { ...saved, unit: key, adapter: adapter ? keptAdapter(adapter) : null }
  logDebug('ble', `the unit is an ${unitName(key)}`)
  if (carry && using) logDebug('ble', `${adapterName(using) || 'the adapter'} is on the ${unitName(key)}: it is the ${unitName(key)}’s adapter now`)
  else if (was && (using || adapter)) logDebug('ble', adapter ? `the ${unitName(key)}’s own adapter: ${adapterName(adapter) || 'the one kept for it'}` : `no adapter kept for the ${unitName(key)} yet: Connect finds one`)
  keepFor(key, saved.adapter)
  keep()
  announce()
  return key
}

/** The unit another adapter is kept for, by its id, or null: the page's list says whose it is. */
export function adapterKeptFor(id) {
  for (const [key, a] of Object.entries(byUnit)) if (key !== saved.unit && a?.id === id) return key
  return null
}

/** The adapters kept for the other units, { unit, adapter }, in the page's order of units: Troubleshooting lists them, each with its Forget. */
export const adaptersForOtherUnits = () =>
  UNIT_KEYS.filter((key) => key !== saved.unit && byUnit[key]).map((unit) => ({ unit, adapter: byUnit[unit] }))

/** Forget the adapter kept for another unit (Troubleshooting): on the phone's storage too. The unit picked keeps its own Forget the adapter. True when it forgot one. */
export function forgetAdapterFor(unit) {
  if (!unit || unit === saved.unit || !byUnit[unit]) return false
  logDebug('ble', `the ${unitName(unit)}’s adapter, ${adapterName(byUnit[unit]) || 'with no name'}, forgotten`)
  keepFor(unit, null)
  announce()
  return true
}

/** Use this adapter from now on. bleLink hears the change and connects to it. */
export function chooseAdapter(dev) {
  if (!dev || typeof dev.id !== 'string' || !dev.id) return
  /* Never Apple's network session, whoever asks (bleAdapters isNetworkSession). */
  if (!isAdapter(dev)) return
  letGo.delete(dev.id)
  if (saved.adapter?.id === dev.id) return
  noteBeforeCable(dev)
  saved = { ...saved, adapter: keptAdapter(dev) }
  /* The unit picked's own, from now on, and no other unit's (WHICH ADAPTER GOES WITH WHICH UNIT). */
  keepFor(saved.unit, saved.adapter)
  logDebug('ble', isCable(dev) ? `USB cable chosen: ${adapterName(dev) || 'a unit with no name'}` : `adapter chosen: ${adapterName(dev) || 'an adapter with no name'}`)
  keep()
  /*
   * A note from the search is about the search (it did not start, Apple's
   * screen stayed shut), and an adapter chosen is the end of it: left up,
   * it sat under "Connected" for the rest of the session.
   */
  if (now.said) noteBluetooth({ said: null })
  else announce()
}

/*
 * A CABLE TAKING THE ADAPTER'S PLACE notes what it took over from (WHAT A
 * USB CABLE TOOK OVER FROM): the Bluetooth adapter kept before it, and
 * whether Bluetooth was on through it or off (the computer). A cable after
 * a cable keeps the adapter from before the first. A Bluetooth adapter
 * chosen is the one kept now, and the note goes.
 */
function noteBeforeCable(dev) {
  const was = saved.adapter
  let next
  if (!isCable(dev)) next = { ...NO_CABLE_MEMO }
  else if (was && !isCable(was)) next = { adapter: keptAdapter(was), unit: saved.unit, from: saved.on ? 'adapter' : 'computer' }
  else next = { ...beforeCable, from: saved.on && was ? beforeCable.from || 'computer' : 'computer' }
  if (JSON.stringify(next) === JSON.stringify(beforeCable)) return
  beforeCable = next
  keepBeforeCable()
}

/**
 * THE BLUETOOTH ADAPTER KEPT BEFORE THE USB CABLE, for the unit picked now,
 * or null: never for another unit (an adapter on the FM3 is not the AM4's
 * way back), nor one this account is not offered.
 */
export function adapterBeforeCable() {
  const a = beforeCable.adapter
  if (!a || !saved.unit || beforeCable.unit !== saved.unit || !offered(saved.unit)) return null
  return a
}

/**
 * THE USB CABLE STAYED UNPLUGGED (lib/cablePlugIn, after a few seconds):
 * back the way it was connected before the cable took over. Through a
 * Bluetooth adapter, that adapter, with Bluetooth left on (bleLink hears it
 * and connects); through the computer, or with nothing noted, Bluetooth off,
 * and App.js starts looking for the computer, whose waiting screen offers
 * every way there is when it is not there. The cable stays kept while it is
 * the computer, so plugging it back in is offered or taken again
 * (lib/cablePlugIn). Null when it is not on a cable now.
 */
export function leaveCable() {
  const a = saved.adapter
  if (!saved.on || !a || !isCable(a)) return null
  const back = beforeCable.from === 'adapter' ? adapterBeforeCable() : null
  if (back) {
    logDebug('ble', `the USB cable stayed unplugged: back to ${adapterName(back) || 'the Bluetooth adapter'}, as it was connected before the cable`)
    chooseAdapter(back)
    return { to: 'adapter', name: adapterName(back) }
  }
  logDebug('ble', 'the USB cable stayed unplugged: back to the computer, as it was connected before the cable')
  setBluetooth(false)
  return { to: 'computer', name: null }
}

/**
 * A BLUETOOTH ADAPTER INSTEAD OF THE USB CABLE KEPT: the page's Connect with
 * the cable not plugged in, its "Use a Bluetooth adapter instead", and the
 * same button in the Live pill's note and on the waiting screen.
 *
 * The adapter kept before the cable, when there is one for this unit, is
 * chosen again (Bluetooth left as it is: on, the link moves to it; off, the
 * caller turns it on). With none, the cable is forgotten and Bluetooth goes
 * off, so the page's Connect looks for an adapter as it does the first time
 * (findAdapters). `byHand`: asked for in so many words, with the cable maybe
 * still in, so it is let go of as Forget the USB cable lets go of one (Connect
 * and lib/cablePlugIn leave it alone this session); Connect with the cable
 * unplugged does not, so plugging it in is still offered. Returns the adapter
 * chosen, or null.
 */
export function adapterInsteadOfCable({ byHand = false } = {}) {
  const a = saved.adapter
  if (!a || !isCable(a)) return null
  if (byHand) letGo.add(a.id)
  const back = adapterBeforeCable()
  if (back) {
    logDebug('ble', `a Bluetooth adapter instead of the USB cable: ${adapterName(back) || 'the adapter'}, from before the cable`)
    chooseAdapter(back)
    return back
  }
  logDebug('ble', 'a Bluetooth adapter instead of the USB cable: none from before, so Connect looks for one')
  if (saved.on) setBluetooth(false)
  forgetAdapter()
  return null
}

/**
 * WHAT THE ADAPTER KEPT IS, FILLED IN FROM THE LIST: its driver (iPhone) and
 * its transport (Android), copied from the entry with its id, when either
 * differs. For an adapter kept before 1.89.27 as its id and name alone,
 * such as his AM4 on its USB cable, which every line then called a
 * Bluetooth adapter. Asked by bleLink as it connects; the id is the same,
 * so the link does not take it for another adapter (settingsMoved). True
 * when it changed anything.
 */
export function refreshKeptAdapter() {
  const a = saved.adapter
  if (!a) return false
  const live = adapterDevices().find((d) => d.id === a.id)
  if (!live) return false
  const driver = typeof live.driver === 'string' && live.driver ? live.driver : a.driver
  const transport = typeof live.transport === 'string' && live.transport ? live.transport : a.transport
  if (driver === a.driver && transport === a.transport) return false
  saved = { ...saved, adapter: keptAdapter({ ...a, driver, transport }) }
  keepFor(saved.unit, saved.adapter)
  if (isCable(saved.adapter)) logDebug('ble', `the ${adapterName(saved.adapter) || 'unit'} kept from last time is on a USB cable`)
  keep()
  announce()
  return true
}

/** Whether the adapter kept is a unit on a USB cable (bleAdapters isCable), for every line that says how it is connected. */
export const cableNow = () => !!saved.adapter && isCable(saved.adapter)
/**
 * A USB MIDI cable on the unit's MIDI jacks (a C2MIDI Pro straight into the
 * phone), not the unit itself on its own USB cable: its port is named for no
 * unit (bleAdapters onMidiJacks). Its MIDI plugs can be swapped, so where a
 * line is about what to check, it keeps the plug checks.
 */
export const midiJacks = (a) => onMidiJacks(a, BLE_UNITS)
const readJacks = () => !!snapshot.adapter && midiJacks(snapshot.adapter)
/** The same for the adapter kept, redrawn when it changes: Phone & computer's cards. */
export const useMidiJacks = () => useSyncExternalStore(subscribeBluetooth, readJacks, readJacks)

/*
 * WHETHER A UNIT CAN PLUG INTO THIS COPY BY USB CABLE AT ALL. An iPhone or
 * iPad always could (its module lists every two-way MIDI port). Android only
 * from the build that carries docs/pending/android-usb-midi.patch, which
 * says so (listsUsb); until then no cable lists on Android, so nothing on it
 * says anything about one, the FM3's line included.
 */
export function cablesHere() {
  if (Platform.OS === 'ios') return true
  try {
    return ble()?.listsUsb?.() === true
  } catch {
    return false
  }
}

/* What Connect's cable rule is told: the unit picked, the units there are, and the cables let go of by hand (bleAdapters cablesFirst). */
const cableRule = () => ({ unit: saved.unit, units: BLE_UNITS, skip: letGo })
/*
 * What the phone's own pick is told (bleAdapters pickAdapter): the same, and
 * for an FM3 the adapters never offered for one (neverOnFm3), which are
 * listed for a tap but never chosen by themselves: the search's only one
 * found, Apple's screen's one just connected, or the iPhone's list.
 */
const pickRule = () => ({ ...cableRule(), refused: saved.unit === 'fm3' ? neverOnFm3 : null, taken: takenIds() })

/** The cables a tap on Connect would take straight away now, from a list already read (bleAdapters cablesFirst): the page's hint says the same as Connect does. */
export const cablesConnectTakes = (list) => cablesFirst(list, cableRule())
const readCable = () => !!snapshot.adapter && isCable(snapshot.adapter)
/** The same, redrawn when it changes: for the Live pill, Settings and the waiting screen. A true or false, so it redraws only when it changes. */
export const useCableNow = () => useSyncExternalStore(subscribeBluetooth, readCable, readCable)

/*
 * THE ADAPTER BY ITS NAME, NEVER ITS ADDRESS, in anything the log keeps. On
 * Android the module falls back to the adapter's Bluetooth address when it
 * has no name (FractalBleMidiModule.kt), and a log goes out with every
 * report. Null when all there is is the address, or nothing.
 */
export const adapterName = (a) => (a && typeof a.name === 'string' && a.name && a.name !== a.id ? a.name : null)

/**
 * WHAT A BLUETOOTH REPORT'S LOG SAYS ABOUT IT, in its head (lib/logHead, by
 * lib/bleReport bluetoothHead): the unit picked on the page, the unit that
 * answered instead, where the link stands and what is in its way, and the
 * adapter, by its name or '' for one with none, never its id. Null for no
 * adapter chosen. Read when the report is sent, and at no other moment.
 */
export const bluetoothFacts = () => ({
  /* "VP4 (not tried yet)" for a unit nobody has tried it on (shared/bluetooth-gear unitForReport), so the report says so where it is read first. */
  unit: saved.unit ? unitForReport(saved.unit) || unitName(saved.unit) : null,
  answeredAs: now.answeredAs || null,
  phase: now.phase,
  trouble: now.trouble,
  adapter: saved.adapter ? adapterName(saved.adapter) || '' : null,
  /* A unit on a USB cable, not a Bluetooth adapter (bleAdapters isCable): the head says so (lib/logHead, lib/bleReport). */
  cable: !!saved.adapter && isCable(saved.adapter),
  /*
   * How each command goes to the unit picked: what auto found
   * (methodsFor(unit).learned), any way forced in the testing tools, and the
   * Program Change channel. Not for an AM4, which has one way for everything
   * and never learns one (its routes go to am4* handlers, and the page hides
   * How each command is sent for it): its head said "none found yet" on
   * every report, which reads as something the app failed to find, and the
   * Program Change channel moved for a Gen 3 unit, which an AM4 never sends.
   * Nor for a VP4, which has one way for each (bleVp4.js) and takes its MIDI
   * channel from Settings → VP4 scenes & presets, not from here.
   */
  ways: saved.unit && saved.unit !== 'am4' && saved.unit !== 'vp4' ? waysFor(saved.unit) : null
})

/* The ways, for the log's head: only what has been found or forced, so a unit nothing has been learned on says so (bleReport waysLine). */
function waysFor(unit) {
  const m = methodsFor(unit)
  const forced = Object.fromEntries(Object.keys(WAYS).filter((k) => m[k] !== 'auto').map((k) => [k, m[k]]))
  return { learned: { ...m.learned }, forced, pcChannel: m.pcChannel }
}

/** Forget the adapter. bleLink hears it and lets go. */
/*
 * CABLES LET GO OF BY HAND, this session: Troubleshooting's Forget the USB
 * cable. Connect does not take one of these straight away (bleAdapters
 * cablesFirst), so with the cable still in, the next Connect opens Apple's
 * screen (or Android's search) and a Bluetooth adapter can be paired. Chosen
 * again (a tap in the list, or the only port after Apple's screen), it is
 * taken off. In memory only: a launch starts with none.
 */
const letGo = new Set()

/** `byHand`: the player's own Forget, not the page making room for another (see letGo). */
export function forgetAdapter({ byHand = false } = {}) {
  if (!saved.adapter) return
  if (byHand && isCable(saved.adapter)) letGo.add(saved.adapter.id)
  saved = { ...saved, adapter: null }
  keepFor(saved.unit, null)
  logDebug('ble', 'adapter forgotten')
  keep()
  announce()
}

/**
 * USE A DIFFERENT ADAPTER: the Bluetooth page's button of that name, and
 * Troubleshooting's Forget the adapter.
 *
 * "Where is the button to change Bluetooth adapters. I have a widi jack
 * connected" (Justin, 3 November 2026, Android). The link tried the WIDI
 * Master kept from last time for ever, Stop and Connect went straight back
 * to it, and the only way to another was Forget the adapter, under
 * Troubleshooting, drawn only with Bluetooth off.
 *
 * So, with it on or off: Bluetooth off first if it is on with the adapter
 * kept, which stops the link trying it (App.js stops the link; bleLink lets
 * go of it), then the adapter forgotten, on the phone's storage too. The
 * page then does what Connect does the first time (findAdapters: Android's
 * search and its list, Apple's screen on an iPhone), and Bluetooth comes on
 * with the one chosen there. Nothing is sent to any unit here.
 *
 * Never for a unit on a USB cable, whose Forget the USB cable is its own
 * (forgetAdapter with `byHand`). True when it let one go.
 */
export function letGoOfKeptAdapter() {
  const a = saved.adapter
  if (!a || isCable(a)) return false
  if (saved.on) setBluetooth(false)
  logDebug('ble', `a different adapter is wanted: ${adapterName(a) || 'the adapter from last time'} is let go of`)
  forgetAdapter()
  return true
}

/**
 * SWITCH TO ANOTHER ADAPTER THE PHONE CAN SEE, on the player's tap only (the
 * page's "Use WIDI Jack Bluetooth", otherAdapterNow): the one kept is
 * forgotten and this one chosen, exactly as a tap in the search list chooses
 * one (chooseAdapter), and the link, which is trying the one kept, lets it
 * go and connects to this one (bleLink settingsMoved). Never a cable, never
 * the one kept, and for an FM3 only an adapter the app names for one
 * (namedForFm3: the WIDI Uhost, never one neverOnFm3 refuses). True when it
 * switched.
 */
export function switchAdapter(dev) {
  const a = saved.adapter
  if (!a || isCable(a) || !dev || !isAdapter(dev) || isCable(dev) || dev.id === a.id) return false
  if (saved.unit === 'fm3' && !namedForFm3(dev.name)) return false
  logDebug('ble', `switching from ${adapterName(a) || 'the adapter from last time'} to ${adapterName(dev) || 'an adapter with no name'}, as asked`)
  chooseAdapter(dev)
  return true
}

/** Whether this cable was let go of by hand this session (see CABLES LET GO OF BY HAND): lib/cablePlugIn never offers or takes one. */
export const cableLetGo = (id) => letGo.has(id)

/** Whether this account may use this unit over Bluetooth on this copy now: open to it, and the unit offered (ble-rule unitOffered). For lib/cablePlugIn. */
export const unitOfferedNow = (key) => allowed === true && offered(key)

/**
 * USE THE USB CABLE JUST PLUGGED IN (lib/cablePlugIn): Play's Use USB cable,
 * and the switch it makes by itself from a Bluetooth adapter. The same end
 * as Settings → Bluetooth → Connect with the cable in: the unit it is for
 * picked (setBluetoothUnit, only one this account is offered), the cable
 * chosen (chooseAdapter), and Bluetooth on (setBluetooth). bleLink hears it
 * and connects; App.js restarts the link if Bluetooth was off. A cable let go
 * of by hand is never taken here. True when Bluetooth is on with it.
 */
export function takeCable(dev, unit) {
  if (!dev || !isCable(dev) || !isAdapter(dev) || letGo.has(dev.id)) return false
  if (unit && unit !== saved.unit && setBluetoothUnit(unit) !== unit) return false
  if (!saved.unit || !offered(saved.unit)) return false
  chooseAdapter(dev)
  return setBluetooth(true)
}

/* What auto learned, kept for the unit it was learned on. */
function rememberMethods(unit, m) {
  if (!UNIT_KEYS.includes(unit)) return
  const ch = Number(m?.pcChannel)
  saved = {
    ...saved,
    pcChannel: Number.isInteger(ch) && ch >= 1 && ch <= 16 ? ch : saved.pcChannel,
    methods: { ...saved.methods, [unit]: perUnit(m) }
  }
  keep()
  announce()
}

/** How each command is sent for this unit, with the phone's MIDI number. */
export const methodsFor = (unit) => settleMethods({ ...(saved.methods[unit] || {}), pcChannel: saved.pcChannel })

/** The check panel's choices: through the wire when there is one, so it uses them at once. */
export function setMethods(patch) {
  const unit = saved.unit
  if (!unit) return null
  if (wire && wire.unit === unit) return wire.setMethods(patch)
  const next = settleMethods({ ...methodsFor(unit), ...patch })
  rememberMethods(unit, next)
  return next
}

/* ------------------------------------------------------------------ */
/* Finding the adapter                                                 */
/* ------------------------------------------------------------------ */

let listing = null
let fresh = new Set()
let lookTimer = null

/* Newly found first, so the one that was just paired is the one at the top. */
function showList(list) {
  const rows = (Array.isArray(list) ? list : []).filter(isAdapter)
  rows.sort((a, b) => Number(fresh.has(b.id)) - Number(fresh.has(a.id)))
  noteBluetooth({ devices: rows.map((d) => ({ ...d, fresh: fresh.has(d.id) })) })
}

function listenForList() {
  if (listing) return
  listing = onAdapter('onDevices', (e) => {
    showList(e?.devices)
    tookAfterScreen(e?.devices)
  })
}

/*
 * A PORT THAT TURNS UP NEW JUST AFTER APPLE'S SCREEN CLOSED (iPhone), with
 * nothing chosen there: chosen as it would have been at Done, by the same
 * rule (pickAdapter, the FM3's refusals and another unit's adapter
 * included). For AFTER_SCREEN_MS after Done, and once.
 */
const AFTER_SCREEN_MS = 4000
let afterScreen = null
function tookAfterScreen(devices) {
  const a = afterScreen
  if (!a) return
  if (Date.now() > a.until) {
    afterScreen = null
    return
  }
  const list = (Array.isArray(devices) ? devices : []).filter(isAdapter)
  const just = new Set(list.map((d) => d.id).filter((id) => !a.before.has(id)))
  if (!just.size) return
  const pick = pickAdapter(list, just, pickRule())
  if (!pick || !just.has(pick.id)) return
  afterScreen = null
  fresh = just
  showList(list)
  logDebug('ble', `${adapterName(pick) || 'an adapter'} came into Apple’s list a moment after its screen closed: chosen`)
  chooseAdapter(pick)
}

/**
 * Whether Connect keeps Apple's Bluetooth screen shut on this iPhone
 * (bleAdapters pairScreenCrashes): iOS 27, in a build without Apple's fix.
 * The build is asked if it can say, as authorization is, and no answer is a
 * build without the fix. The page reads it for its hints, so they never
 * send anybody to a screen that will not open.
 */
export function pairScreenShut() {
  if (Platform.OS !== 'ios') return false
  let fixed = false
  try {
    fixed = ble()?.pairsOnIOS27?.() === true
  } catch {
    fixed = false
  }
  return pairScreenCrashes({ os: Platform.OS, version: Platform.Version, fixed })
}

/**
 * Look for the adapter.
 *
 * A unit on a USB cable first, on either phone: plugged in now, it is used
 * with nothing about Bluetooth asked (see A UNIT ON A USB CABLE FIRST).
 *
 * iPhone: Apple's own Bluetooth MIDI screen, the only way an app can pair
 * one. What is listed after Done that was not there before is the adapter
 * just paired, and goes first. Android: ask for "Nearby devices", then scan
 * for ten seconds; what is found arrives while it looks.
 *
 * When only one adapter could be meant it is chosen here (pickAdapter), and
 * on an iPhone the promise resolves to it; otherwise to nothing, and the list
 * on the page asks. For an FM3, never one of the adapters never offered for
 * it (pickRule): that one is listed, for a tap.
 */
export async function findAdapters({ cableFirst = true } = {}) {
  const mod = ble()
  if (!mod) return
  listenForList()
  /* A new Connect: a wait for Bluetooth from the last one ends, and this one says afresh what it finds. */
  stopWaitingForBluetooth()
  afterScreen = null
  noteBluetooth({ trouble: null, said: null })
  /*
   * A UNIT ON A USB CABLE FIRST, before anything about Bluetooth. "I've
   * already used my iPhone and it does connect. It just says it's a
   * Bluetooth connection and not USB, even though it is USB." (Justin, 3
   * November 2026.) Connect opened Apple's Bluetooth screen for it, with
   * Bluetooth off, and the AM4 was picked only after Done because it was the
   * one port there. A cable needs no Bluetooth, no permission and no screen,
   * so with one plugged in now (bleAdapters cablesIn) none of them is asked:
   * one is chosen straight away, and two or more are listed for the page to
   * ask. A Bluetooth permission refused, or Bluetooth switched off, never
   * stands in its way. With none, everything below goes on as before.
   *
   * Only when nothing else could be meant (bleAdapters cablesFirst): not
   * with a Bluetooth adapter connected to the phone beside it, not a cable
   * let go of by hand, not one named for another unit than the one picked.
   * And never when a Bluetooth adapter is what is being looked for
   * (`cableFirst: false`): the page's Connect for an adapter kept from last
   * time that has gone, and Look again (lookForAdapterAgain). Then Apple's
   * screen opens as it always did, and the adapter just connected in it is
   * taken first (pickAdapter), a cable beside it or not.
   */
  const listed = adapterDevices()
  const cables = cableFirst ? cablesFirst(listed, cableRule()) : []
  if (cables.length) {
    fresh = new Set()
    showList(listed)
    logDebug('ble', Platform.OS === 'ios' ? 'a unit on a USB cable is plugged in: Bluetooth not asked, Apple’s screen not opened' : 'a unit on a USB cable is plugged in: Bluetooth not asked')
    if (cables.length > 1) return
    chooseAdapter(cables[0])
    return cables[0]
  }
  if (Platform.OS === 'ios') {
    /*
     * NOT ALLOWED IS SAID, NOT HIDDEN BEHIND APPLE'S SCREEN. Somebody who
     * tapped Don't Allow when iOS asked, or turned Bluetooth off for this
     * app later in the iPhone's Settings, got Apple's screen with nothing in
     * it, and then a line that could only say "check Bluetooth is on, and
     * allowed". The module now answers whether it is allowed ('denied', or
     * 'restricted' when Screen Time or a work profile says no), so the page
     * can say so instead of opening the screen: for 'denied', with the
     * button to the app's own page in the iPhone's Settings; for
     * 'restricted', with where the block is, since that page cannot lift it.
     * Reading the answer asks iOS nothing and shows nothing.
     *
     * ASKED IF IT IS THERE. Build 25, the TestFlight copy, has no such
     * question, and an update reaching it has to go on exactly as before:
     * no answer is not a no.
     */
    let access = null
    try {
      access = mod.authorization?.() ?? null
    } catch {
      access = null
    }
    if (access === 'denied' || access === 'restricted') {
      logDebug('ble', `Bluetooth is not allowed for Fractal Remote (${access}): Apple’s screen not opened`)
      return noteBluetooth({ trouble: access === 'restricted' ? 'restricted' : 'permission' })
    }
    /*
     * NOT OPENED WHERE IT CRASHES (pairScreenShut): on iOS 27 in a build
     * without Apple's fix, the list as it stands instead. An adapter already
     * connected to the iPhone is chosen as after Apple's screen; with none,
     * or more than one to pick from, the page says why the screen stayed
     * shut. Not with one chosen: it goes on to connect, and a warning left
     * over "Connected" would be about nothing.
     */
    if (pairScreenShut()) {
      logDebug('ble', `Apple’s Bluetooth screen not opened: it crashes on iOS ${Platform.Version} in a build without Apple’s fix`)
      fresh = new Set()
      const list = adapterDevices()
      showList(list)
      const pick = pickAdapter(list, fresh, pickRule())
      if (pick) chooseAdapter(pick)
      else noteBluetooth({ said: pairScreenShutWords(deviceNoun()) })
      return pick
    }
    const before = new Set(adapterDevices().map((d) => d.id))
    try {
      await mod.pair()
    } catch (err) {
      if (err?.code === 'E_BUSY') return
      noteBluetooth({ said: err?.code === 'E_SIMULATOR' ? 'This needs a real iPhone or iPad.' : `Apple’s Bluetooth screen did not open: ${err?.message || err}` })
      return
    }
    const list = adapterDevices()
    fresh = new Set(list.map((d) => d.id).filter((id) => !before.has(id)))
    /*
     * Every port and the driver that owns it, in the log. Apple writes the
     * driver names down nowhere; this line is where the real ones came from
     * (bleAdapters USB_DRIVER and BLUETOOTH_DRIVER, from Justin's logs of 27
     * to 29 October 2026), and where a new one would show.
     */
    logDebug('ble', 'ports after Apple’s Bluetooth screen', list.map((d) => `${d.name || '?'} [${d.driver || 'no driver'}${d.offline ? ', offline' : ''}${fresh.has(d.id) ? ', new' : ''}]`).join('; ') || 'none')
    showList(list)
    /* The one just connected, or the only one: chosen without asking. */
    const pick = pickAdapter(list, fresh, pickRule())
    if (pick) chooseAdapter(pick)
    /*
     * NOTHING NEW YET IS NOT NOTHING. CoreMIDI tells of a port Apple's screen
     * has just connected a moment after the screen goes (the module sends
     * the list again then), so for a few seconds a port that turns up new
     * is taken as if it had been there at Done (tookAfterScreen).
     */
    else afterScreen = { before, until: Date.now() + AFTER_SCREEN_MS }
    return pick
  }

  let granted = false
  try {
    const answer = await mod.requestPermissions()
    granted = answer === true || answer?.granted === true
  } catch {
    granted = false
  }
  if (!granted) return noteBluetooth({ trouble: 'permission' })
  let on = false
  try {
    on = (await mod.scan(SCAN_SECONDS)) === true
  } catch (err) {
    if (err?.code === 'E_PERMISSION') return noteBluetooth({ trouble: 'permission' })
    noteBluetooth({ said: `Looking did not start: ${err?.message || err}` })
    return
  }
  if (!on) {
    /*
     * BLUETOOTH OFF: SAID, ITS BUTTON, AND THE LOOK GOES ON BY ITSELF ONCE IT
     * IS ON. "No option to pull up bluetooth connections automatically"
     * (Justin, 7 November 2026, a tablet with its Bluetooth off): three
     * Connects in four minutes each left the same red line and nothing in
     * the log, and once he had found Android's switch himself the page did
     * not notice until a fourth. Now the page offers Turn on Bluetooth under
     * the line (turnOnBluetooth), and while it is open the look starts the
     * moment Bluetooth is on (waitForBluetoothOn), and goes on to choose the
     * one adapter it finds as ever.
     */
    logDebug('ble', `Connect: Bluetooth is off on this ${deviceNoun()}, so the search did not start`)
    noteBluetooth({ trouble: 'bluetooth-off' })
    waitForBluetoothOn(look)
    return
  }
  look()
}

/*
 * THE TEN-SECOND LOOK, once the module's search has started (scan answered
 * true): what it finds is listed as it arrives, and at the end the one
 * adapter found, with none chosen, is the one; nothing at all is said.
 */
function look() {
  fresh = new Set()
  clearTimeout(lookTimer)
  noteBluetooth({ looking: true })
  showList(adapterDevices())
  lookTimer = setTimeout(() => {
    noteBluetooth({ looking: false })
    /* One adapter found and none chosen yet: that is the one. Two is a question, and the list asks it. */
    const pick = saved.adapter ? null : pickAdapter(now.devices, new Set(), pickRule())
    if (pick) chooseAdapter(pick)
    /* Nothing at all: said, rather than a search that ends in silence. */
    if (!saved.adapter && !now.devices.length) {
      noteBluetooth({
        said: OLD_ANDROID
          ? `No adapter found. On this ${deviceNoun()}, Location has to be on for it to find one: turn it on, then tap Connect again.`
          : `No adapter found. Check it is plugged in, lit and close to the ${deviceNoun()}, then tap Connect again.`
      })
    }
  }, SCAN_SECONDS * 1000 + 500)
}

/*
 * WAITING FOR BLUETOOTH TO COME ON, on Android. The module has no question
 * for whether it is on and no word when it comes on, but its search answers
 * false at once while it is off (FractalBleMidiModule.kt scan, before
 * anything else), so asking once a second costs nothing, and the first true
 * is the search itself starting. Then `then` runs: the look, for the page's
 * Connect; nothing, for the link, which tries the adapter kept the moment
 * the trouble goes (bleLink settingsMoved). Ends when it comes on, when the
 * trouble goes some other way, when the page closes
 * (stopWaitingForBluetooth), or after WAIT_ON_MS.
 */
export const WAIT_ON_MS = 120000
const WAIT_TICK_MS = 1000
let waitTimer = null
let waitRound = 0
let waiting = false
function waitForBluetoothOn(then = null) {
  const mod = ble()
  if (Platform.OS !== 'android' || typeof mod?.scan !== 'function') return
  stopWaitingForBluetooth()
  const mine = waitRound
  const until = Date.now() + WAIT_ON_MS
  waiting = true
  logDebug('ble', `waiting for Bluetooth to come on, for up to ${WAIT_ON_MS / 60000} minutes`)
  const again = () => {
    waitTimer = setTimeout(tick, WAIT_TICK_MS)
    /* Never what keeps the app (or a test run) alive. */
    waitTimer?.unref?.()
  }
  const over = (line) => {
    if (mine !== waitRound) return
    waiting = false
    if (line) logDebug('ble', line)
  }
  const tick = async () => {
    waitTimer = null
    if (mine !== waitRound) return
    if (now.trouble !== 'bluetooth-off') return over(null)
    if (Date.now() > until) return over(`Bluetooth did not come on within ${WAIT_ON_MS / 60000} minutes: no longer waiting for it`)
    let on = false
    try {
      /* The page's look is the search itself; the link only needs to know, so its search is a second long. */
      on = (await mod.scan(then ? SCAN_SECONDS : 1)) === true
    } catch {
      on = false
    }
    if (mine !== waitRound) return
    if (now.trouble !== 'bluetooth-off') return over(null)
    if (!on) return again()
    over(then ? 'Bluetooth is on now: looking for the adapter' : 'Bluetooth is on now')
    noteBluetooth({ trouble: null })
    then?.()
  }
  again()
}

/** The wait for Bluetooth to come on, ended: the page closing, or a new Connect. */
export function stopWaitingForBluetooth() {
  waitRound++
  waiting = false
  clearTimeout(waitTimer)
  waitTimer = null
}

/*
 * ANDROID'S OWN QUESTION, "Allow Fractal Remote to turn on Bluetooth?"
 * (BluetoothAdapter.ACTION_REQUEST_ENABLE), sent through React Native's
 * Linking, which every build carries: nothing new in the build. Android 12
 * and newer answers it only with Nearby devices allowed, which Connect has
 * asked for just before. If it will not ask, its Bluetooth settings, and the
 * app's own page in its settings last. Never on an iPhone: iOS lets no app
 * turn Bluetooth on, and its Bluetooth settings have no address an app may
 * open (App Review 2.5.1).
 */
export const ANDROID_PACKAGE = 'cloud.newbold.fractalremote'
export const REQUEST_ENABLE = 'android.bluetooth.adapter.action.REQUEST_ENABLE'
export const BLUETOOTH_SETTINGS = 'android.settings.BLUETOOTH_SETTINGS'
async function askAndroidForBluetooth() {
  try {
    await Linking.sendIntent(REQUEST_ENABLE, [{ key: 'android.intent.extra.PACKAGE_NAME', value: ANDROID_PACKAGE }])
    logDebug('ble', 'asked Android to turn Bluetooth on')
    return true
  } catch (err) {
    logDebug('ble', `Android would not ask to turn Bluetooth on (${err?.message || err}): opening its Bluetooth settings`)
  }
  try {
    await Linking.sendIntent(BLUETOOTH_SETTINGS)
    logDebug('ble', 'opened Android’s Bluetooth settings')
    return true
  } catch (err) {
    logDebug('ble', `Android’s Bluetooth settings did not open (${err?.message || err}): opening the app’s own settings`)
  }
  try {
    await Linking.openSettings()
  } catch {
    // Nothing more to open; the line still says Bluetooth is off.
  }
  return false
}

/**
 * TURN ON BLUETOOTH: the button under "Bluetooth is off" on the Bluetooth
 * page and on the waiting screen. Only ever drawn once Connect, or the link
 * trying the adapter kept, has found it off (the trouble 'bluetooth-off',
 * which only Android sets), so nothing here touches Bluetooth before a tap
 * on the page. Android is asked, and the wait goes on (or starts again):
 * with nothing on, the look follows; with Bluetooth on for an adapter kept,
 * the link tries it the moment it is on. True when Android was asked.
 */
export async function turnOnBluetooth() {
  if (Platform.OS !== 'android' || !ble()) return false
  const asked = await askAndroidForBluetooth()
  if (!waiting && now.trouble === 'bluetooth-off') waitForBluetoothOn(saved.on ? null : look)
  return asked
}

/**
 * For bleLink: Android answered no to a connect AT ONCE, which it does only
 * with its Bluetooth off (an adapter that is merely away takes its fifteen
 * seconds). Said, so the page and the waiting screen offer Turn on
 * Bluetooth, and waited on, so the link tries again the moment it is on.
 */
export function bluetoothLooksOff() {
  if (Platform.OS !== 'android' || !ble()) return
  if (now.trouble === 'bluetooth-off' && waiting) return
  if (now.trouble !== 'bluetooth-off') {
    logDebug('ble', `Bluetooth is off on this ${deviceNoun()}: the adapter kept could not be tried`)
    noteBluetooth({ trouble: 'bluetooth-off' })
  }
  waitForBluetoothOn(null)
}

/*
 * THE ADAPTER KEPT, BACK IN APPLE'S LIST UNDER A NEW ID (iPhone). CoreMIDI
 * gives an adapter connected again in Apple's screen new ids, and the one
 * kept by its old ids read as not connected: "Apple's screen showed the WIDI
 * Jack Connected while the app's page said not connected; leaving the
 * screens showed it was connected all along" (Justin, 7 November 2026). So
 * an adapter kept that is not connected under its own ids, with exactly one
 * port connected now on Apple's Bluetooth driver under its very name, and
 * that port not another unit's adapter, is taken to be it, and chosen
 * again. Two of that name, or none, and nothing is guessed. True when it
 * chose it.
 */
export function adapterBackUnderNewId() {
  const a = saved.adapter
  const name = adapterName(a)
  if (Platform.OS !== 'ios' || !a || isCable(a) || !name || !ble()) return false
  const list = adapterDevices()
  if (list.some((d) => d.id === a.id && !d.offline)) return false
  const taken = takenIds()
  const same = list.filter(
    (d) => d.id !== a.id && !d.offline && !isCable(d) && BLUETOOTH_DRIVER.test(String(d.driver || '')) && !taken.has(d.id) && (adapterName(d) || '').toLowerCase() === name.toLowerCase()
  )
  if (same.length !== 1) return false
  logDebug('ble', `${name} is connected to this ${deviceNoun()} again, under a new id in Apple’s list: that is the one used now`)
  chooseAdapter(same[0])
  return true
}

/**
 * WHAT THE PHONE CAN SEE, READ AGAIN: the Bluetooth page, as it opens and
 * each time the app is back on screen (Apple's Bluetooth screen, Android's
 * settings, Control Center). On an iPhone the list is read as it is now and
 * the adapter kept found under a new id (adapterBackUnderNewId); on Android,
 * with Bluetooth said to be off, the wait for it is started again if it had
 * ended, so a Bluetooth turned on elsewhere is noticed within a second. Not
 * as the page opens (`resume` false): the wait is for a Connect tapped on
 * this visit, and Connect starts it.
 */
export function refreshAdapters({ resume = true } = {}) {
  if (!ble()) return
  if (Platform.OS === 'ios') {
    adapterBackUnderNewId()
    if (listing || now.devices.length) showList(adapterDevices())
    return
  }
  if (resume && now.trouble === 'bluetooth-off' && !waiting) waitForBluetoothOn(saved.on ? null : look)
}

/** For the Bluetooth page while it is open: what the phone can see, read again each time the app is back on screen (refreshAdapters). A remover. */
export function refreshOnScreen() {
  let sub = null
  try {
    sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') refreshAdapters()
    })
  } catch {
    sub = null
  }
  return () => {
    try {
      sub?.remove?.()
    } catch {
      // Removing twice is not a failure worth reporting.
    }
  }
}

/**
 * iPhone: the adapter chosen is not connected to it now. bleLink does not
 * ask an offline port (tryConnect), because on an iPhone only Apple's own
 * Bluetooth screen can connect one again, so the loop can only wait for iOS
 * to bring it back by itself, which nothing shows it doing.
 *
 * Never a unit on a USB cable (bleAdapters isCable): Apple's screen cannot
 * bring one back, plugging it in does, and the link connects the moment it
 * is (bleLink heardDevices). So no Reconnect and no Apple's screen for one
 * (opensApplesScreen, below); cableAway says it is unplugged instead.
 */
export function adapterAway() {
  if (Platform.OS !== 'ios' || !saved.adapter || isCable(saved.adapter)) return false
  return !adapterDevices().some((d) => d.id === saved.adapter.id && !d.offline)
}

/** The unit on the USB cable chosen is not plugged in now, on either phone: the page says so, and it connects by itself when it is. */
export function cableAway() {
  if (!saved.adapter || !isCable(saved.adapter)) return false
  return !adapterDevices().some((d) => d.id === saved.adapter.id && !d.offline)
}

/**
 * Whether a tap on Look again (lookForAdapterAgain) opens Apple's screen
 * now: an iPhone whose adapter has gone, with that screen not kept shut.
 * Never for a unit on a USB cable, which is never away in that sense
 * (adapterAway), so for one the tap is the link's poke alone. The
 * button says so under itself when it does (APPLE_SCREEN_OPENS), so the one
 * question decides both what the tap does and what the button says.
 */
export const opensApplesScreen = () => adapterAway() && !pairScreenShut()

/*
 * WHAT A BUTTON THAT OPENS APPLE'S SCREEN SAYS UNDER ITSELF: Reconnect on the
 * page, and Look for the adapter again on the waiting screen and on Phone &
 * computer. "Look for the adapter again" opened Apple's screen with nothing
 * to say it would, or that the adapter is tapped there and Connected waited
 * for before Done: tapped early, Done leaves it unconnected, and the waiting
 * screen's note said only to check Bluetooth was on. The page's own words,
 * once, so the three buttons say the same thing. iPhone only, so Apple's name
 * is never on another phone.
 */
export const APPLE_SCREEN_OPENS = 'Opens Apple’s Bluetooth screen: tap your adapter, wait for Connected, then Done.'

/**
 * LOOK AGAIN, BY HAND: the Bluetooth page's Reconnect and the waiting
 * screen's "Look for the adapter again".
 *
 * An iPhone drops a Bluetooth link nobody is using after a few minutes
 * (Apple's QA1831), a phone locked in a pocket between songs is exactly
 * that, and getting it back was Stop, Connect and Apple's screen, three taps
 * mid-set. So while the adapter is away on an iPhone, this opens Apple's
 * screen straight away (findAdapters, which chooses what comes back), and
 * only then hands over to the link's own poke. Anywhere else, or with
 * Apple's screen kept shut (pairScreenShut), it is the poke alone, as
 * before.
 *
 * `poke` is link.js's probeNow, passed in: bleLink imports this file, so it
 * cannot be imported back. Never for a watch tap or anything else that is
 * not a hand on this screen: Apple's screen is a screen.
 */
export async function lookForAdapterAgain(poke) {
  if (opensApplesScreen()) {
    try {
      /* The adapter that went is what is looked for: a cable plugged in meanwhile is not taken in its place (findAdapters). */
      await findAdapters({ cableFirst: false })
    } catch {
      // The page says what went wrong (findAdapters notes it); the poke still goes.
    }
  }
  poke?.()
}

/**
 * ANOTHER ADAPTER THE PHONE CAN SEE, while the link is trying the one kept
 * and it is not there (bleLink's notThere), or null: for the Bluetooth page
 * to offer by name ("WIDI Master isn't answering. WIDI Jack Bluetooth is
 * here."), never to take by itself (bleAdapters otherAdapterHere). `list` is
 * what the module lists (adapterDevices), as the page has it. For an FM3,
 * only an adapter the app names for one (shared/bluetooth-gear namedForFm3:
 * the WIDI Uhost, the FM3's own way): an adapter it has no name for could
 * take power from MIDI OUT, which FM3_NEVER refuses.
 *
 * ON ANDROID, ONLY WHAT THIS ROUND'S LOOK HEARD (glanceForAdapters). The
 * module's list is its last search's, kept until the next search starts, so
 * before this round's look it can hold an adapter heard minutes ago in
 * another search, or, with the phone's Bluetooth off (the look does not
 * start), one that has long gone: neither is "here". The look's search
 * empties the list as it starts, so from then on everything in it was heard
 * in this round. An iPhone's list is CoreMIDI's as it is now.
 */
export const otherAdapterNow = (list = adapterDevices()) => {
  if (!saved.adapter) return null
  if (Platform.OS !== 'ios' && !lookedThisRound) return null
  /* Never one kept for another unit: it is on that unit (WHICH ADAPTER GOES WITH WHICH UNIT). */
  const taken = takenIds()
  const here = (Array.isArray(list) ? list : []).filter((d) => !taken.has(d?.id))
  return otherAdapterHere(here, saved.adapter, { os: Platform.OS, refused: saved.unit === 'fm3' ? (name) => !namedForFm3(name) : null })
}

/*
 * What the page says about it, and its button: by name, and never the
 * adapter's address (adapterName). Two of the same model advertise the same
 * name, and "WIDI Uhost isn't answering. WIDI Uhost is here." read like a
 * mistake: then it is the other one.
 */
export function otherAdapterWords(kept, other) {
  const here = adapterName(other)
  const was = adapterName(kept)
  if (here && was && here.toLowerCase() === was.toLowerCase()) {
    return { line: `${was} isn’t answering. Another ${here} is here.`, button: `Use the other ${here}` }
  }
  return {
    line: `${was || 'The adapter from last time'} isn’t answering. ${here || 'Another adapter'} is here.`,
    button: here ? `Use ${here}` : 'Use the other adapter'
  }
}

/*
 * ONE SHORT LOOK AROUND, while the link is trying an adapter that is not
 * there (a try has missed it: notThere) and the page is open
 * (otherAdapterNow needs something to see).
 *
 * An iPhone's list is CoreMIDI's, always as it is now, so it is only read,
 * and its changes heard: nothing is asked of iOS. Android's list is its
 * last search's, and with an adapter kept, Connect never searches, so it
 * may be empty or from another day: one short search, the module's own
 * scan that Connect uses (findAdapters), and only that. Never Nearby
 * devices asked for (no question pops up for something nobody tapped: a
 * scan it is not allowed only fails, quietly), never a pick (no lookTimer),
 * and never over a search already under way. The link's next try ends it
 * early (the module stops a scan to connect), and what it found by then
 * stays listed. Not for a unit on a USB cable, which is plugged in or not.
 */
export const GLANCE_SECONDS = 4
let glancedAt = 0
export async function glanceForAdapters() {
  const mod = ble()
  const a = saved.adapter
  if (!mod || !saved.on || !a || isCable(a) || now.phase !== 'connecting' || !now.notThere) return false
  listenForList()
  if (Platform.OS === 'ios') {
    showList(adapterDevices())
    return true
  }
  if (now.looking || typeof mod.scan !== 'function' || Date.now() - glancedAt < GLANCE_SECONDS * 1000) return false
  glancedAt = Date.now()
  let on = false
  try {
    on = (await mod.scan(GLANCE_SECONDS)) === true
  } catch {
    on = false
  }
  /* The look is the round's it started in: a new round begun meanwhile (a switch, Stop) gets its own. */
  if (!on || !now.notThere) return false
  lookedThisRound = true
  logDebug('ble', `${adapterName(a) || 'the adapter'} is not there: looking ${GLANCE_SECONDS} s for another adapter nearby`)
  showList(adapterDevices())
  return true
}

/* ------------------------------------------------------------------ */
/* The wire                                                            */
/* ------------------------------------------------------------------ */

let wire = null
let joiner = null
let hearing = null

/** The wire to the unit while the adapter is connected, or null. */
export const liveWire = () => wire

/**
 * A fresh wire for the chosen unit, with the bytes from the adapter routed
 * into it. One per connection: a wire that has been closed stays closed, so
 * whatever it was waiting on is answered "not connected" rather than late.
 */
export function openWire() {
  closeWire()
  const unit = saved.unit
  if (!unit || !ble()) return null
  const mod = ble()
  wire = createBleWire({
    send: (bytes) => {
      try {
        return mod.send(bytes) !== false
      } catch {
        return false
      }
    },
    unit,
    /* The unit's own blocks (lib/gen3Catalog): an FM9's second amp, an Axe-Fx III's fourth drive. The FM3's list for the FM3 and the AM4, which names its own. */
    catalog: catalogFor(unit),
    methods: methodsFor(unit),
    log: (line) => logDebug('ble', line),
    remember: (m) => rememberMethods(unit, m),
    /* The wrong unit was picked: the page says which one answered (bleWire heardAnother, and heardAnAm4, which also stops the wire), and null takes it off when the one picked answers after all (heardFromIt). */
    onForeign: (name) => noteBluetooth({ answeredAs: name || null }),
    /* Edit's knobs over Bluetooth, for this unit, asked at every request (editOverBluetooth). */
    edit: () => editOverBluetooth(unit)
  })
  const mine = wire
  joiner = createJoiner({
    onSysex: (frame) => mine.heard(frame),
    onShort: (msg) => mine.heardShort(msg)
  })
  const join = joiner
  hearing = onAdapter('onBytes', (e) => {
    if (joiner !== join) return
    /* Before the joiner: a long answer is timed by its bytes, not only its frames. */
    mine.heardBytes(e?.bytes)
    join.push(e?.bytes)
  })
  return wire
}

/** Close the wire: everything waiting on it is told the adapter has gone. */
export function closeWire() {
  hearing?.()
  hearing = null
  joiner = null
  const was = wire
  wire = null
  try {
    was?.close()
  } catch {
    // A wire that will not close has nothing left to say.
  }
}

/* ------------------------------------------------------------------ */
/* The check panel                                                     */
/* ------------------------------------------------------------------ */

/** The panel's steps for the chosen unit: the AM4 has its own, from its allowlist, and a VP4 none (it never answers over Bluetooth: bleVp4.js). */
export const checkSteps = (unit = saved.unit) => CHECK_STEPS[unit === 'am4' ? 'am4' : unit === 'vp4' ? 'vp4' : 'gen3']

/** One step of the check, or 'all' for every read. Says so, rather than throwing, when nothing is connected. */
export async function runCheck(step) {
  if (!wire) return { step, ok: false, rows: [], error: 'The adapter is not connected.' }
  try {
    const out = await wire.check(step)
    logDebug('ble', `check ${step}: ${out.ok ? 'done' : `failed — ${out.error}`}`)
    return out
  } catch (err) {
    return { step, ok: false, rows: [], error: err?.message || String(err) }
  }
}
