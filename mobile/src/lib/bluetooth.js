import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'

import { BLE_UNITS, CHECK_STEPS, createBleWire, settleMethods } from './bleWire'
import { createJoiner } from './fractal-sysex.mjs'
import { blockCatalog } from './blockCatalog'
import { setSwitch } from './bleSwitch'
import { isAdapter, pickAdapter } from './bleAdapters'
import { logDebug } from './debugLog'

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
 *     anybody whose app cannot do it. Everybody else who has unlocked the
 *     app sees it, as a public beta (the gate is in Settings.js);
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
  /* The unit that answered instead of the one picked (an AM4 on an FM3's connection), or null. */
  answeredAs: null
}

const UNIT_KEYS = BLE_UNITS.map((u) => u.key)
const SCAN_SECONDS = 10

let saved = { ...SAVED }
let now = { ...NOW }
let snapshot = { ...saved, ...now }
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
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {
    /* Costs the next launch these choices, and nothing else. */
  })
}

/** Whatever was on disk, made safe: storage can hold an older shape, or nonsense. */
function settle(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const adapter =
    s.adapter && typeof s.adapter.id === 'string' && s.adapter.id
      ? { id: s.adapter.id, name: typeof s.adapter.name === 'string' ? s.adapter.name : '' }
      : null
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
export const RESTRICTED_WORDS =
  'Bluetooth is blocked for Fractal Remote on this iPhone, by Screen Time or by whoever manages the phone, so Fractal Remote can’t turn it on. Look in the iPhone’s Settings → Screen Time → Content & Privacy Restrictions for Bluetooth Sharing, or ask whoever manages the phone'

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

/** For bleLink, which owns the link: what is happening, told to the page. */
export function noteBluetooth(patch) {
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

/** What stands between the phone and the adapter, or null: for the waiting screen. A word, so it redraws only when it changes. */
export const useBluetoothTrouble = () => useSyncExternalStore(subscribeBluetooth, readTrouble, readTrouble)

/**
 * Pick the settings up from last time.
 *
 * ON ONLY WHERE IT CAN WORK. A phone that had it on and is now running a
 * build without the module (Expo Go, or a store build from before the module
 * went into one) comes back with it OFF, whatever the disk says: otherwise
 * every request would be refused by a Bluetooth wire that can never connect,
 * and the app would be dead. The module is not asked anything unless the
 * disk says the mode was on.
 */
export async function restoreBluetooth() {
  const before = JSON.stringify(saved)
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const was = settle(raw ? JSON.parse(raw) : null)
    saved = { ...was, on: was.on && !!was.unit && bluetoothSupported() }
  } catch {
    saved = { ...SAVED }
  }
  setSwitch({ on: saved.on })
  /* Nothing on disk is the ordinary case, and it changes nothing: no screen is redrawn for it. */
  if (JSON.stringify(saved) === before) return saved.on
  now = { ...now, phase: saved.on ? 'idle' : 'off' }
  if (saved.on) logDebug('ble', `Bluetooth (beta) is on, for the ${unitName(saved.unit)}`)
  announce()
  return saved.on
}

/** The unit's name as the page writes it. */
export const unitName = (key) => BLE_UNITS.find((u) => u.key === key)?.name || 'unit'

/**
 * Turn Bluetooth (beta) on or off.
 *
 * Not on without a unit: see SAVED. The switch moves at once, so from this
 * moment nothing goes to the computer while it is on; App.js sees the change
 * and restarts the link, which is what connects (bleLink.js).
 */
export function setBluetooth(on) {
  const want = on === true && !!saved.unit && bluetoothSupported()
  if (want === saved.on) return saved.on
  saved = { ...saved, on: want }
  setSwitch({ on: want })
  now = { ...now, phase: want ? 'idle' : 'off' }
  logDebug('ble', want ? `Bluetooth (beta) turned on, for the ${unitName(saved.unit)}` : 'Bluetooth (beta) turned off')
  keep()
  announce()
  return want
}

/** Which unit is on the other end. Changing it while connected asks the new one everything (bleLink). */
export function setBluetoothUnit(key) {
  if (!UNIT_KEYS.includes(key) || key === saved.unit) return saved.unit
  saved = { ...saved, unit: key }
  logDebug('ble', `the unit is an ${unitName(key)}`)
  keep()
  announce()
  return key
}

/** Use this adapter from now on. bleLink hears the change and connects to it. */
export function chooseAdapter(dev) {
  if (!dev || typeof dev.id !== 'string' || !dev.id) return
  if (saved.adapter?.id === dev.id) return
  saved = { ...saved, adapter: { id: dev.id, name: typeof dev.name === 'string' ? dev.name : '' } }
  logDebug('ble', `adapter chosen: ${dev.name || dev.id}`)
  keep()
  announce()
}

/** Forget the adapter. bleLink hears it and lets go. */
export function forgetAdapter() {
  if (!saved.adapter) return
  saved = { ...saved, adapter: null }
  logDebug('ble', 'adapter forgotten')
  keep()
  announce()
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
  listing = onAdapter('onDevices', (e) => showList(e?.devices))
}

/**
 * Look for the adapter.
 *
 * iPhone: Apple's own Bluetooth MIDI screen, the only way an app can pair
 * one. What is listed after Done that was not there before is the adapter
 * just paired, and goes first. Android: ask for "Nearby devices", then scan
 * for ten seconds; what is found arrives while it looks.
 *
 * When only one adapter could be meant it is chosen here (pickAdapter), and
 * on an iPhone the promise resolves to it; otherwise to nothing, and the list
 * on the page asks.
 */
export async function findAdapters() {
  const mod = ble()
  if (!mod) return
  listenForList()
  noteBluetooth({ trouble: null, said: null })
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
     * Every port and the driver that owns it, in the log. Which driver is
     * Apple's Bluetooth one is not written down anywhere reliable, so the
     * page matches on nothing; a pasted log from a real adapter settles it.
     */
    logDebug('ble', 'ports after Apple’s Bluetooth screen', list.map((d) => `${d.name || '?'} [${d.driver || 'no driver'}${d.offline ? ', offline' : ''}${fresh.has(d.id) ? ', new' : ''}]`).join('; ') || 'none')
    showList(list)
    /* The one just connected, or the only one: chosen without asking. */
    const pick = pickAdapter(list, fresh)
    if (pick) chooseAdapter(pick)
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
  if (!on) return noteBluetooth({ trouble: 'bluetooth-off' })
  fresh = new Set()
  clearTimeout(lookTimer)
  noteBluetooth({ looking: true })
  showList(adapterDevices())
  lookTimer = setTimeout(() => {
    noteBluetooth({ looking: false })
    /* One adapter found and none chosen yet: that is the one. Two is a question, and the list asks it. */
    const pick = saved.adapter ? null : pickAdapter(now.devices)
    if (pick) chooseAdapter(pick)
    /* Nothing at all: said, rather than a search that ends in silence. */
    if (!saved.adapter && !now.devices.length) {
      noteBluetooth({
        said: OLD_ANDROID
          ? 'No adapter found. On this phone, Location has to be on for it to find one: turn it on, then tap Connect again.'
          : 'No adapter found. Check it is plugged in, lit and close to the phone, then tap Connect again.'
      })
    }
  }, SCAN_SECONDS * 1000 + 500)
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
    catalog: blockCatalog,
    methods: methodsFor(unit),
    log: (line) => logDebug('ble', line),
    remember: (m) => rememberMethods(unit, m),
    /* The wrong unit was picked: the wire has stopped sending, and the page says which one answered. */
    onForeign: (name) => noteBluetooth({ answeredAs: name })
  })
  const mine = wire
  joiner = createJoiner({
    onSysex: (frame) => mine.heard(frame),
    onShort: (msg) => mine.heardShort(msg)
  })
  const join = joiner
  hearing = onAdapter('onBytes', (e) => {
    if (joiner === join) join.push(e?.bytes)
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

/** The panel's steps for the chosen unit: the AM4 has its own, from its allowlist. */
export const checkSteps = (unit = saved.unit) => CHECK_STEPS[unit === 'am4' ? 'am4' : 'gen3']

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
